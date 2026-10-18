import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { highlights } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await db.delete(highlights).where(eq(highlights.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE highlight error:', error)
    return NextResponse.json({ error: 'Failed to delete highlight' }, { status: 500 })
  }
}
