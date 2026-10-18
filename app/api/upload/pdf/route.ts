import { NextResponse } from 'next/server'
import { uploadPdf } from '@/lib/supabase'

// POST /api/upload/pdf — upload PDF to Supabase Storage
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'No valid PDF file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate a unique key
    const key = `pdfs/${crypto.randomUUID()}.pdf`

    await uploadPdf(key, buffer)

    return NextResponse.json({ pdfKey: key })
  } catch (error) {
    console.error('POST /api/upload/pdf error:', error)
    return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 })
  }
}

// Allow larger files (up to 50MB)
export const runtime = 'nodejs'
export const maxDuration = 60
