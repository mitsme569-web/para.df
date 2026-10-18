import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'pdfs'

/**
 * Upload a PDF buffer to Supabase Storage.
 * Returns the object key.
 */
export async function uploadPdf(key: string, data: Buffer): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, data, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) throw new Error(`Supabase upload failed: ${error.message}`)
  return key
}

/**
 * Generate a signed URL for reading a PDF (valid 1 hour).
 */
export async function getSignedPdfUrl(key: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, 3600) // 1 hour

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message}`)
  }

  return data.signedUrl
}

/**
 * Delete a PDF from Supabase Storage.
 */
export async function deletePdf(key: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([key])

  if (error) {
    console.error('Supabase delete error:', error.message)
  }
}
