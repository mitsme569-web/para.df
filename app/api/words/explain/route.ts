import { NextResponse } from 'next/server'
import { isGroqConfigured } from '@/lib/groq'
import { resolveMeaning } from '@/lib/lookup'

// POST /api/words/explain — meaning of a selected word or passage.
// Delegates to the shared resolver: free dictionary for single words it knows,
// Groq AI for longer passages or dictionary misses (simple, low-credit prompt).
// Body: { text, bookTitle?, page? }   Returns: { explanation, source }
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const { text, bookTitle, page } = await request.json()

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const { meaning, source } = await resolveMeaning(text, { bookTitle, page })

    if (!meaning) {
      if (!isGroqConfigured()) {
        return NextResponse.json(
          { error: 'AI is not configured yet. Add GROQ_API_KEY to .env.local and restart.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ explanation: null, source })
    }

    return NextResponse.json({ explanation: meaning, source })
  } catch (error) {
    console.error('POST explain error:', error)
    const message = error instanceof Error ? error.message : 'Failed to explain passage'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
