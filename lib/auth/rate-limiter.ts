import { sql } from '@/lib/db'
import { ensureAuthRateLimitTables } from '@/lib/db'
import type { NextRequest } from 'next/server'

export const RATE_LIMIT_CONFIG = {
  MAX_ATTEMPTS_PER_HOUR: 3,
  MAX_ATTEMPTS_PER_DAY: 5,
  MAX_DISTINCT_IPS: 3,
  IP_ROLLING_WINDOW_DAYS: 30,
} as const

export interface RateLimitResult {
  allowed: boolean
  status: 200 | 403 | 429
  reason?: 'MAX_ATTEMPTS_HOURLY' | 'MAX_ATTEMPTS_DAILY' | 'UNRECOGNIZED_IP'
  retryAfterSeconds?: number
  error?: string
  attemptsLastHour: number
  attemptsLastDay: number
  distinctIpsCount: number
  allowedIps: string[]
}

/**
 * Extracts the real client IP address prioritizing trusted reverse-proxy headers.
 * Does not trust arbitrary spoofed headers.
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers

  // Vercel edge trusted proxy header
  const vercelIp = headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0].trim()

  // Standard reverse proxy headers
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  // Cloudflare trusted header
  const cfIp = headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  // NextRequest native ip (available in Edge runtime)
  if ('ip' in req && typeof (req as any).ip === 'string' && (req as any).ip) {
    return (req as any).ip.trim()
  }

  // Fallback to first x-forwarded-for hop
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  return '127.0.0.1'
}

/**
 * Pluggable store interface for rate limit state storage.
 */
export interface IRateLimitStore {
  getActiveIps(account: string, since: Date): Promise<string[]>
  getFailedAttempts(account: string, since: Date): Promise<{ attempted_at: Date }[]>
  recordAttempt(account: string, ip: string, success: boolean, date?: Date): Promise<void>
}

/**
 * Core Rate Limiter Engine implementing account-scoped attempt thresholds
 * and rolling IP allowlists.
 */
export class RateLimiterEngine {
  constructor(private store: IRateLimitStore) {}

  /**
   * Evaluates if a login attempt is permitted for the specified account and IP.
   */
  async check(account: string, ip: string, now: Date = new Date()): Promise<RateLimitResult> {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - RATE_LIMIT_CONFIG.IP_ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    // 1. Check IP allowlist (max 3 distinct IPs within 30 days)
    const allowedIps = await this.store.getActiveIps(account, thirtyDaysAgo)
    const isIpRecognized = allowedIps.includes(ip)

    if (!isIpRecognized && allowedIps.length >= RATE_LIMIT_CONFIG.MAX_DISTINCT_IPS) {
      console.warn(
        `[SECURITY ALERT] 4th distinct IP blocked for account="${account}". Connecting IP: "${ip}". Allowed IPs: [${allowedIps.join(', ')}]`
      )
      return {
        allowed: false,
        status: 403,
        reason: 'UNRECOGNIZED_IP',
        error: 'Login blocked: Unrecognized device/IP. A maximum of 3 distinct IPs are permitted for this account.',
        attemptsLastHour: 0,
        attemptsLastDay: 0,
        distinctIpsCount: allowedIps.length,
        allowedIps,
      }
    }

    // 2. Count failed attempts across all IPs for this account
    const failedAttempts = await this.store.getFailedAttempts(account, oneDayAgo)

    const attemptsLastDay = failedAttempts.length
    const attemptsLastHour = failedAttempts.filter(
      (a) => new Date(a.attempted_at) >= oneHourAgo
    ).length

    // Check hourly limit: max 3 attempts per hour
    if (attemptsLastHour >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_HOUR) {
      const oldestInHour = new Date(failedAttempts[RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_HOUR - 1].attempted_at)
      const resetTime = new Date(oldestInHour.getTime() + 60 * 60 * 1000)
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime.getTime() - now.getTime()) / 1000))

      console.warn(
        `[SECURITY ALERT] Hourly rate limit exceeded for account="${account}". Attempts in last hour: ${attemptsLastHour}. IP: "${ip}". Retry-After: ${retryAfterSeconds}s`
      )
      return {
        allowed: false,
        status: 429,
        reason: 'MAX_ATTEMPTS_HOURLY',
        retryAfterSeconds,
        error: `Rate limit exceeded: Maximum ${RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_HOUR} failed attempts per hour allowed. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
        attemptsLastHour,
        attemptsLastDay,
        distinctIpsCount: allowedIps.length,
        allowedIps,
      }
    }

    // Check daily limit: max 5 attempts per day
    if (attemptsLastDay >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_DAY) {
      const oldestInDay = new Date(failedAttempts[RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_DAY - 1].attempted_at)
      const resetTime = new Date(oldestInDay.getTime() + 24 * 60 * 60 * 1000)
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTime.getTime() - now.getTime()) / 1000))

      console.warn(
        `[SECURITY ALERT] Daily rate limit exceeded for account="${account}". Attempts in last 24h: ${attemptsLastDay}. IP: "${ip}". Retry-After: ${retryAfterSeconds}s`
      )
      return {
        allowed: false,
        status: 429,
        reason: 'MAX_ATTEMPTS_DAILY',
        retryAfterSeconds,
        error: `Rate limit exceeded: Maximum ${RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_DAY} failed attempts per day allowed. Try again tomorrow.`,
        attemptsLastHour,
        attemptsLastDay,
        distinctIpsCount: allowedIps.length,
        allowedIps,
      }
    }

    return {
      allowed: true,
      status: 200,
      attemptsLastHour,
      attemptsLastDay,
      distinctIpsCount: allowedIps.length,
      allowedIps,
    }
  }

  async recordAttempt(account: string, ip: string, success: boolean, now: Date = new Date()): Promise<void> {
    await this.store.recordAttempt(account, ip, success, now)
  }
}

/**
 * Persistent PostgreSQL Store using Neon serverless driver.
 */
export class PostgresRateLimitStore implements IRateLimitStore {
  async getActiveIps(account: string, since: Date): Promise<string[]> {
    try {
      await ensureAuthRateLimitTables()
      const rows = await sql`
        SELECT ip_address
        FROM account_ips
        WHERE account = ${account} AND last_seen_at >= ${since}
        ORDER BY last_seen_at DESC;
      `
      return rows.map((r: any) => r.ip_address)
    } catch (err) {
      console.error('Error fetching active IPs from Postgres:', err)
      return []
    }
  }

  async getFailedAttempts(account: string, since: Date): Promise<{ attempted_at: Date }[]> {
    try {
      await ensureAuthRateLimitTables()
      const rows = await sql`
        SELECT attempted_at
        FROM auth_attempts
        WHERE account = ${account}
          AND success = false
          AND attempted_at >= ${since}
        ORDER BY attempted_at DESC;
      `
      return rows.map((r: any) => ({ attempted_at: new Date(r.attempted_at) }))
    } catch (err) {
      console.error('Error fetching failed attempts from Postgres:', err)
      return []
    }
  }

  async recordAttempt(account: string, ip: string, success: boolean, date: Date = new Date()): Promise<void> {
    try {
      await ensureAuthRateLimitTables()

      await sql`
        INSERT INTO auth_attempts (account, ip_address, success, attempted_at)
        VALUES (${account}, ${ip}, ${success}, ${date});
      `

      if (success) {
        await sql`
          INSERT INTO account_ips (account, ip_address, first_seen_at, last_seen_at)
          VALUES (${account}, ${ip}, ${date}, ${date})
          ON CONFLICT (account, ip_address)
          DO UPDATE SET last_seen_at = ${date};
        `
      }
    } catch (err) {
      console.error('Error recording auth attempt in Postgres:', err)
    }
  }
}

/**
 * In-memory Store for unit tests and local isolation.
 */
export class MemoryRateLimitStore implements IRateLimitStore {
  private ips: { account: string; ip: string; first_seen_at: Date; last_seen_at: Date }[] = []
  private attempts: { account: string; ip: string; success: boolean; attempted_at: Date }[] = []

  async getActiveIps(account: string, since: Date): Promise<string[]> {
    return this.ips
      .filter((i) => i.account === account && i.last_seen_at >= since)
      .map((i) => i.ip)
  }

  async getFailedAttempts(account: string, since: Date): Promise<{ attempted_at: Date }[]> {
    return this.attempts
      .filter((a) => a.account === account && !a.success && a.attempted_at >= since)
      .sort((a, b) => b.attempted_at.getTime() - a.attempted_at.getTime())
      .map((a) => ({ attempted_at: a.attempted_at }))
  }

  async recordAttempt(account: string, ip: string, success: boolean, date: Date = new Date()): Promise<void> {
    this.attempts.push({ account, ip, success, attempted_at: date })

    if (success) {
      const existing = this.ips.find((i) => i.account === account && i.ip === ip)
      if (existing) {
        existing.last_seen_at = date
      } else {
        this.ips.push({ account, ip, first_seen_at: date, last_seen_at: date })
      }
    }
  }

  clear() {
    this.ips = []
    this.attempts = []
  }
}

// Global persistent instance for route handlers
export const PersistentRateLimiter = new RateLimiterEngine(new PostgresRateLimitStore())
