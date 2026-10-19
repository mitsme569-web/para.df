const COOKIE_NAME = 'paradf_session'

// Pattern: exactly 6 digits with 1 capital letter in the 4th position (e.g. 123A456)
export const PIN_FORMAT_REGEX = /^[0-9]{3}[A-Z][0-9]{3}$/

export function isValidPinFormat(pin: string): boolean {
  return PIN_FORMAT_REGEX.test(pin)
}

function getAuthSecret(): string {
  const secret = process.env.APP_AUTH_SECRET || process.env.APP_PIN
  if (!secret) {
    throw new Error('Authentication secret is not configured. Please define APP_AUTH_SECRET or APP_PIN in your environment variables.')
  }
  return secret
}

/**
 * Generate a cryptographic HMAC-SHA256 signature using standard Web Crypto API.
 * Works natively in Next.js Edge Middleware and Node.js without any dependencies.
 */
async function sign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Creates a signed session token storing timestamp and HMAC signature.
 */
export async function createSessionToken(): Promise<string> {
  const secret = getAuthSecret()
  const timestamp = Date.now().toString()
  const signature = await sign(timestamp, secret)
  return `${timestamp}.${signature}`
}

/**
 * Verifies that the session token has a valid signature and has not expired.
 * Cookie lasts for 30 days so users don't have to keep re-entering the PIN.
 */
export async function verifySessionToken(token?: string | null): Promise<boolean> {
  if (!token) return false
  const [timestamp, signature] = token.split('.')
  if (!timestamp || !signature) return false

  let secret: string
  try {
    secret = getAuthSecret()
  } catch {
    return false
  }

  const expectedSig = await sign(timestamp, secret)
  if (signature !== expectedSig) return false

  const time = parseInt(timestamp, 10)
  if (isNaN(time)) return false

  // Valid for 30 days
  const maxAgeMs = 1000 * 60 * 60 * 24 * 30
  if (Date.now() - time > maxAgeMs) return false

  return true
}

export function getAppPin(): string {
  const pin = process.env.APP_PIN
  if (!pin) {
    throw new Error('APP_PIN environment variable is not configured. Set APP_PIN in .env or your deployment secrets.')
  }
  return pin.trim()
}

export { COOKIE_NAME }
