/**
 * PDF utilities using pdfjs-dist.
 * - Extract the first page as a cover image (data URL)
 * - Get the total page count
 */
import * as pdfjsLib from 'pdfjs-dist'

// Use the CDN worker to avoid bundling issues with Next.js
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
}

/**
 * Load a PDF document from an ArrayBuffer.
 */
export async function loadPdfDocument(data: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data }).promise
  return pdf
}

/**
 * Extract the first page of a PDF as a JPEG data URL (cover image).
 */
export async function extractCover(data: ArrayBuffer, scale = 1.5): Promise<string> {
  const pdf = await loadPdfDocument(data)
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

  // Clean up
  page.cleanup()
  pdf.destroy()

  return dataUrl
}

/**
 * Get the total number of pages in a PDF.
 */
export async function getPageCount(data: ArrayBuffer): Promise<number> {
  const pdf = await loadPdfDocument(data)
  const count = pdf.numPages
  pdf.destroy()
  return count
}
