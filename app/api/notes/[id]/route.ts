import { NextResponse } from 'next/server'
import { db, ensureStickyNoteRotationColumn } from '@/lib/db'
import { stickyNotes } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureStickyNoteRotationColumn()
    const { id } = await params
    const body = await request.json()
    
    const [updated] = await db.update(stickyNotes)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(stickyNotes.id, id))
      .returning()
    
    if (!updated) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }
    
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH note error:', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await db.delete(stickyNotes).where(eq(stickyNotes.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE note error:', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
