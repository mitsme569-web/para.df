import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { books } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/books/fingerprint/[hash] — check if a PDF already exists
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.fingerprint, hash))

    if (!book) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({ exists: true, book })
  } catch (error) {
    console.error('GET /api/books/fingerprint error:', error)
    return NextResponse.json({ error: 'Failed to check fingerprint' }, { status: 500 })
  }
}
