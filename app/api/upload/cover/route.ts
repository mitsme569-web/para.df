import { NextResponse } from 'next/server'
import { uploadCover } from '@/lib/cloudinary'

// POST /api/upload/cover — upload cover image to Cloudinary
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bookId = formData.get('bookId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    if (!bookId) {
      return NextResponse.json({ error: 'No bookId provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const coverUrl = await uploadCover(buffer, bookId)

    return NextResponse.json({ coverUrl })
  } catch (error) {
    console.error('POST /api/upload/cover error:', error)
    return NextResponse.json({ error: 'Failed to upload cover' }, { status: 500 })
  }
}
