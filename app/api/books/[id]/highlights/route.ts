import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { highlights } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const page = url.searchParams.get('page')

    if (page) {
      const allHighlights = await db.select().from(highlights)
        .where(and(eq(highlights.bookId, id), eq(highlights.page, parseInt(page))))
      return NextResponse.json(allHighlights)
    }
    
    const allHighlights = await db.select().from(highlights).where(eq(highlights.bookId, id))
    return NextResponse.json(allHighlights)
  } catch (error) {
    console.error('GET highlights error:', error)
    return NextResponse.json({ error: 'Failed to fetch highlights' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { page, text, color, isBold, rects } = body
    
    if (!page || !text || !rects) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const [highlight] = await db.insert(highlights).values({
      bookId: id,
      page,
      text,
      color: color || '#FFFF00',
      isBold: isBold || false,
      rects,
    }).returning()
    
    return NextResponse.json(highlight, { status: 201 })
  } catch (error) {
    console.error('POST highlights error:', error)
    return NextResponse.json({ error: 'Failed to create highlight' }, { status: 500 })
  }
}

// DELETE /api/books/[id]/highlights        — remove ALL highlights for the book
// DELETE /api/books/[id]/highlights?page=N — remove highlights on a single page
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const page = url.searchParams.get('page')

    if (page) {
      await db.delete(highlights)
        .where(and(eq(highlights.bookId, id), eq(highlights.page, parseInt(page))))
    } else {
      await db.delete(highlights).where(eq(highlights.bookId, id))
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE highlights error:', error)
    return NextResponse.json({ error: 'Failed to delete highlights' }, { status: 500 })
  }
}
