import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  RateLimiterEngine,
  MemoryRateLimitStore,
  RATE_LIMIT_CONFIG,
} from '../lib/auth/rate-limiter'
import { isValidPinFormat } from '../lib/auth'

describe('RateLimiterEngine Unit Tests', () => {
  let store: MemoryRateLimitStore
  let limiter: RateLimiterEngine

  beforeEach(() => {
    store = new MemoryRateLimitStore()
    limiter = new RateLimiterEngine(store)
  })

  test('PIN format validation: requires 6 numbers and 1 capital letter in 4th place', () => {
    // Valid format: 3 digits + 1 uppercase letter + 3 digits
    assert.equal(isValidPinFormat('123A456'), true)
    assert.equal(isValidPinFormat('283A719'), true)
    assert.equal(isValidPinFormat('000Z999'), true)

    // Invalid: lowercase letter in 4th place
    assert.equal(isValidPinFormat('123a456'), false)

    // Invalid: letter in wrong position
    assert.equal(isValidPinFormat('A123456'), false)
    assert.equal(isValidPinFormat('123456A'), false)
    assert.equal(isValidPinFormat('1A23456'), false)

    // Invalid: wrong length
    assert.equal(isValidPinFormat('123A45'), false) // 6 chars
    assert.equal(isValidPinFormat('123A4567'), false) // 8 chars
    assert.equal(isValidPinFormat('1234'), false) // old 4-digit pin

    // Invalid: all digits
    assert.equal(isValidPinFormat('1234567'), false)

    // Invalid: special characters
    assert.equal(isValidPinFormat('123@456'), false)
  })

  test('Limit enforcement: allows up to 3 failed attempts within an hour', async () => {
    const account = 'owner'
    const ip = '192.168.1.1'
    const now = new Date('2026-10-19T10:00:00Z')

    // Initial check: allowed
    let check = await limiter.check(account, ip, now)
    assert.equal(check.allowed, true)
    assert.equal(check.status, 200)

    // Failed attempt 1
    await limiter.recordAttempt(account, ip, false, now)
    check = await limiter.check(account, ip, now)
    assert.equal(check.allowed, true)
    assert.equal(check.attemptsLastHour, 1)

    // Failed attempt 2 (from a different IP under the same account)
    await limiter.recordAttempt(account, '192.168.1.2', false, now)
    check = await limiter.check(account, ip, now)
    assert.equal(check.allowed, true)
    assert.equal(check.attemptsLastHour, 2)

    // Failed attempt 3
    await limiter.recordAttempt(account, ip, false, now)

    // 4th check: must be rejected with 429
    check = await limiter.check(account, ip, now)
    assert.equal(check.allowed, false)
    assert.equal(check.status, 429)
    assert.equal(check.reason, 'MAX_ATTEMPTS_HOURLY')
    assert.ok(check.retryAfterSeconds! > 0)
    assert.ok(check.error?.includes('Maximum 3 failed attempts per hour allowed'))
  })

  test('Limit reset after hourly time window', async () => {
    const account = 'owner'
    const ip = '192.168.1.1'
    const startTime = new Date('2026-10-19T10:00:00Z')

    // 3 failed attempts at 10:00
    await limiter.recordAttempt(account, ip, false, startTime)
    await limiter.recordAttempt(account, ip, false, startTime)
    await limiter.recordAttempt(account, ip, false, startTime)

    // At 10:30, still locked out
    const atThirtyMin = new Date('2026-10-19T10:30:00Z')
    let check = await limiter.check(account, ip, atThirtyMin)
    assert.equal(check.allowed, false)
    assert.equal(check.status, 429)

    // At 11:01 (past the 1-hour rolling window), hourly limit resets
    const afterOneHour = new Date('2026-10-19T11:01:00Z')
    check = await limiter.check(account, ip, afterOneHour)
    assert.equal(check.allowed, true)
    assert.equal(check.status, 200)
    assert.equal(check.attemptsLastHour, 0)
  })

  test('Limit enforcement: daily cap of max 5 attempts per 24 hours', async () => {
    const account = 'owner'
    const ip = '192.168.1.1'

    // Spread attempts over several hours so hourly limit (max 3/hr) is not exceeded:
    // 2 attempts at 08:00
    await limiter.recordAttempt(account, ip, false, new Date('2026-10-19T08:00:00Z'))
    await limiter.recordAttempt(account, ip, false, new Date('2026-10-19T08:05:00Z'))

    // 2 attempts at 10:00
    await limiter.recordAttempt(account, ip, false, new Date('2026-10-19T10:00:00Z'))
    await limiter.recordAttempt(account, ip, false, new Date('2026-10-19T10:05:00Z'))

    // 1 attempt at 12:00 (total = 5)
    await limiter.recordAttempt(account, ip, false, new Date('2026-10-19T12:00:00Z'))

    // Check at 12:01: daily limit reached
    const check = await limiter.check(account, ip, new Date('2026-10-19T12:01:00Z'))
    assert.equal(check.allowed, false)
    assert.equal(check.status, 429)
    assert.equal(check.reason, 'MAX_ATTEMPTS_DAILY')
    assert.ok(check.error?.includes('Maximum 5 failed attempts per day allowed'))
  })

  test('IP allowlist: maintains max 3 distinct IPs within 30-day window', async () => {
    const account = 'owner'
    const day1 = new Date('2026-10-01T10:00:00Z')

    // Successfully log in from IP 1
    await limiter.recordAttempt(account, '10.0.0.1', true, day1)

    // Successfully log in from IP 2
    await limiter.recordAttempt(account, '10.0.0.2', true, day1)

    // Successfully log in from IP 3
    await limiter.recordAttempt(account, '10.0.0.3', true, day1)

    // All 3 IPs are in the allowlist and can attempt to log in
    const check1 = await limiter.check(account, '10.0.0.1', day1)
    const check2 = await limiter.check(account, '10.0.0.2', day1)
    const check3 = await limiter.check(account, '10.0.0.3', day1)

    assert.equal(check1.allowed, true)
    assert.equal(check2.allowed, true)
    assert.equal(check3.allowed, true)
  })

  test('4th-IP rejection: rejects login attempt from an unverified 4th distinct IP', async () => {
    const account = 'owner'
    const now = new Date('2026-10-19T12:00:00Z')

    // 3 distinct IPs already approved within the last 30 days
    await limiter.recordAttempt(account, '10.0.0.1', true, now)
    await limiter.recordAttempt(account, '10.0.0.2', true, now)
    await limiter.recordAttempt(account, '10.0.0.3', true, now)

    // Attempting login from a 4th unverified IP
    const check4th = await limiter.check(account, '10.0.0.4', now)

    assert.equal(check4th.allowed, false)
    assert.equal(check4th.status, 403)
    assert.equal(check4th.reason, 'UNRECOGNIZED_IP')
    assert.ok(check4th.error?.includes('Maximum of 3 distinct IPs'))
  })

  test('Old IPs older than 30 days roll off allowlist allowing new distinct IPs', async () => {
    const account = 'owner'
    const thirtyOneDaysAgo = new Date('2026-09-15T10:00:00Z')
    const now = new Date('2026-10-19T12:00:00Z')

    // IP 1 was used 34 days ago (expired from 30-day window)
    await limiter.recordAttempt(account, '10.0.0.1', true, thirtyOneDaysAgo)

    // IP 2 and IP 3 were used recently
    await limiter.recordAttempt(account, '10.0.0.2', true, now)
    await limiter.recordAttempt(account, '10.0.0.3', true, now)

    // IP 4 should now be allowed because only 2 active IPs exist in the 30-day window!
    const check = await limiter.check(account, '10.0.0.4', now)
    assert.equal(check.allowed, true)
    assert.equal(check.distinctIpsCount, 2)
  })
})
