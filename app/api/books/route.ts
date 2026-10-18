import { NextResponse } from 'next/server'
import { db, sql, ensureGenreColumn } from '@/lib/db'
import { books } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { classifyBookGenre } from '@/lib/genre'
import { classifyWithAi } from '@/lib/groq'

// GET /api/books — list all books
export async function GET() {
  try {
    await ensureGenreColumn()
    let allBooks: any[]
    try {
      allBooks = await db.select().from(books).orderBy(desc(books.updatedAt))
    } catch (selectErr: any) {
      console.warn('Select with genre column failed, falling back to raw select:', selectErr?.message)
      allBooks = await sql`
        SELECT id, fingerprint, title, file_name as "fileName", cover_url as "coverUrl",
               pdf_key as "pdfKey", page_count as "pageCount", last_page as "lastPage",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM books ORDER BY updated_at DESC;
      `
    }

    // Ensure every book has a classified genre attached
    const enriched = (allBooks || []).map((b) => ({
      ...b,
      genre: b.genre || classifyBookGenre(b),
    }))
    return NextResponse.json(enriched)
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

    await ensureGenreColumn()

    // 1. Check if user provided genre
    // 2. Otherwise try AI classification with Groq
    // 3. Fallback to offline rule-based classifier
    let genre = body.genre
    if (!genre) {
      genre = await classifyWithAi(title, fileName)
    }
    if (!genre) {
      genre = classifyBookGenre({ title, fileName })
    }

    let book: any
    try {
      const [inserted] = await db
        .insert(books)
        .values({
          fingerprint,
          title,
          fileName,
          genre,
          coverUrl: coverUrl || null,
          pdfKey,
          pageCount,
          lastPage: 1,
        })
        .returning()
      book = inserted
    } catch (insertErr: any) {
      console.warn('Initial insert with genre failed, attempting fallback raw insert:', insertErr?.message)
      try {
        const rows = await sql`
          INSERT INTO books (fingerprint, title, file_name, cover_url, pdf_key, page_count, last_page)
          VALUES (${fingerprint}, ${title}, ${fileName}, ${coverUrl || null}, ${pdfKey}, ${pageCount}, 1)
          RETURNING id, fingerprint, title, file_name as "fileName", cover_url as "coverUrl",
                    pdf_key as "pdfKey", page_count as "pageCount", last_page as "lastPage",
                    created_at as "createdAt", updated_at as "updatedAt";
        `
        book = { ...rows[0], genre }
      } catch (rawErr: any) {
        if (rawErr?.code === '23505' || insertErr?.code === '23505') {
          return NextResponse.json({ error: 'Book already exists' }, { status: 409 })
        }
        throw rawErr
      }
    }

    return NextResponse.json(book, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/books error:', error)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Book already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create book', details: error?.message }, { status: 500 })
  }
}
