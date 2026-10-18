import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stickyNotes, books } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  try {
    const notes = await db
      .select({
        id: stickyNotes.id,
        content: stickyNotes.content,
        page: stickyNotes.page,
        bgColor: stickyNotes.bgColor,
        textColor: stickyNotes.textColor,
        createdAt: stickyNotes.createdAt,
        bookId: stickyNotes.bookId,
        bookTitle: books.title,
      })
      .from(stickyNotes)
      .leftJoin(books, eq(stickyNotes.bookId, books.id))
      .orderBy(desc(stickyNotes.createdAt))
    
    return NextResponse.json(notes)
  } catch (error) {
    console.error('GET all notes error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}
