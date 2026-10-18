import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a cover image buffer to Cloudinary.
 * Returns the secure URL.
 */
export async function uploadCover(
  buffer: Buffer,
  bookId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'paradict/covers',
        public_id: bookId,
        format: 'jpg',
        transformation: [
          { width: 400, height: 560, crop: 'limit', quality: 'auto' },
        ],
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result!.secure_url)
      },
    )
    stream.end(buffer)
  })
}

/**
 * Delete a cover image from Cloudinary.
 */
export async function deleteCover(bookId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(`paradict/covers/${bookId}`)
  } catch {
    // Ignore if already deleted
  }
}
