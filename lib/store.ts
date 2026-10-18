/**
 * IndexedDB storage layer for Paradict.
 * Two object stores:
 *   - `books`  → metadata (id, title, cover, progress, etc.)
 *   - `pdfs`   → raw PDF ArrayBuffers keyed by bookId
 *
 * Designed so we can swap this for Neon + Drizzle later
 * without touching components.
 */

const DB_NAME = 'paradict'
const DB_VERSION = 1

export interface BookRecord {
  id: string
  fingerprint: string
  title: string
  fileName: string
  coverDataUrl: string | null
  pageCount: number
  lastPage: number
  createdAt: number
  updatedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('books')) {
        const store = db.createObjectStore('books', { keyPath: 'id' })
        store.createIndex('fingerprint', 'fingerprint', { unique: true })
        store.createIndex('createdAt', 'createdAt')
      }
      if (!db.objectStoreNames.contains('pdfs')) {
        db.createObjectStore('pdfs') // key = bookId
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ─── Books CRUD ──────────────────────────────────────────────

export async function getAllBooks(): Promise<BookRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly')
    const store = tx.objectStore('books')
    const req = store.getAll()
    req.onsuccess = () => {
      const books = req.result as BookRecord[]
      // Sort newest first
      books.sort((a, b) => b.updatedAt - a.updatedAt)
      resolve(books)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly')
    const req = tx.objectStore('books').get(id)
    req.onsuccess = () => resolve(req.result as BookRecord | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function getBookByFingerprint(fingerprint: string): Promise<BookRecord | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly')
    const idx = tx.objectStore('books').index('fingerprint')
    const req = idx.get(fingerprint)
    req.onsuccess = () => resolve(req.result as BookRecord | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function saveBook(book: BookRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite')
    tx.objectStore('books').put(book)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function updateBook(id: string, updates: Partial<BookRecord>): Promise<void> {
  const existing = await getBook(id)
  if (!existing) throw new Error(`Book ${id} not found`)
  await saveBook({ ...existing, ...updates, updatedAt: Date.now() })
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['books', 'pdfs'], 'readwrite')
    tx.objectStore('books').delete(id)
    tx.objectStore('pdfs').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── PDF binary storage ──────────────────────────────────────

export async function savePdf(bookId: string, data: ArrayBuffer): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pdfs', 'readwrite')
    tx.objectStore('pdfs').put(data, bookId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPdf(bookId: string): Promise<ArrayBuffer | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pdfs', 'readonly')
    const req = tx.objectStore('pdfs').get(bookId)
    req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined)
    req.onerror = () => reject(req.error)
  })
}
