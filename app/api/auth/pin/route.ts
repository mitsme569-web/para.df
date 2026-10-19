import { NextResponse, type NextRequest } from 'next/server'
import { createSessionToken, getAppPin, isValidPinFormat, COOKIE_NAME } from '@/lib/auth'
import { getClientIp, PersistentRateLimiter, RATE_LIMIT_CONFIG } from '@/lib/auth/rate-limiter'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const account = 'owner'

  try {
    // 1. Evaluate account-scoped and IP rate limits
    const rateCheck = await PersistentRateLimiter.check(account, ip)

    if (!rateCheck.allowed) {
      const headers: Record<string, string> = {
        'X-RateLimit-Limit-Hourly': RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_HOUR.toString(),
        'X-RateLimit-Limit-Daily': RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_DAY.toString(),
        'X-RateLimit-Distinct-IPs': rateCheck.distinctIpsCount.toString(),
      }

      if (rateCheck.retryAfterSeconds) {
        headers['Retry-After'] = rateCheck.retryAfterSeconds.toString()
      }

      return NextResponse.json(
        {
          error: rateCheck.error,
          reason: rateCheck.reason,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        {
          status: rateCheck.status,
          headers,
        }
      )
    }

    // 2. Parse request body
    const body = await req.json().catch(() => ({}))
    const pin = (body?.pin || '').toString().trim()

    // 3. Validate PIN format (6 numbers with 1 capital letter in the 4th position)
    if (!isValidPinFormat(pin)) {
      await PersistentRateLimiter.recordAttempt(account, ip, false)

      return NextResponse.json(
        {
          error: 'PIN must consist of 6 digits with a capital letter in the 4th position (e.g., 123A456).',
          remainingHourly: Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_HOUR - (rateCheck.attemptsLastHour + 1)),
          remainingDaily: Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_DAY - (rateCheck.attemptsLastDay + 1)),
        },
        { status: 400 }
      )
    }

    // 4. Verify against configured APP_PIN secret
    const expectedPin = getAppPin()

    if (pin !== expectedPin) {
      await PersistentRateLimiter.recordAttempt(account, ip, false)

      const remainingHourly = Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_HOUR - (rateCheck.attemptsLastHour + 1))
      const remainingDaily = Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS_PER_DAY - (rateCheck.attemptsLastDay + 1))

      return NextResponse.json(
        {
          error: `Incorrect PIN. Remaining attempts: ${remainingHourly} this hour (${remainingDaily} today).`,
          remainingHourly,
          remainingDaily,
        },
        { status: 401 }
      )
    }

    // 5. Successful authentication
    await PersistentRateLimiter.recordAttempt(account, ip, true)

    const token = await createSessionToken()
    const res = NextResponse.json({ success: true })

    // Set secure httpOnly cookie valid for 30 days
    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return res
  } catch (err: any) {
    console.error('Authentication handler error:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal authentication error' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: 'Logged out' })
  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
