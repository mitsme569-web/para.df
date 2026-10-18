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

/**
 * Classify a book's genre using Groq AI.
 * If the book fits one of the standard default genres, returns it.
 * If not, generates a concise custom genre (e.g., "Technology", "Self-Help", "Poetry", etc.).
 */
export async function classifyWithAi(
  title: string,
  fileName?: string
): Promise<string | null> {
  if (!isGroqConfigured()) return null
  try {
    const prompt = `Classify this book by genre based on its title and filename:
Title: "${title}"
Filename: "${fileName || ''}"

Available standard genres:
- Fiction
- Non-Fiction
- Science
- History
- Philosophy
- Biography
- Classic

If the book clearly belongs to one of these standard genres, reply with that exact genre name.
If it does NOT fit any of these standard genres, create a concise, professional 1-2 word new genre category that fits it best (for example: "Self-Help", "Technology", "Poetry", "Psychology", "Business", "Art", "Cookbook", "Drama", "Economics", "Law", "Medicine", etc.).

Reply ONLY with the genre name, nothing else.`

    const res = await groqChat(
      [
        { role: 'system', content: 'You are an expert librarian and book genre classifier. Reply only with the genre name.' },
        { role: 'user', content: prompt }
      ],
      { temperature: 0.1, maxTokens: 25 }
    )

    const cleaned = res.replace(/[^a-zA-Z\s-]/g, '').trim()
    if (cleaned && cleaned.length <= 25) {
      return cleaned
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')
    }
    return null
  } catch (err) {
    console.warn('AI genre classification error:', err)
    return null
  }
}
