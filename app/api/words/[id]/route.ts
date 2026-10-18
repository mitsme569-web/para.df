import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { words } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await db.delete(words).where(eq(words.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE word error:', error)
    return NextResponse.json({ error: 'Failed to delete word' }, { status: 500 })
  }
}
