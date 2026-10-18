import { NextResponse } from 'next/server'
import { db, ensureStickyNoteRotationColumn } from '@/lib/db'
import { stickyNotes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureStickyNoteRotationColumn()
    const { id } = await params
    const notes = await db.select().from(stickyNotes).where(eq(stickyNotes.bookId, id))
    return NextResponse.json(notes)
  } catch (error) {
    console.error('GET notes error:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureStickyNoteRotationColumn()
    const { id } = await params
    const body = await request.json()
    const { page, content, x, y, width, height, rotation, bgColor, textColor, fontSize, kind } = body
    
    if (page === undefined || x === undefined || y === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const [note] = await db.insert(stickyNotes).values({
      bookId: id,
      page,
      content: content || '',
      x,
      y,
      width: width || 0.2,
      height: height || 0.15,
      rotation: rotation || 0,
      bgColor: bgColor || '#FFFF00',
      textColor: textColor || '#000000',
      fontSize: fontSize || 14,
      kind: kind === 'textbox' ? 'textbox' : 'note',
    }).returning()
    
    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('POST notes error:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
