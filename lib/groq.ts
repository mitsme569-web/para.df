// ─── Groq AI helper (server-side only) ──────────────────────────────────────
// Uses Groq's OpenAI-compatible Chat Completions API via plain fetch, so no
// extra SDK dependency is required. Import ONLY from API routes (server code) —
// it reads a secret env var that must never reach the browser.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Default model requested for this project. Override with GROQ_MODEL in
// .env.local if your Groq account exposes a different id (the value must match
// an entry in the Groq model catalog shown in the console).
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GroqOptions {
  temperature?: number
  maxTokens?: number
}

/** Returns true when a Groq API key is configured. */
export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}

/**
 * Send a chat completion request to Groq and return the assistant text.
 * Throws a descriptive Error on missing key, HTTP failure, or empty output so
 * callers can surface a friendly message.
 */
export async function groqChat(
  messages: GroqMessage[],
  opts: GroqOptions = {},
): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    throw new Error('GROQ_API_KEY is not set. Add it to .env.local and restart the dev server.')
  }
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 700,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Groq request failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq returned an empty response')
  }
  return content.trim()
}
