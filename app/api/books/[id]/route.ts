import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { books } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSignedPdfUrl, deletePdf } from '@/lib/supabase'
import { deleteCover } from '@/lib/cloudinary'

// GET /api/books/[id] — get single book with signed PDF URL
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const [book] = await db.select().from(books).where(eq(books.id, id))

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    const pdfUrl = await getSignedPdfUrl(book.pdfKey)

    return NextResponse.json({ ...book, pdfUrl })
  } catch (error) {
    console.error('GET /api/books/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch book' }, { status: 500 })
  }
}

// PATCH /api/books/[id] — update progress
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()

    const [updated] = await db
      .update(books)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(books.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/books/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 })
  }
}

// DELETE /api/books/[id] — delete book + files
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const [book] = await db.select().from(books).where(eq(books.id, id))

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Delete files in parallel
    await Promise.allSettled([
      deletePdf(book.pdfKey),
      book.coverUrl ? deleteCover(id) : Promise.resolve(),
    ])

    // Delete DB record
    await db.delete(books).where(eq(books.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/books/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 })
  }
}
