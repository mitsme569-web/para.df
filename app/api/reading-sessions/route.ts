import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readingSessions } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { bookId, pagesRead, durationSec } = body
    
    if (!bookId || !pagesRead) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const [session] = await db.insert(readingSessions).values({
      bookId,
      pagesRead,
      durationSec: durationSec || null,
    }).returning()
    
    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    console.error('POST reading-session error:', error)
    return NextResponse.json({ error: 'Failed to log session' }, { status: 500 })
  }
}
