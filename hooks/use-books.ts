'use client'

import { useState, useEffect, useCallback } from 'react'

export interface BookData {
  id: string
  fingerprint: string
  title: string
  fileName: string
  coverUrl: string | null
  pdfKey: string
  pageCount: number
  lastPage: number
  createdAt: string
  updatedAt: string
}

/**
 * Extracts a cover image from the PDF (page 1), uploads it to Cloudinary,
 * and PATCHes the book record. Runs detached in the background so the UI can
 * open the viewer immediately without waiting on this.
 */
async function attachCoverInBackground(buffer: ArrayBuffer, bookId: string) {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.5 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    pdf.destroy()

    const coverBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
    })
    if (!coverBlob) return

    // Upload cover using the real book id, then persist the url on the record.
    const coverForm = new FormData()
    coverForm.append('file', coverBlob, 'cover.jpg')
    coverForm.append('bookId', bookId)
    const coverRes = await fetch('/api/upload/cover', { method: 'POST', body: coverForm })
    if (!coverRes.ok) return
    const { coverUrl } = await coverRes.json()

    await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverUrl }),
    })
  } catch (err) {
    console.error('Background cover extraction failed:', err)
  }
}

/**
 * React hook for books CRUD against the real API.
 */
export function useBooks() {
  const [books, setBooks] = useState<BookData[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/books')
      if (res.ok) {
        const data = await res.json()
        setBooks(Array.isArray(data) ? data : [])
      } else {
        setBooks([])
      }
    } catch (err) {
      console.error('Failed to fetch books:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /**
   * Upload flow — optimized so the reader opens first:
   * 1. Compute fingerprint (SHA-256)
   * 2. Dedup check
   * 3. Upload PDF to storage
   * 4. Read page count (fast, no render)
   * 5. Create book record (cover omitted for now)
   * 6. Return bookId immediately so the UI can navigate to the viewer
   *
   * Cover extraction + upload + save runs detached in the background (step 5→6),
   * so the reader is never blocked by it.
   */
  const addBook = useCallback(
    async (
      file: File,
      onStatus?: (msg: string) => void,
    ): Promise<{ bookId: string; alreadyExists: boolean }> => {
      // 1. Fingerprint
      onStatus?.('Reading file...')
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      // 2. Dedup check
      onStatus?.('Checking for duplicates...')
      const dupRes = await fetch(`/api/books/fingerprint/${fingerprint}`)
      const dupData = await dupRes.json()
      if (dupData.exists) {
        return { bookId: dupData.book.id, alreadyExists: true }
      }

      // 3. Upload PDF to storage
      onStatus?.('Uploading PDF...')
      const pdfForm = new FormData()
      pdfForm.append('file', file)
      const pdfRes = await fetch('/api/upload/pdf', { method: 'POST', body: pdfForm })
      if (!pdfRes.ok) throw new Error('PDF upload failed')
      const { pdfKey } = await pdfRes.json()

      // 4. Page count (load doc metadata only — no canvas render — for speed)
      onStatus?.('Counting pages...')
      let pageCount = 0
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
        const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise
        pageCount = pdf.numPages
        pdf.destroy()
      } catch {
        pageCount = 0
      }

      // 5. Create book record (no cover yet)
      onStatus?.('Saving book...')
      const title = file.name.replace(/\.pdf$/i, '')
      const bookRes = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint,
          title,
          fileName: file.name,
          coverUrl: null,
          pdfKey,
          pageCount,
        }),
      })

      if (!bookRes.ok) throw new Error('Failed to create book record')
      const book = await bookRes.json()

      // 6. Refresh list, then kick off cover work WITHOUT awaiting it.
      await refresh()
      void attachCoverInBackground(buffer, book.id).then(() => refresh())

      return { bookId: book.id, alreadyExists: false }
    },
    [refresh],
  )

  const removeBook = useCallback(
    async (id: string) => {
      await fetch(`/api/books/${id}`, { method: 'DELETE' })
      await refresh()
    },
    [refresh],
  )

  const updateProgress = useCallback(
    async (id: string, lastPage: number) => {
      await fetch(`/api/books/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastPage }),
      })
    },
    [],
  )

  return { books, loading, addBook, removeBook, updateProgress, refresh }
}
