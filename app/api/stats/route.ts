import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { books, words, stickyNotes, readingSessions } from '@/lib/db/schema'
import { count, sum } from 'drizzle-orm'

export async function GET() {
  try {
    const [bookStats] = await db.select({ total: count() }).from(books)
    const [wordStats] = await db.select({ total: count() }).from(words)
    const [noteStats] = await db.select({ total: count() }).from(stickyNotes)
    const [pageStats] = await db.select({ total: sum(readingSessions.pagesRead) }).from(readingSessions)
    
    return NextResponse.json({
      totalBooks: bookStats?.total || 0,
      totalWords: wordStats?.total || 0,
      totalNotes: noteStats?.total || 0,
      totalPagesRead: Number(pageStats?.total) || 0,
    })
  } catch (error) {
    console.error('GET stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
