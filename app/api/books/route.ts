import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { books } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

// GET /api/books — list all books
export async function GET() {
  try {
    const allBooks = await db.select().from(books).orderBy(desc(books.updatedAt))
    return NextResponse.json(allBooks)
  } catch (error) {
    console.error('GET /api/books error:', error)
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 })
  }
}

// POST /api/books — create a book record
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { fingerprint, title, fileName, coverUrl, pdfKey, pageCount } = body

    if (!fingerprint || !title || !fileName || !pdfKey || !pageCount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const [book] = await db
      .insert(books)
      .values({
        fingerprint,
        title,
        fileName,
        coverUrl: coverUrl || null,
        pdfKey,
        pageCount,
        lastPage: 1,
      })
      .returning()

    return NextResponse.json(book, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/books error:', error)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Book already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 })
  }
}
