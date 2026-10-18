import { NextResponse } from 'next/server'
import { resolveMeaning } from '@/lib/lookup'

// POST /api/words/define — definition of a selected word or phrase.
// Uses the free external dictionary first; falls back to Groq AI when the text
// is longer than a single word OR the dictionary has no entry. Returns
// { word, meaning, source } where source is 'dictionary' | 'ai' | 'not-found'.
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const { word } = await request.json()

    if (!word || typeof word !== 'string' || !word.trim()) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    const { meaning, source } = await resolveMeaning(word)
    return NextResponse.json({ word: word.trim(), meaning, source })
  } catch (error) {
    console.error('POST define error:', error)
    return NextResponse.json({ error: 'Failed to define word' }, { status: 500 })
  }
}
