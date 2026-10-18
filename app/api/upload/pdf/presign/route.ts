import { NextResponse } from 'next/server'
import { createSignedPdfUploadUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

// POST /api/upload/pdf/presign — generate a signed upload URL to upload directly to Supabase Storage
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const key = `pdfs/${crypto.randomUUID()}.pdf`

    const { signedUrl, token } = await createSignedPdfUploadUrl(key)

    return NextResponse.json({
      pdfKey: key,
      signedUrl,
      token,
    })
  } catch (error: any) {
    console.error('POST /api/upload/pdf/presign error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to create presigned upload URL' },
      { status: 500 },
    )
  }
}
