import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { words } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  try {
    const allWords = await db.select().from(words).orderBy(desc(words.createdAt))
    return NextResponse.json(allWords)
  } catch (error) {
    console.error('GET words error:', error)
    return NextResponse.json({ error: 'Failed to fetch words' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { word, meaning, sentence, bookId, page, source } = body
    
    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }
    
    const [saved] = await db.insert(words).values({
      word,
      meaning: meaning || null,
      sentence: sentence || null,
      bookId: bookId || null,
      page: page || null,
      source: source || 'manual',
    }).returning()
    
    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    console.error('POST words error:', error)
    return NextResponse.json({ error: 'Failed to save word' }, { status: 500 })
  }
}
