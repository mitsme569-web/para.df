'use client'

import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Home, Loader2,
  ZoomIn, ZoomOut, Minimize2, Eye, StickyNote, PanelLeftClose, PanelLeftOpen, Search,
  ChevronLeft, ChevronRight,
  Send, Type, Bold, Underline, Highlighter, Pen, X, Eraser, FileMinus, Undo2, Redo2,
  Save, FolderOpen, MoreVertical, Trash2, GripHorizontal, RotateCw,
  Copy, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'

/* ━━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface BookWithPdf {
  id: string; title: string; pageCount: number; lastPage: number; pdfUrl: string
}
interface Rect { x: number; y: number; w: number; h: number }
/* A normalized glyph run (0–1 of the page) derived from the PDF's real text
   metrics — baseline + font height — so it hugs the visible glyphs and stays
   correct at any zoom. Built once per page and cached for synchronous use. */
interface GlyphBox { x: number; y: number; w: number; h: number }
interface StickyNoteData {
  id: string; page: number; content: string
  x: number; y: number; width: number; height: number
  rotation?: number
  bgColor: string; textColor: string; fontSize: number
  kind?: 'note' | 'textbox'
}
interface HighlightData {
  id: string; page: number; text: string; color: string; isBold: boolean
  rects: Rect[]
}
interface SelectionState {
  x: number; y: number; text: string; rects: Rect[]; page: number; below: boolean
  boundingRect?: { left: number; top: number; right: number; bottom: number }
}
interface MeaningData {
  word: string
  text: string
  x: number
  y: number
  isExplanation?: boolean
  loading?: boolean
}
interface DrawingStroke {
  id: string
  page: number
  color: string
  thickness: number
  points: { x: number; y: number }[]
}

const HIGHLIGHT_COLORS = ['#FFF176', '#A5D6A7', '#90CAF9', '#F48FB1', '#FFCC80', '#CE93D8']
const NOTE_COLORS = ['#FFFF00', '#FFD54F', '#A5D6A7', '#90CAF9', '#F48FB1', '#CE93D8']
const PEN_COLORS = ['#1a1a1a', '#0d4f46', '#dc2626', '#2563eb', '#eab308', '#9333ea']
/* Vertical gap between stacked pages in the continuous-flow reader. The scroll
   pitch (one page + this gap) maps scrollTop → current page number. */
const PAGE_GAP = 24

/* Stable empty arrays — reused so a page with no annotations keeps an identical
   prop reference across renders (lets React.memo skip PageView re-renders). */
const EMPTY_HL: HighlightData[] = []
const EMPTY_NOTES: StickyNoteData[] = []
const EMPTY_DRAWINGS: DrawingStroke[] = []

/**
 * Measures ONLY the text nodes inside the actual textLayer spans that intersect
 * the selection. This guarantees that browser containing-block blowouts, <br> line
 * breaks, and margins are NEVER included in the selection bounding boxes.
 */
/**
 * Accurately extracts client rects for the selected portion of a span.
 * Uses W3C standard boundary-clamping so it works seamlessly for:
 * - Single words or characters at ANY zoom level
 * - Spans with single or multiple text nodes
 * - Transformed spans (scaleX, letter-spacing, etc.)
 * - Large headline fonts and small paragraph fonts alike
 */
function getSpanSelectionRects(span: HTMLElement, range: Range): DOMRect[] {
  try {
    const spanRange = document.createRange()
    spanRange.selectNodeContents(span)

    // Check if the range and span actually overlap
    const startsBeforeSpanEnd = range.compareBoundaryPoints(Range.START_TO_END, spanRange) < 0
    const endsAfterSpanStart = range.compareBoundaryPoints(Range.END_TO_START, spanRange) > 0
    if (!startsBeforeSpanEnd || !endsAfterSpanStart) return []

    // Build the sub-range clamped strictly to this span's boundaries
    const sub = document.createRange()

    // Clamp start: max(range.start, spanRange.start)
    if (range.compareBoundaryPoints(Range.START_TO_START, spanRange) > 0) {
      sub.setStart(range.startContainer, range.startOffset)
    } else {
      sub.setStart(spanRange.startContainer, spanRange.startOffset)
    }

    // Clamp end: min(range.end, spanRange.end)
    if (range.compareBoundaryPoints(Range.END_TO_END, spanRange) < 0) {
      sub.setEnd(range.endContainer, range.endOffset)
    } else {
      sub.setEnd(spanRange.endContainer, spanRange.endOffset)
    }

    if (sub.collapsed) return []

    const rects = Array.from(sub.getClientRects()).filter(r => r.width > 0.5 && r.height > 0.5)
    if (rects.length > 0) return rects

    // Fallback if sub.getClientRects() returned empty: span's bounding box
    const b = span.getBoundingClientRect()
    if (b.width > 1 && b.height > 1) return [b]
  } catch {
    try {
      const b = span.getBoundingClientRect()
      if (b.width > 1 && b.height > 1) return [b]
    } catch {}
  }
  return []
}

/**
 * Gathers exact rendered rectangles for the text selection inside the textLayer.
 * Discards any container blowout or line break artifacts.
 */
function getSelectedTextRects(range: Range, textLayer: HTMLElement): DOMRect[] {
  const rects: DOMRect[] = []
  const spans = Array.from(textLayer.querySelectorAll('span'))

  for (const span of spans) {
    try {
      const spanRects = getSpanSelectionRects(span, range)
      for (const sr of spanRects) {
        if (sr.width > 0.5 && sr.height > 0.5) {
          rects.push(sr)
        }
      }
    } catch {
      continue
    }
  }

  // Fallback to range.getClientRects() if span extraction yielded nothing
  if (rects.length === 0) {
    const parentRect = textLayer.getBoundingClientRect()
    const raw = Array.from(range.getClientRects())
    for (const r of raw) {
      // Discard blowout rects that cover full container
      if (r.width >= parentRect.width * 0.99 && r.height > parentRect.height * 0.5) continue
      if (r.width > 0.5 && r.height > 0.5) rects.push(r)
    }
  }

  return rects
}

/**
 * Converts selected text client rects into normalized (0–1) page coordinates.
 * Clusters rects by visual line using adaptive vertical overlap (no magic 8px buckets).
 * Works reliably at ALL zoom levels (50% to 300%+) for single words, paragraphs,
 * and headlines of any font size.
 */
function computeMetricRects(range: Range, wr: DOMRect, pageWrap?: HTMLElement | null): Rect[] {
  if (!wr || wr.width <= 0 || wr.height <= 0) return []

  const textLayer = pageWrap?.querySelector('.textLayer') as HTMLElement | null
  let raw: DOMRect[] = []
  if (textLayer) {
    raw = getSelectedTextRects(range, textLayer)
  }
  if (raw.length === 0) {
    raw = Array.from(range.getClientRects()).filter(r => r.width > 0.5 && r.height > 0.5)
  }
  if (raw.length === 0) return []

  // Filter out any anomalous full-page container rects
  const valid = raw.filter(r => !(r.width >= wr.width * 0.99 && r.height >= wr.height * 0.5))
  if (valid.length === 0) return []

  // Sort top-to-bottom, left-to-right
  valid.sort((a, b) => a.top - b.top || a.left - b.left)

  // Cluster rects into visual lines based on adaptive vertical overlap
  interface LineCluster {
    left: number
    top: number
    right: number
    bottom: number
  }
  const lines: LineCluster[] = []

  for (const r of valid) {
    let merged = false
    for (const line of lines) {
      const vOverlap = Math.min(line.bottom, r.bottom) - Math.max(line.top, r.top)
      const minH = Math.min(line.bottom - line.top, r.height)
      // If rects vertically overlap by at least 35% of the line height, they're on the same line
      if (vOverlap >= Math.max(2, minH * 0.35)) {
        line.left = Math.min(line.left, r.left)
        line.right = Math.max(line.right, r.right)
        line.top = Math.min(line.top, r.top)
        line.bottom = Math.max(line.bottom, r.bottom)
        merged = true
        break
      }
    }
    if (!merged) {
      lines.push({
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      })
    }
  }

  // Convert each line cluster into normalized coordinates [0, 1] relative to the page wrap
  const rects: Rect[] = []
  for (const line of lines) {
    // Clamp horizontally to page bounds
    const leftPx = Math.max(wr.left, Math.min(wr.right, line.left))
    const rightPx = Math.max(wr.left, Math.min(wr.right, line.right))
    if (rightPx - leftPx < 1) continue

    // Clamp vertically to page bounds
    const topPx = Math.max(wr.top, Math.min(wr.bottom, line.top))
    const bottomPx = Math.max(wr.top, Math.min(wr.bottom, line.bottom))
    if (bottomPx - topPx < 1) continue

    const x = (leftPx - wr.left) / wr.width
    const w = (rightPx - leftPx) / wr.width
    const y = (topPx - wr.top) / wr.height
    const h = (bottomPx - topPx) / wr.height

    if (w > 0.0001 && h > 0.0001) {
      rects.push({
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
        w: Math.max(0, Math.min(1 - x, w)),
        h: Math.max(0, Math.min(1 - y, h)),
      })
    }
  }

  return rects
}


/* ━━━━ Main Viewer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function BookViewerPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookId = params.bookId as string

  const centerRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bookMenuRef = useRef<HTMLDivElement>(null)
  // Per-page normalized glyph boxes (from PDF text metrics), filled by PageView
  // as each page renders and read synchronously when the reader selects text.
  const glyphCacheRef = useRef<Map<number, GlyphBox[]>>(new Map())

  const [book, setBook] = useState<BookWithPdf | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0) // Default fixed 100% zoom
  const [loading, setLoading] = useState(true)
  const [basePageSize, setBasePageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const pageSize = useMemo(() => {
    if (!basePageSize.w || !basePageSize.h) return { w: 0, h: 0 }
    return { w: Math.floor(basePageSize.w * scale), h: Math.floor(basePageSize.h * scale) }
  }, [basePageSize, scale])

  const changeZoom = useCallback((newScale: number | ((prev: number) => number)) => {
    setScale(curr => {
      const next = typeof newScale === 'function' ? newScale(curr) : newScale
      const clamped = Math.max(0.5, Math.min(5.0, Math.round(next * 100) / 100))
      if (clamped === curr) return curr
      const el = centerRef.current
      if (el && curr > 0) {
        const ratio = clamped / curr
        // Scale scrollTop relative to the viewport center so reading position stays locked
        const targetScrollTop = (el.scrollTop + el.clientHeight / 2) * ratio - el.clientHeight / 2
        requestAnimationFrame(() => {
          if (el) el.scrollTop = Math.max(0, targetScrollTop)
        })
      }
      return clamped
    })
  }, [])

  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map())
  const [showAnnotations, setShowAnnotations] = useState(true)

  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [activeColor, setActiveColor] = useState(HIGHLIGHT_COLORS[0])
  const [penToolsOpen, setPenToolsOpen] = useState(false)
  const [eraseMode, setEraseMode] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [hlThickness, setHlThickness] = useState(1)

  const togglePenTools = useCallback(() => {
    setPenToolsOpen(prev => {
      if (prev) {
        setPenMode(false)
        setPaletteOpen(false)
      }
      return !prev
    })
  }, [])

  // Pen tool (freehand drawing) states
  const [penMode, setPenMode] = useState(false)
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [penThickness, setPenThickness] = useState(2.5)
  const [penEraseMode, setPenEraseMode] = useState(false)
  const [drawings, setDrawings] = useState<DrawingStroke[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [meaning, setMeaning] = useState<MeaningData | null>(null)

  const getSidewaysPosition = useCallback((bb?: { left: number; top: number; right: number; bottom: number }) => {
    const cardW = 265
    const cardH = 175
    const margin = 12

    if (!bb) {
      return {
        x: Math.max(16, window.innerWidth - cardW - 24),
        y: 72,
      }
    }

    // Determine horizontal position: prefer placing sideways to the right
    let x = bb.right + margin
    if (x + cardW > window.innerWidth - 16) {
      // If right side would overflow screen, try placing to the left of the selection
      if (bb.left - cardW - margin > 16) {
        x = bb.left - cardW - margin
      } else {
        // Dock to right side with padding
        x = Math.max(16, window.innerWidth - cardW - 20)
      }
    }

    // Vertically: align with top of selection, strictly clamped below the top bar (min 68px)
    let y = Math.max(68, Math.min(window.innerHeight - cardH - 24, bb.top))
    return { x, y }
  }, [])
  const [journalOpen, setJournalOpen] = useState(false)
  const [allNotes, setAllNotes] = useState<StickyNoteData[]>([])
  const [allHighlights, setAllHighlights] = useState<HighlightData[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [newTextId, setNewTextId] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [bookMenuOpen, setBookMenuOpen] = useState(false)
  const [deletingBook, setDeletingBook] = useState(false)

  // Load drawings from localStorage
  useEffect(() => {
    if (!bookId) return
    try {
      const saved = localStorage.getItem(`paradict_drawings_${bookId}`)
      if (saved) setDrawings(JSON.parse(saved))
    } catch {}
  }, [bookId])

  const saveDrawings = useCallback((next: DrawingStroke[]) => {
    setDrawings(next)
    try {
      localStorage.setItem(`paradict_drawings_${bookId}`, JSON.stringify(next))
    } catch {}
  }, [bookId])

  const addStroke = useCallback((stroke: DrawingStroke) => {
    setDrawings(prev => {
      const next = [...prev, stroke]
      try { localStorage.setItem(`paradict_drawings_${bookId}`, JSON.stringify(next)) } catch {}
      return next
    })
  }, [bookId])

  const deleteStroke = useCallback((id: string) => {
    setDrawings(prev => {
      const next = prev.filter(s => s.id !== id)
      try { localStorage.setItem(`paradict_drawings_${bookId}`, JSON.stringify(next)) } catch {}
      return next
    })
  }, [bookId])

  const clearPageDrawings = useCallback((page: number) => {
    setDrawings(prev => {
      const next = prev.filter(s => s.page !== page)
      try { localStorage.setItem(`paradict_drawings_${bookId}`, JSON.stringify(next)) } catch {}
      return next
    })
  }, [bookId])

  const clearAllDrawings = useCallback(() => {
    setDrawings([])
    try { localStorage.removeItem(`paradict_drawings_${bookId}`) } catch {}
  }, [bookId])

  // Undo / redo of annotation operations within this session
  type Op = { type: 'add-highlight' | 'add-note' | 'del-highlight' | 'del-note'; payload: any }
  const undoStack = useRef<Op[]>([])
  const redoStack = useRef<Op[]>([])

  /* ─── Load book + PDF ──────────────────────────── */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/books/${bookId}`)
        if (!res.ok) { router.push('/books'); return }
        const data: BookWithPdf = await res.json()
        if (cancelled) return
        setBook(data)
        const pageParam = searchParams.get('page')
        setCurrentPage(pageParam ? parseInt(pageParam) : (data.lastPage || 1))

        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

        const doc = await pdfjsLib.getDocument(data.pdfUrl).promise
        if (cancelled) { doc.destroy(); return }
        setPdf(doc)
        setTotalPages(doc.numPages)
        try {
          const p1 = await doc.getPage(1)
          const vp1 = p1.getViewport({ scale: 1 })
          setBasePageSize({ w: Math.floor(vp1.width), h: Math.floor(vp1.height) })
        } catch {}
        setLoading(false)
      } catch (err) {
        console.error('Failed to load book:', err)
        if (!cancelled) router.push('/books')
      }
    }
    load()
    return () => { cancelled = true }
  }, [bookId, router, searchParams])


  /* ─── Lazy thumbnails: render any page on demand when its tile scrolls
         into view. Every page is listed (no sampling), so the sidebar shows
         the true page count and jumps feel small. ─────────────────────── */
  const thumbDone = useRef<Set<number>>(new Set())
  const thumbInflight = useRef<Set<number>>(new Set())
  const requestThumb = useCallback((p: number) => {
    if (!pdf || thumbDone.current.has(p) || thumbInflight.current.has(p)) return
    thumbInflight.current.add(p)
    ;(async () => {
      try {
        const page = await pdf.getPage(p)
        // Render a bit larger than the ~104px tile, then let CSS downscale → crisp.
        const vp = page.getViewport({ scale: 0.5 })
        const c = document.createElement('canvas')
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height)
        await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise
        page.cleanup()
        const url = c.toDataURL('image/jpeg', 0.82)
        thumbDone.current.add(p)
        setThumbs((prev) => new Map(prev).set(p, url))
      } catch { /* skip this tile */ }
      finally { thumbInflight.current.delete(p) }
    })()
  }, [pdf])

  /* ─── Load ALL annotations once (not per page). Each PageView filters these to
         its own page, so highlights/notes stay visible on every page in the stack. */
  useEffect(() => {
    if (!bookId) return
    fetch(`/api/books/${bookId}/notes`).then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllNotes(data) }).catch(() => {})
    fetch(`/api/books/${bookId}/highlights`).then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllHighlights(data) }).catch(() => {})
  }, [bookId])

  /* ─── Continuous flow: derive the current page from scroll position. The reader
         scrolls a vertical stack; whichever page sits at the viewport centre is the
         "current" one — driving the progress bar, page box, sidebar & save. ─── */
  useEffect(() => {
    const el = centerRef.current
    if (!el || !pageSize.h) return
    let raf = 0
    const pitch = pageSize.h + PAGE_GAP
    function onScroll() {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const idx = Math.floor((el!.scrollTop + el!.clientHeight / 2) / pitch)
        const p = Math.max(1, Math.min(totalPages || 1, idx + 1))
        setCurrentPage(prev => (prev === p ? prev : p))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [pageSize.h, totalPages])

  /* On first layout, jump straight to the resumed page (no animation). */
  const didInitScroll = useRef(false)
  useEffect(() => {
    if (didInitScroll.current || !pdf || !pageSize.h || !centerRef.current) return
    didInitScroll.current = true
    centerRef.current.scrollTop = (currentPage - 1) * (pageSize.h + PAGE_GAP)
  }, [pdf, pageSize.h, currentPage])

  /* A page reports its rendered size so the stack computes a stable scroll pitch.
     All pages of a book share dimensions, so the first measurement wins. */
  const handlePageSize = useCallback((_page: number, sz: { w: number; h: number }) => {
    setBasePageSize(prev => {
      const baseW = Math.round(sz.w / scale)
      const baseH = Math.round(sz.h / scale)
      if (Math.abs(prev.w - baseW) < 2 && Math.abs(prev.h - baseH) < 2) return prev
      return { w: baseW, h: baseH }
    })
  }, [scale])


  /* ─── Save reading progress ────────────────────── */
  useEffect(() => {
    if (!book || currentPage <= 0) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      fetch(`/api/books/${bookId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastPage: currentPage }),
      }).catch(console.error)
    }, 800)
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [bookId, book, currentPage])

  /* ─── Navigation ───────────────────────────────── */
  /* In continuous flow a "page change" is just a smooth scroll to that page's
     slot in the stack. The scroll listener re-derives currentPage from position. */
  const goToPage = useCallback((p: number) => {
    const target = Math.max(1, Math.min(p, totalPages || 1))
    setCurrentPage(target)
    const el = centerRef.current
    if (el && pageSize.h) el.scrollTo({ top: (target - 1) * (pageSize.h + PAGE_GAP), behavior: 'smooth' })
  }, [totalPages, pageSize.h])
  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage])
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage])

  const [pageInput, setPageInput] = useState(String(currentPage || 1))
  const [isPageInputFocused, setIsPageInputFocused] = useState(false)

  // Sync input value with currentPage when not actively focused/typing
  useEffect(() => {
    if (!isPageInputFocused) {
      setPageInput(String(currentPage))
    }
  }, [currentPage, isPageInputFocused])

  const commitPageInput = useCallback(() => {
    const p = parseInt(pageInput.trim(), 10)
    if (!isNaN(p)) {
      const clamped = Math.max(1, Math.min(totalPages || 1, p))
      goToPage(clamped)
      setPageInput(String(clamped))
    } else {
      setPageInput(String(currentPage))
    }
  }, [pageInput, totalPages, goToPage, currentPage])

  /* ─── Keyboard: scroll continuously through the stack.
         ArrowDown / PageDown / Space flow past one page into the next. ─── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      const el = centerRef.current
      if (!el) return
      const line = 60
      const screen = Math.round(el.clientHeight * 0.85)
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); el.scrollBy({ top: line, behavior: 'smooth' }); break
        case 'ArrowUp': e.preventDefault(); el.scrollBy({ top: -line, behavior: 'smooth' }); break
        case 'PageDown': case ' ': e.preventDefault(); el.scrollBy({ top: screen, behavior: 'smooth' }); break
        case 'PageUp': e.preventDefault(); el.scrollBy({ top: -screen, behavior: 'smooth' }); break
        case 'ArrowRight': e.preventDefault(); el.scrollBy({ left: line, behavior: 'smooth' }); break
        case 'ArrowLeft': e.preventDefault(); el.scrollBy({ left: -line, behavior: 'smooth' }); break
        case '+': case '=': e.preventDefault(); changeZoom(s => s + 0.25); break
        case '-': e.preventDefault(); changeZoom(s => s - 0.25); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [changeZoom])

  /* ─── Track the page's real edges so the floating arrows stay symmetric around it ─── */
  const [pageBox, setPageBox] = useState<{ left: number; right: number; centerY: number; vw: number } | null>(null)
  useEffect(() => {
    const el = centerRef.current
    const page = el?.querySelector('[data-page="' + currentPage + '"]') as HTMLElement | null
    if (!el || !page || !pageSize.w) return
    let raf = 0
    function measure() {
      const cr = el!.getBoundingClientRect()
      const pr = page!.getBoundingClientRect()
      // Use the page's ACTUAL painted edges (not a center-derived estimate) so the
      // two arrows mirror each other exactly, unaffected by the scrollbar gutter.
      setPageBox({ left: pr.left, right: pr.right, centerY: cr.top + cr.height / 2, vw: window.innerWidth })
    }
    const scheduleMeasure = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        measure()
      })
    }
    measure()
    const ro = new ResizeObserver(scheduleMeasure)
    ro.observe(el); ro.observe(page)
    window.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', scheduleMeasure, true)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [pageSize.w, currentPage])

  /* ─── Text selection detection (onMouseUp) ─────────────────────────
     Uses computeMetricRects to get exact span-bounded highlight rects.
     Opens floating toolbar so user can highlight, look up word, or send to Claude. */
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (penMode) return // In pen drawing mode, don't trigger text selection toolbar
    const target = e.target as HTMLElement
    if (target.closest('[data-no-select]')) return

    const sel = window.getSelection()
    let text = sel?.toString().trim() || ''

    // If user clicked directly on a textLayer span (e.g. headline or single word) without dragging
    if (!text && target) {
      const span = target.closest('.textLayer span') as HTMLElement | null
      if (span && span.textContent?.trim()) {
        const r = document.createRange()
        r.selectNodeContents(span)
        sel?.removeAllRanges()
        sel?.addRange(r)
        text = span.textContent.trim()
      }
    }

    if (!sel || !text || sel.rangeCount === 0) {
      setSelection(null)
      return
    }

    const range = sel.getRangeAt(0)
    const startEl = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer as HTMLElement
    const endEl = range.endContainer.nodeType === Node.TEXT_NODE
      ? range.endContainer.parentElement
      : range.endContainer as HTMLElement

    const wrap = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer as HTMLElement)?.closest('[data-page-wrap]')
      || startEl?.closest('[data-page-wrap]')
      || endEl?.closest('[data-page-wrap]') as HTMLElement | null

    if (!wrap) { setSelection(null); return }
    const selPage = parseInt(wrap.getAttribute('data-page') || '1', 10)
    const wr = wrap.getBoundingClientRect()
    const rects = computeMetricRects(range, wr, wrap as HTMLElement)
    if (rects.length === 0) { setSelection(null); return }

    const bb = range.getBoundingClientRect()
    // Clamp horizontally so the floating toolbar never spills off the viewport edges.
    const x = Math.min(Math.max(bb.left + bb.width / 2, 130), window.innerWidth - 130)
    // Flip toolbar below if near the top
    const below = bb.top < 120
    const y = below ? bb.bottom + 12 : Math.max(bb.top - 10, 64)
    setSelection({
      x, y, text, rects, page: selPage, below,
      boundingRect: {
        left: bb.left,
        top: bb.top,
        right: bb.right,
        bottom: bb.bottom,
      },
    })
  }, [penMode])

  /* ─── Highlight actions ────────────────────────── */
  const addHighlight = async (color: string, isBold = false) => {
    if (!selection) return
    try {
      const res = await fetch(`/api/books/${bookId}/highlights`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: selection.page, text: selection.text, color, isBold, rects: selection.rects }),
      })
      const created = await res.json()
      setAllHighlights((prev) => [...prev, created])
      undoStack.current.push({ type: 'add-highlight', payload: created })
      redoStack.current = []
      window.getSelection()?.removeAllRanges()
      setSelection(null)
    } catch (err) { console.error(err) }
  }

  /* ─── Save word / look up meaning ──────────────── */
  const lookupWord = async (mode: 'save' | 'peek') => {
    if (!selection) return
    const sel = selection
    const word = sel.text.split(/\s+/).length === 1 ? sel.text : sel.text.trim()
    const pos = getSidewaysPosition(sel.boundingRect)

    if (mode === 'peek') {
      setMeaning({ word, text: 'Looking up definition…', x: pos.x, y: pos.y, loading: true })
    }

    try {
      const defRes = await fetch('/api/words/define', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const { meaning: def } = await defRes.json()
      if (mode === 'peek') {
        setMeaning({ word, text: def || 'No definition found.', x: pos.x, y: pos.y, loading: false })
      }
      if (mode === 'save' || mode === 'peek') {
        await fetch('/api/words', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, meaning: def || null, sentence: null, bookId, page: currentPage, source: 'saved' }),
        })
      }
      window.getSelection()?.removeAllRanges()
      setSelection(null)
    } catch (err) {
      console.error(err)
      if (mode === 'peek') {
        setMeaning({ word, text: 'Could not fetch definition.', x: pos.x, y: pos.y, loading: false })
      }
    }
  }

  /* ─── AI explanation (Groq) ────────────────────
     Explains the selected passage in-app via /api/words/explain and shows the
     answer in the peek card. Replaces the old "Send to Claude" external redirect. */
  const explainPassage = async (text: string) => {
    if (!selection) return
    const sel = selection
    const pos = getSidewaysPosition(sel.boundingRect)
    setSelection(null)
    setMeaning({ word: 'Explanation', text: 'Analyzing text…', x: pos.x, y: pos.y, isExplanation: true, loading: true })
    try {
      const res = await fetch('/api/words/explain', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, bookTitle: book?.title, page: currentPage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to explain passage.')
      setMeaning({ word: 'Explanation', text: data.explanation || 'No explanation returned.', x: pos.x, y: pos.y, isExplanation: true, loading: false })
    } catch (err) {
      setMeaning({ word: 'Explanation', text: err instanceof Error ? err.message : 'Something went wrong.', x: pos.x, y: pos.y, isExplanation: true, loading: false })
    }
  }

  /* ─── Sticky note CRUD ─────────────────────────── */
  const noteSize = (kind: 'note' | 'textbox') =>
    kind === 'textbox' ? { w: 0.25, h: 0.1 } : { w: 0.15, h: 0.2 }

  const addStickyNote = async (kind: 'note' | 'textbox' = 'note', pos?: { x: number; y: number }, targetPage?: number) => {
    try {
      const pageToUse = targetPage ?? currentPage
      const isBox = kind === 'textbox'
      const size = noteSize(kind)
      const x = pos ? pos.x : (isBox ? 0.3 : 0.55)
      const y = pos ? pos.y : (isBox ? 0.12 : 0.1)
      const res = await fetch(`/api/books/${bookId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pageToUse, content: '',
          x, y, width: size.w, height: size.h,
          rotation: 0,
          bgColor: isBox ? 'transparent' : NOTE_COLORS[0],
          textColor: '#000000', fontSize: 14, kind,
        }),
      })
      const note: StickyNoteData = await res.json()
      setAllNotes((prev) => [...prev, note])
      setActiveNoteId(note.id)
      setNewTextId(note.id) // new notes and text boxes open straight into edit mode
      undoStack.current.push({ type: 'add-note', payload: note })
      redoStack.current = []
    } catch (err) { console.error(err) }
  }

  /* ─── Drag-to-place: grab a note/text icon and drop it on the page ─── */
  const [placing, setPlacing] = useState<null | 'note' | 'textbox'>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const ghostSizeRef = useRef({ w: 160, h: 120 })
  const placeStart = useRef({ x: 0, y: 0 })

  const positionGhost = (kind: 'note' | 'textbox', cx: number, cy: number) => {
    if (!ghostRef.current) return
    const { w, h } = ghostSizeRef.current
    ghostRef.current.style.transform = `translate(${cx - w / 2}px, ${cy - h / 2}px)`
  }

  /* Detect which PDF page sits under (clientX, clientY) so dragged annotations
     are locked directly to the specific page they were dropped on. */
  const findPageAtPoint = (clientX: number, clientY: number) => {
    // 1. Hit-test element directly under cursor
    const el = document.elementFromPoint(clientX, clientY)
    const wrap = el?.closest('[data-page-wrap]') as HTMLElement | null
    if (wrap) {
      const page = parseInt(wrap.getAttribute('data-page') || '', 10)
      if (!isNaN(page)) return { page, wrap }
    }
    const stage = el?.closest('[data-stage]') as HTMLElement | null
    if (stage) {
      const page = parseInt(stage.getAttribute('data-stage') || '', 10)
      const stageWrap = stage.querySelector('[data-page-wrap]') as HTMLElement | null
      if (!isNaN(page) && stageWrap) return { page, wrap: stageWrap }
    }

    // 2. Direct vertical overlap with visible page wraps in the scroll stack
    const allWraps = Array.from(document.querySelectorAll('[data-page-wrap]')) as HTMLElement[]
    for (const w of allWraps) {
      const r = w.getBoundingClientRect()
      if (clientY >= r.top && clientY <= r.bottom) {
        const page = parseInt(w.getAttribute('data-page') || '', 10)
        if (!isNaN(page)) return { page, wrap: w }
      }
    }

    // 3. Fallback: closest page wrap by Euclidean distance
    let bestWrap: HTMLElement | null = null
    let bestDist = Infinity
    for (const w of allWraps) {
      const r = w.getBoundingClientRect()
      const dx = Math.max(r.left - clientX, 0, clientX - r.right)
      const dy = Math.max(r.top - clientY, 0, clientY - r.bottom)
      const dist = Math.hypot(dx, dy)
      if (dist < bestDist) {
        bestDist = dist
        bestWrap = w
      }
    }
    if (bestWrap) {
      const page = parseInt(bestWrap.getAttribute('data-page') || '', 10)
      if (!isNaN(page)) return { page, wrap: bestWrap }
    }

    // 4. Default to current page wrap
    const fallbackWrap = document.querySelector(`[data-page="${currentPage}"][data-page-wrap]`) as HTMLElement | null
    return { page: currentPage, wrap: fallbackWrap }
  }

  const placeAtPoint = (kind: 'note' | 'textbox', clientX: number, clientY: number) => {
    const { page, wrap } = findPageAtPoint(clientX, clientY)
    const size = noteSize(kind)
    if (!wrap) {
      addStickyNote(kind, undefined, page)
      return
    }
    const r = wrap.getBoundingClientRect()
    let x = (clientX - r.left) / r.width - size.w / 2
    let y = (clientY - r.top) / r.height - size.h / 2
    x = Math.max(-5.0, Math.min(6.0, x))
    y = Math.max(-2.0, Math.min(3.0, y))
    addStickyNote(kind, { x, y }, page)
  }

  const beginPlace = (kind: 'note' | 'textbox') => (e: React.MouseEvent) => {
    e.preventDefault()
    placeStart.current = { x: e.clientX, y: e.clientY }
    const size = noteSize(kind)
    ghostSizeRef.current = { w: (pageSize.w || 600) * size.w, h: (pageSize.h || 800) * size.h }
    setPlacing(kind)
    requestAnimationFrame(() => positionGhost(kind, e.clientX, e.clientY))
    const move = (me: MouseEvent) => positionGhost(kind, me.clientX, me.clientY)
    const up = (me: MouseEvent) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      setPlacing(null)
      const dist = Math.hypot(me.clientX - placeStart.current.x, me.clientY - placeStart.current.y)
      if (dist < 6) addStickyNote(kind) // a plain click still adds at a default spot on currentPage
      else placeAtPoint(kind, me.clientX, me.clientY)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const updateNote = useCallback(async (id: string, updates: Partial<StickyNoteData>) => {
    setAllNotes((prev) => prev.map(n => n.id === id ? { ...n, ...updates } : n))
    await fetch(`/api/notes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }).catch(console.error)
  }, [])
  const deleteNote = useCallback(async (id: string) => {
    const existing = allNotes.find(n => n.id === id)
    await fetch(`/api/notes/${id}`, { method: 'DELETE' }).catch(console.error)
    setAllNotes(prev => prev.filter(n => n.id !== id))
    if (existing) undoStack.current.push({ type: 'del-note', payload: existing })
  }, [allNotes])
  const deleteHighlight = useCallback(async (id: string) => {
    const existing = allHighlights.find(h => h.id === id)
    await fetch(`/api/highlights/${id}`, { method: 'DELETE' }).catch(console.error)
    setAllHighlights(prev => prev.filter(h => h.id !== id))
    if (existing) undoStack.current.push({ type: 'del-highlight', payload: existing })
  }, [allHighlights])

  /* Remove every highlight in the book, or just on the current page. */
  const clearAllHighlights = async () => {
    try {
      await fetch(`/api/books/${bookId}/highlights`, { method: 'DELETE' })
      setAllHighlights([])
    } catch (err) { console.error(err) }
  }
  const clearPageHighlights = async () => {
    try {
      await fetch(`/api/books/${bookId}/highlights?page=${currentPage}`, { method: 'DELETE' })
      setAllHighlights(prev => prev.filter(h => h.page !== currentPage))
    } catch (err) { console.error(err) }
  }

  /* ─── Undo / redo ──────────────────────────────── */
  const undo = async () => {
    const op = undoStack.current.pop()
    if (!op) return
    redoStack.current.push(op)
    if (op.type === 'add-highlight') { await fetch(`/api/highlights/${op.payload.id}`, { method: 'DELETE' }); setAllHighlights(p => p.filter(h => h.id !== op.payload.id)) }
    if (op.type === 'add-note') { await fetch(`/api/notes/${op.payload.id}`, { method: 'DELETE' }); setAllNotes(p => p.filter(n => n.id !== op.payload.id)) }
    if (op.type === 'del-highlight') { const r = await fetch(`/api/books/${bookId}/highlights`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) }); const created = await r.json(); setAllHighlights(p => [...p, created]) }
    if (op.type === 'del-note') { const r = await fetch(`/api/books/${bookId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) }); const created = await r.json(); setAllNotes(p => [...p, created]) }
  }
  const redo = async () => {
    const op = redoStack.current.pop()
    if (!op) return
    undoStack.current.push(op)
    if (op.type === 'add-highlight') { const r = await fetch(`/api/books/${bookId}/highlights`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) }); const created = await r.json(); setAllHighlights(p => [...p, created]) }
    if (op.type === 'add-note') { const r = await fetch(`/api/books/${bookId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op.payload) }); const created = await r.json(); setAllNotes(p => [...p, created]) }
    if (op.type === 'del-highlight') { await fetch(`/api/highlights/${op.payload.id}`, { method: 'DELETE' }); setAllHighlights(p => p.filter(h => h.id !== op.payload.id)) }
    if (op.type === 'del-note') { await fetch(`/api/notes/${op.payload.id}`, { method: 'DELETE' }); setAllNotes(p => p.filter(n => n.id !== op.payload.id)) }
  }

  /* ─── Book "More" menu: close on outside click ─── */
  useEffect(() => {
    if (!bookMenuOpen) return
    function onClick(e: MouseEvent) {
      if (bookMenuRef.current && !bookMenuRef.current.contains(e.target as Node)) {
        setBookMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [bookMenuOpen])

  const deleteBook = async () => {
    if (!book || deletingBook) return
    if (!confirm(`Delete "${book.title}"? This removes the PDF, cover, and all annotations. This can't be undone.`)) return
    setBookMenuOpen(false)
    setDeletingBook(true)
    try {
      await fetch(`/api/books/${bookId}`, { method: 'DELETE' })
      router.push('/books')
    } catch (err) {
      console.error('Failed to delete book:', err)
      setDeletingBook(false)
    }
  }

  const handleSave = async () => {
    await fetch('/api/reading-sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, pagesRead: 1, durationSec: null }),
    }).catch(console.error)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  /* Stable per-page annotation lists. Rebuilding these inline (`allHighlights
     .filter(...)`) hands every PageView a brand-new array on each render, which
     defeats React.memo and re-renders the whole page stack — the main cost behind
     the ~600ms lag when the selection toolbar opens. Memoizing keeps references
     stable so a selection-only change skips the pages entirely. */
  const hlByPage = useMemo(() => {
    const m = new Map<number, HighlightData[]>()
    for (const h of allHighlights) { const a = m.get(h.page); if (a) a.push(h); else m.set(h.page, [h]) }
    return m
  }, [allHighlights])
  const notesByPage = useMemo(() => {
    const m = new Map<number, StickyNoteData[]>()
    for (const n of allNotes) { const a = m.get(n.page); if (a) a.push(n); else m.set(n.page, [n]) }
    return m
  }, [allNotes])
  const drawingsByPage = useMemo(() => {
    const m = new Map<number, DrawingStroke[]>()
    for (const d of drawings) { const a = m.get(d.page); if (a) a.push(d); else m.set(d.page, [d]) }
    return m
  }, [drawings])

  /* ─── Loading ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-white/30 animate-spin" />
          <span className="text-sm text-white/40">Loading book...</span>
        </div>
      </div>
    )
  }

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0

  return (
    <div className="flex flex-col h-screen bg-[#121212] overflow-hidden" onMouseUp={handleMouseUp}>

      {/* ━━━━ TOP BAR (cream) ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center justify-between px-3 sm:px-4 h-12 shrink-0 border-b border-black/[0.08]" style={{ background: '#faf8f0' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={() => router.push('/books')} className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-black/[0.06] transition-colors" title="Library">
            <Home className="h-4 w-4 text-brand-dark/70" />
          </button>
          <span className="text-[13px] text-brand-dark/80 font-medium truncate max-w-[220px] sm:max-w-[420px]">{book?.title}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={prevPage} disabled={currentPage <= 1} title="Previous page"
              className="h-7 w-7 rounded flex items-center justify-center text-brand-dark/60 hover:text-brand-dark hover:bg-black/[0.06] disabled:opacity-30 disabled:pointer-events-none">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInput}
              onFocus={e => {
                setIsPageInputFocused(true)
                e.target.select()
              }}
              onBlur={() => {
                setIsPageInputFocused(false)
                commitPageInput()
              }}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '')
                setPageInput(val)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitPageInput()
                  ;(e.target as HTMLInputElement).blur()
                } else if (e.key === 'Escape') {
                  setPageInput(String(currentPage))
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              aria-label="Current page"
              className="w-12 h-7 rounded bg-brand-teal text-white text-center text-[12px] font-bold focus:outline-none focus:ring-1 focus:ring-white/40 transition-all select-all shadow-inner"
            />
            <span
              onClick={() => goToPage(totalPages)}
              title="Click to jump to last page"
              className="text-[11px] text-white bg-brand-dark/85 rounded px-2 py-1 font-semibold cursor-pointer hover:bg-black transition-colors select-none"
            >
              {totalPages}
            </span>
            <button onClick={nextPage} disabled={currentPage >= totalPages} title="Next page"
              className="h-7 w-7 rounded flex items-center justify-center text-brand-dark/60 hover:text-brand-dark hover:bg-black/[0.06] disabled:opacity-30 disabled:pointer-events-none">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="w-px h-5 bg-brand-dark/10 mx-1" />
          <button onClick={() => changeZoom(s => s - 0.25)} className="h-7 w-7 rounded flex items-center justify-center text-brand-dark/50 hover:text-brand-dark hover:bg-black/[0.06]" title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-[11px] text-brand-dark/50 w-12 text-center font-medium cursor-pointer hover:text-brand-dark" onClick={() => changeZoom(1.0)} title="Click to reset to 100%">{Math.round(scale * 100)}%</span>
          <button onClick={() => changeZoom(s => s + 0.25)} className="h-7 w-7 rounded flex items-center justify-center text-brand-dark/50 hover:text-brand-dark hover:bg-black/[0.06]" title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-brand-dark/10 mx-1" />
          <button onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.() }} className="h-7 w-7 rounded flex items-center justify-center text-brand-dark/50 hover:text-brand-dark hover:bg-black/[0.06]" title="Fullscreen">
            <Minimize2 className="h-4 w-4" />
          </button>
          <button onClick={() => setShowAnnotations(v => !v)} className={cn('h-7 w-7 rounded flex items-center justify-center hover:bg-black/[0.06]', showAnnotations ? 'text-brand-teal' : 'text-brand-dark/40')} title="Toggle annotations">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={togglePenTools} className={cn('h-7 w-7 rounded flex items-center justify-center transition-colors', penToolsOpen ? 'text-white bg-brand-teal hover:bg-brand-teal-mid' : 'text-brand-dark/50 hover:text-brand-dark hover:bg-black/[0.06]')} title="Annotation & Drawing tools">
            <Pen className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-brand-dark/10 mx-1" />
          <button onClick={undo} className="h-7 w-7 rounded flex items-center justify-center text-brand-dark/50 hover:text-brand-dark hover:bg-black/[0.06]" title="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={redo} className="h-7 w-7 rounded flex items-center justify-center text-brand-dark/50 hover:text-brand-dark hover:bg-black/[0.06]" title="Redo">
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-teal text-white text-[12px] font-medium hover:bg-brand-teal-mid transition-colors">
            <Save className="h-3.5 w-3.5" /> {savedFlash ? 'Saved!' : 'Save'}
          </button>
          <button onClick={() => setJournalOpen(v => !v)} className="h-8 w-8 rounded flex items-center justify-center text-brand-dark/60 hover:bg-black/[0.06]" title="Journal">
            <FolderOpen className="h-4 w-4" />
          </button>
          <div className="relative" ref={bookMenuRef}>
            <button onClick={() => setBookMenuOpen(v => !v)} aria-label="More options"
              className={cn('h-8 w-8 rounded flex items-center justify-center hover:bg-black/[0.06]', bookMenuOpen ? 'bg-black/[0.06] text-brand-dark' : 'text-brand-dark/60')} title="More">
              <MoreVertical className="h-4 w-4" />
            </button>
            {bookMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 z-50 overflow-hidden rounded-xl border border-black/10 bg-[#faf8f0] shadow-2xl">
                <button onClick={deleteBook} disabled={deletingBook}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed">
                  {deletingBook
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                  {deletingBook ? 'Deleting…' : 'Delete Book'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ━━━━ PROGRESS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="h-[2px] bg-white/[0.04] shrink-0">
        <div className="h-full bg-brand-teal transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* ━━━━ 3-COLUMN LAYOUT ━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* LEFT — Thumbnails: every page, rendered lazily as it scrolls in.
            Toggled open/closed with the panel (sidebar) icon on the tool pill. */}
        {sidebarOpen && (
        <div className="hidden sm:flex flex-col w-[128px] shrink-0 overflow-y-auto border-r border-black/10 py-3 px-2.5 gap-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.2)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-black/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent" style={{ background: '#faf8f0' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Thumb key={p} page={p} url={thumbs.get(p)} active={currentPage === p}
              onRequest={requestThumb} onClick={() => goToPage(p)} />
          ))}
        </div>
        )}

        {/* CENTER — continuous vertical page stack. Only a window of pages around
            the current one is mounted; top/bottom spacers preserve total scroll height. */}
        <div
          ref={centerRef}
          onMouseDown={(e) => {
            if (!(e.target as HTMLElement).closest('[data-note-overlay]')) {
              setActiveNoteId(null)
              setNewTextId(null)
            }
          }}
          className={cn("flex-1 overflow-auto relative", penMode && "pen-mode-active")}
          style={{ background: '#2a2a2a' }}
        >
          {(() => {
            const pitch = pageSize.h + PAGE_GAP
            const BEFORE = 3, AFTER = 5
            const lo = Math.max(1, currentPage - BEFORE)
            const hi = Math.min(totalPages, currentPage + AFTER)
            const pages: number[] = []
            for (let p = lo; p <= hi; p++) pages.push(p)
            return (
              <div className="flex flex-col items-center">
                {lo > 1 && <div style={{ height: (lo - 1) * pitch }} />}
                {pages.map(p => (
                  <PageView key={p} pdf={pdf} pageNum={p} scale={scale}
                    initialSize={pageSize} eager={p === currentPage}
                    highlights={hlByPage.get(p) ?? EMPTY_HL}
                    notes={notesByPage.get(p) ?? EMPTY_NOTES}
                    drawings={drawingsByPage.get(p) ?? EMPTY_DRAWINGS}
                    showAnnotations={showAnnotations} eraseMode={eraseMode} hlThickness={hlThickness}
                    activeNoteId={activeNoteId} autoEditNoteId={newTextId} colors={NOTE_COLORS}
                    penMode={penMode} penColor={penColor} penThickness={penThickness} penEraseMode={penEraseMode}
                    onAddStroke={addStroke} onDeleteStroke={deleteStroke}
                    onDeleteHighlight={deleteHighlight} onUpdateNote={updateNote} onDeleteNote={deleteNote}
                    onSelectNote={setActiveNoteId} onSize={handlePageSize}
                    glyphCache={glyphCacheRef.current} />
                ))}
                {hi < totalPages && <div style={{ height: (totalPages - hi) * pitch }} />}
              </div>
            )
          })()}
        </div>

        {/* FLOATING side arrows — symmetric around the page; the ONLY way to change pages */}
        {pageBox && (() => {
          const BTN = 40
          // Same gap on both sides so the buttons mirror each other around the page,
          // clamped so they never overlap the page or slide off-screen.
          const availLeft = pageBox.left - 132
          const availRight = pageBox.vw - 8 - (pageBox.right + BTN)
          const gap = Math.max(6, Math.min(16, availLeft, availRight))
          return (
            <>
              <button onClick={prevPage} disabled={currentPage <= 1} title="Previous page"
                className="fixed z-40 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 text-white shadow-lg backdrop-blur-sm transition disabled:opacity-0 disabled:pointer-events-none"
                style={{ left: pageBox.left - gap - BTN, top: pageBox.centerY, transform: 'translateY(-50%)' }}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={nextPage} disabled={currentPage >= totalPages} title="Next page"
                className="fixed z-40 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 text-white shadow-lg backdrop-blur-sm transition disabled:opacity-0 disabled:pointer-events-none"
                style={{ left: pageBox.right + gap, top: pageBox.centerY, transform: 'translateY(-50%)' }}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )
        })()}

        {/* RIGHT — Tool pill (lavender/pink). Toggled via top bar pen icon. */}
        {penToolsOpen && (
          <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-[100]">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 shadow-lg" style={{ background: '#f0d7ff' }}>
              <PillBtn icon={Type} label="Drag to add a text box" cursor="grab" onMouseDown={beginPlace('textbox')} />
              <PillBtn icon={StickyNote} label="Drag to add a note" cursor="grab" onMouseDown={beginPlace('note')} />
              <PillBtn icon={Pen} label="Pen tool — draw on page" active={penMode} onClick={() => setPenMode(v => !v)} />
              <SidebarToggleBtn label="Toggle sidebar" open={sidebarOpen} active={sidebarOpen} onClick={() => setSidebarOpen(v => !v)} />
            </div>
          </div>
        )}

        {/* Pen drawing sub-bar — opens beside the lavender pill */}
        {penToolsOpen && penMode && (
          <div className="hidden sm:flex absolute right-[68px] top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-2 rounded-2xl px-2.5 py-3 shadow-lg" style={{ background: '#f0d7ff' }}>
            {/* Color indicator — click to toggle palette */}
            <button onClick={() => setPaletteOpen(v => !v)} title="Pen color"
              className={cn('relative flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-sm transition-transform hover:scale-105',
                paletteOpen ? 'border-brand-dark scale-105' : 'border-black/25')}
              style={{ background: penColor }}>
              <Pen className="h-4 w-4" style={{ color: penColor === '#1a1a1a' || penColor === '#0d4f46' ? '#ffffff' : '#1a1a1a' }} />
            </button>
            <div className="w-7 h-px bg-black/10" />
            {/* Pen tool button (active drawing) */}
            <PillBtn icon={Pen} label="Pen — draw on page" active={!penEraseMode} onClick={() => setPenEraseMode(false)} />
            {/* Eraser — click a stroke to remove it */}
            <PillBtn icon={Eraser} label="Eraser — click a stroke to erase" active={penEraseMode} onClick={() => setPenEraseMode(v => !v)} />
            {/* Clear strokes on current page */}
            <PillBtn icon={FileMinus} label="Clear drawings on this page" onClick={() => clearPageDrawings(currentPage)} />
            {/* Remove all drawings in book */}
            <PillBtn icon={Trash2} label="Remove all drawings" onClick={clearAllDrawings} />
          </div>
        )}

        {/* Pen color palette & thickness slider */}
        {penToolsOpen && penMode && paletteOpen && (
          <div className="hidden sm:flex absolute right-[128px] top-1/2 -translate-y-1/2 z-40 w-56 flex-col gap-3 rounded-2xl p-3.5 shadow-2xl border border-black/10" style={{ background: '#faf8f0' }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-brand-dark/50 font-semibold">Pen color</p>
              <button onClick={() => setPaletteOpen(false)} className="text-brand-dark/40 hover:text-brand-dark"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {PEN_COLORS.map(c => (
                <button key={c} onClick={() => setPenColor(c)} title={c}
                  className={cn('h-6 w-6 rounded-full border-2 transition-transform', penColor === c ? 'border-brand-dark scale-110' : 'border-black/15 hover:border-black/40')}
                  style={{ background: c }} />
              ))}
            </div>
            <div className="h-px bg-black/10" />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] uppercase tracking-wider text-brand-dark/50 font-semibold">Stroke width</p>
                <span className="text-[10px] text-brand-dark/50 tabular-nums">{penThickness}px</span>
              </div>
              <input type="range" min={1} max={8} step={0.5} value={penThickness}
                onChange={e => setPenThickness(parseFloat(e.target.value))}
                className="w-full accent-brand-teal cursor-pointer" />
            </div>
          </div>
        )}

        {/* Journal drawer */}
        {journalOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-72 z-40 border-l border-white/10 flex flex-col" style={{ background: '#1c1c1c' }}>
            <div className="flex items-center justify-between px-4 h-12 border-b border-white/10">
              <span className="text-[13px] font-semibold text-white/80">Notes ({allNotes.length})</span>
              <button onClick={() => setJournalOpen(false)} className="text-white/40 hover:text-white/80"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {allNotes.length === 0 && <p className="text-[12px] text-white/30 text-center mt-8">No notes yet.</p>}
              {allNotes.map(n => (
                <button key={n.id} onClick={() => { goToPage(n.page); setJournalOpen(false) }}
                  className="w-full text-left rounded-lg p-3 border border-white/10 hover:border-white/25" style={{ background: n.bgColor === 'transparent' ? '#e8e6df' : n.bgColor }}>
                  <p className="text-[10px] font-semibold text-black/50 mb-0.5">{n.kind === 'textbox' ? 'Text' : 'Note'} · Page {n.page}</p>
                  <p className="text-[12px] text-black/80 line-clamp-3">{n.content || 'Empty'}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ━━━━ FLOATING SELECTION TOOLBAR ━━━━━━━━━━━━ */}
      {selection && (
        <div data-no-select className="fixed z-50 flex items-center gap-1 rounded-xl px-2 py-1.5 shadow-2xl border border-black/10"
          style={{ left: selection.x, top: selection.y, transform: `translate(-50%, ${selection.below ? '0' : '-100%'})`, background: '#ffffff' }}>
          {/* Highlight: dark icon + visible color swatch (never an invisible pale glyph) */}
          <button onClick={() => addHighlight(activeColor)} title="Highlight selection"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-brand-dark hover:bg-black/[0.06] transition-colors">
            <Highlighter className="h-4 w-4" />
            <span className="h-3.5 w-3.5 rounded-full border border-black/25" style={{ background: activeColor }} />
          </button>
          {/* Quick color chips */}
          <div className="flex items-center gap-1">
            {HIGHLIGHT_COLORS.slice(0, 4).map((c) => (
              <button key={c} onClick={() => { setActiveColor(c); addHighlight(c) }} title="Highlight"
                className={cn('h-4 w-4 rounded-full border transition-transform hover:scale-110', activeColor === c ? 'border-brand-dark/60 scale-110' : 'border-black/20')}
                style={{ background: c }} />
            ))}
          </div>
          <SelBtn icon={Underline} label="Underline text" onClick={() => addHighlight(activeColor, true)} />
          <div className="w-px h-5 bg-black/10 mx-0.5" />
          <SelBtn icon={Search} label="Look up meaning" onClick={() => lookupWord('peek')} />
          <SelBtn icon={Type} label="Save word" onClick={() => lookupWord('save')} />
          <SelBtn icon={Send} label="Explain passage" onClick={() => explainPassage(selection.text)} />
          <div className="w-px h-5 bg-black/10 mx-0.5" />
          <SelBtn icon={X} label="Dismiss" onClick={() => { window.getSelection()?.removeAllRanges(); setSelection(null) }} />
        </div>
      )}

      {/* Meaning Peek Card (Sideways & Compact Brand Styled) */}
      {meaning && (
        <MeaningCard meaning={meaning} onClose={() => setMeaning(null)} />
      )}

      {/* ━━━━ DRAG-TO-PLACE GHOST (follows the cursor while placing a note/text) ━━━━ */}
      {placing && (
        <div ref={ghostRef}
          className="fixed left-0 top-0 z-[60] pointer-events-none flex items-center justify-center rounded-sm shadow-2xl"
          style={{
            width: ghostSizeRef.current.w, height: ghostSizeRef.current.h,
            transform: 'translate(-9999px, -9999px)',
            background: placing === 'textbox' ? 'rgba(255,255,255,0.85)' : NOTE_COLORS[0],
            border: placing === 'textbox' ? '1px dashed rgba(0,0,0,0.4)' : '1px solid rgba(0,0,0,0.08)',
          }}>
          <span className="text-[11px] font-semibold text-black/50 select-none">{placing === 'textbox' ? 'Text box' : 'Note'}</span>
        </div>
      )}

      {/* ━━━━ MOBILE BOTTOM BAR ━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="sm:hidden flex items-center justify-between px-4 py-2 border-t border-white/[0.06] shrink-0" style={{ background: 'rgba(18,18,18,0.95)' }}>
        <button onClick={prevPage} disabled={currentPage <= 1} className={cn('px-4 py-2 rounded-lg text-[12px] font-medium', currentPage <= 1 ? 'text-white/20' : 'text-white/60 bg-white/[0.06]')}>Previous</button>
        <span className="text-[11px] text-white/30">{currentPage} / {totalPages}</span>
        <button onClick={nextPage} disabled={currentPage >= totalPages} className={cn('px-4 py-2 rounded-lg text-[12px] font-medium', currentPage >= totalPages ? 'text-white/20' : 'text-white/60 bg-white/[0.06]')}>Next</button>
      </div>
    </div>
  )
}

/* ━━━━ Right pill button ━━━━━━━━━━━━━━━━━━━━━━━ */
function PillBtn({ icon: Icon, label, active, onClick, onMouseDown, cursor }: { icon: any; label: string; active?: boolean; onClick?: () => void; onMouseDown?: (e: React.MouseEvent) => void; cursor?: string }) {
  return (
    <div className="relative group">
      <button onMouseDown={onMouseDown} onClick={onClick} aria-label={label}
        style={cursor ? { cursor } : undefined}
        className={cn('h-9 w-9 rounded-xl flex items-center justify-center transition-all', active ? 'bg-brand-teal text-white' : 'text-brand-dark/70 hover:bg-black/[0.06]')}>
        <Icon className="h-4 w-4" />
      </button>
      {/* Hover tooltip — appears to the left of the icon (the pill lives on the right edge) */}
      <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white opacity-0 translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 shadow-lg" style={{ background: 'rgba(20,20,20,0.92)' }}>
        {label}
      </span>
    </div>
  )
}

/* ━━━━ Sidebar toggle (panel icon) with a fade-out / fade-in tooltip ━━━━
   Uses the same lucide panel glyphs as the rest of the tool pill. The icon
   reflects the sidebar's state: PanelLeftClose when open (click to collapse),
   PanelLeftOpen when closed (click to expand).
   The tooltip reveals on hover, stays pinned while the cursor is over the icon,
   and only begins its 3s fade-out once the cursor leaves. Re-entering before it
   fades cancels the timer and smoothly fades it back in. */
function SidebarToggleBtn({ label, active, open, onClick }: { label: string; active?: boolean; open?: boolean; onClick: () => void }) {
  const [tipVisible, setTipVisible] = useState(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTip = useCallback(() => {
    if (fadeTimer.current) { clearTimeout(fadeTimer.current); fadeTimer.current = null }
    setTipVisible(true)
  }, [])
  const scheduleHide = useCallback(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    fadeTimer.current = setTimeout(() => setTipVisible(false), 3000)
  }, [])

  // Clear any pending timer if the button unmounts mid-fade.
  useEffect(() => () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }, [])

  return (
    <div className="relative" onMouseEnter={showTip} onMouseLeave={scheduleHide}>
      <button
        onClick={() => { showTip(); onClick() }}
        aria-label={label}
        className={cn('h-9 w-9 rounded-xl flex items-center justify-center transition-all', active ? 'bg-brand-teal text-white' : 'text-brand-dark/70 hover:bg-black/[0.06]')}>
        {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </button>
      {/* Tooltip — top-most layer, smooth 300ms opacity fade */}
      <span
        className={cn('pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 z-[9999] whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium text-white shadow-lg transition-opacity duration-300',
          tipVisible ? 'opacity-100' : 'opacity-0')}
        style={{ background: 'rgba(20,20,20,0.92)' }}>
        {label}
      </span>
    </div>
  )
}

/* ━━━━ Continuous-flow page renderer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Each PageView owns its OWN canvas + text layer, so pages never share one.
   pdf.js forbids two render() calls on the same canvas at once, and React 19
   StrictMode double-invokes effects — so we SERIALISE renders through a promise
   chain and guard with a sequence counter: any superseded render is cancelled in
   cleanup before the next begins. This is what fixes both the "same canvas during
   multiple render() operations" crash and the missing-text (half-painted layer)
   bug. Pages paint lazily via IntersectionObserver; `eager` bootstraps the first. */
/* ━━━━ Freehand Drawing SVG Layer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function pointsToSvgPath(points: { x: number; y: number }[], scaleX = 1000, scaleY = 1000): string {
  if (!points || points.length === 0) return ''
  if (points.length === 1) {
    const x = points[0].x * scaleX
    const y = points[0].y * scaleY
    return `M ${x} ${y} L ${x + 0.01} ${y}`
  }
  let d = `M ${points[0].x * scaleX} ${points[0].y * scaleY}`
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    const midX = ((p1.x + p2.x) / 2) * scaleX
    const midY = ((p1.y + p2.y) / 2) * scaleY
    d += ` Q ${p1.x * scaleX} ${p1.y * scaleY}, ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x * scaleX} ${last.y * scaleY}`
  return d
}

function DrawingLayer({
  pageNum, drawings, penMode, penColor, penThickness, penEraseMode, onAddStroke, onDeleteStroke
}: {
  pageNum: number
  drawings: DrawingStroke[]
  penMode: boolean
  penColor: string
  penThickness: number
  penEraseMode: boolean
  onAddStroke: (stroke: DrawingStroke) => void
  onDeleteStroke: (id: string) => void
}) {
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[] | null>(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<{ x: number; y: number }[]>([])
  const rafRef = useRef(0)

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!penMode || penEraseMode || e.button !== 0) return
    const svg = e.currentTarget
    svg.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const r = svg.getBoundingClientRect()
    const pt = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height
    }
    currentPointsRef.current = [pt]
    setCurrentStroke([pt])
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return
    const svg = e.currentTarget
    const r = svg.getBoundingClientRect()
    const pt = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height
    }
    const pts = currentPointsRef.current
    const last = pts[pts.length - 1]
    if (last) {
      const dx = (pt.x - last.x) * r.width
      const dy = (pt.y - last.y) * r.height
      if (dx * dx + dy * dy < 3) return // skip micro-jitter for smooth high performance
    }
    pts.push(pt)
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        setCurrentStroke([...currentPointsRef.current])
      })
    }
  }

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    const pts = currentPointsRef.current
    if (pts.length > 0) {
      onAddStroke({
        id: crypto.randomUUID(),
        page: pageNum,
        color: penColor,
        thickness: penThickness,
        points: pts
      })
    }
    currentPointsRef.current = []
    setCurrentStroke(null)
  }

  return (
    <svg
      className={cn('absolute inset-0 w-full h-full z-[10] overflow-visible', penMode && !penEraseMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none')}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: penMode ? 'none' : 'auto', overflow: 'visible' }}
    >
      {/* Full-bleed transparent backdrop to allow drawing anywhere outside the page into margins */}
      {penMode && !penEraseMode && (
        <rect x="-4000" y="-2000" width="9000" height="5000" fill="transparent" pointerEvents="all" />
      )}

      {/* Saved strokes */}
      {drawings.map(s => (
        <path
          key={s.id}
          d={pointsToSvgPath(s.points, 1000, 1000)}
          stroke={s.color}
          strokeWidth={s.thickness}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={cn(penMode && penEraseMode && 'hover:stroke-red-500 hover:opacity-50 cursor-pointer pointer-events-auto transition-opacity')}
          style={{
            pointerEvents: penMode && penEraseMode ? 'stroke' : 'none',
          }}
          onClick={penMode && penEraseMode ? (e) => { e.stopPropagation(); onDeleteStroke(s.id) } : undefined}
        />
      ))}

      {/* Active in-flight stroke */}
      {currentStroke && (
        <path
          d={pointsToSvgPath(currentStroke, 1000, 1000)}
          stroke={penColor}
          strokeWidth={penThickness}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}

/* ━━━━ Continuous-flow page renderer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Each PageView owns its OWN canvas + text layer, so pages never share one.
   pdf.js forbids two render() calls on the same canvas at once, and React 19
   StrictMode double-invokes effects — so we SERIALISE renders through a promise
   chain and guard with a sequence counter: any superseded render is cancelled in
   cleanup before the next begins. Pages paint lazily via IntersectionObserver;
   `eager` bootstraps the first. */
const PageView = memo(function PageView({
  pdf, pageNum, scale, initialSize, eager, highlights, notes, drawings,
  showAnnotations, eraseMode, hlThickness, activeNoteId, autoEditNoteId, colors,
  penMode, penColor, penThickness, penEraseMode,
  onAddStroke, onDeleteStroke, onDeleteHighlight, onUpdateNote, onDeleteNote, onSelectNote, onSize,
  glyphCache
}: {
  pdf: PDFDocumentProxy | null; pageNum: number; scale: number; initialSize: { w: number; h: number }; eager: boolean
  highlights: HighlightData[]; notes: StickyNoteData[]; drawings: DrawingStroke[]
  showAnnotations: boolean; eraseMode: boolean; hlThickness: number
  activeNoteId: string | null; autoEditNoteId: string | null; colors: string[]
  penMode: boolean; penColor: string; penThickness: number; penEraseMode: boolean
  onAddStroke: (stroke: DrawingStroke) => void; onDeleteStroke: (id: string) => void
  onDeleteHighlight: (id: string) => void; onUpdateNote: (id: string, u: Partial<StickyNoteData>) => Promise<void>
  onDeleteNote: (id: string) => Promise<void>; onSelectNote: (id: string) => void; onSize: (page: number, sz: { w: number; h: number }) => void
  glyphCache: Map<number, GlyphBox[]>
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const taskRef = useRef<any>(null)
  const textTaskRef = useRef<any>(null)
  const seqRef = useRef(0)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const [size, setSize] = useState(initialSize)
  const [visible, setVisible] = useState(eager)
  const [busy, setBusy] = useState(false)

  /* Paint only when the page approaches the viewport (windowing). */
  useEffect(() => {
    if (visible) return
    const el = stageRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setVisible(true); io.disconnect() }
    }, { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  /* Adopt the shared size once the first page reports it (all pages match). */
  useEffect(() => { if (!size.w && initialSize.w) setSize(initialSize) }, [initialSize, size.w])

  /* Build this page's normalized glyph boxes ONCE from the PDF text metrics, so
     the selection handler can hug the real glyph baseline synchronously. Computed
     at scale 1 (normalized → zoom-independent) and cached across mounts. */
  const glyphsReq = useRef(false)
  useEffect(() => {
    if (!pdf || !visible) return
    if (glyphsReq.current || glyphCache.has(pageNum)) return
    glyphsReq.current = true
    let cancelled = false
    ;(async () => {
      try {
        const page = await pdf.getPage(pageNum)
        const vp = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        if (cancelled) return
        const W = vp.width, H = vp.height
        const boxes: GlyphBox[] = []
        for (const it of content.items as any[]) {
          const str: string = it.str
          if (!str || !str.trim()) continue
          const t = it.transform as number[]
          if (!t || t.length < 6) continue
          const [bx, by] = vp.convertToViewportPoint(t[4], t[5]) // baseline start, CSS px @scale1
          const fontH = Math.hypot(t[2], t[3]) || 8
          const adv = (it.width as number) || fontH * str.length * 0.5
          // ~82% of the font height above the baseline, ~18% below (descenders).
          boxes.push({ x: bx / W, y: (by - fontH * 0.82) / H, w: adv / W, h: fontH / H })
        }
        glyphCache.set(pageNum, boxes)
      } catch {
        glyphsReq.current = false // allow a retry on next visibility change
      }
    })()
    return () => { cancelled = true }
  }, [pdf, visible, pageNum, glyphCache])

  useEffect(() => {
    if (!pdf || !visible || !canvasRef.current || !textRef.current) return
    const mySeq = ++seqRef.current
    setBusy(true)
    // Queue behind any in-flight render for THIS canvas so two never overlap.
    chainRef.current = chainRef.current.then(async () => {
      if (seqRef.current !== mySeq) return // superseded before we started
      const canvas = canvasRef.current, tlContainer = textRef.current
      if (!canvas || !tlContainer) return
      try {
        const page = await pdf.getPage(pageNum)
        if (seqRef.current !== mySeq) return
        const vp = page.getViewport({ scale })
        const sz = { w: Math.floor(vp.width), h: Math.floor(vp.height) }
        setSize(sz); onSize(pageNum, sz)

        const dpr = Math.min(window.devicePixelRatio || 1, scale > 2.5 ? 1.5 : 2)
        canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr)
        canvas.style.width = `${Math.floor(vp.width)}px`; canvas.style.height = `${Math.floor(vp.height)}px`
        const ctx = canvas.getContext('2d')!
        const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
        const task = page.render({ canvasContext: ctx, transform: transform as any, viewport: vp }); taskRef.current = task
        await task.promise
        if (seqRef.current !== mySeq) return

        // Fully paint the text layer AFTER the canvas — waiting guarantees no
        // render() is mid-flight, so glyphs are never dropped.
        tlContainer.replaceChildren()
        tlContainer.style.setProperty('--scale-factor', `${vp.scale}`)
        tlContainer.style.width = `${Math.floor(vp.width)}px`
        tlContainer.style.height = `${Math.floor(vp.height)}px`
        const pdfjsLib = await import('pdfjs-dist')
        const tl = new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), container: tlContainer, viewport: vp }); textTaskRef.current = tl
        await tl.render()
      } catch (e: any) {
        const cancelled = e?.name === 'RenderingCancelledException' || e?.name === 'AbortException'
        if (!cancelled && seqRef.current === mySeq) console.error(e)
      }
      finally { if (seqRef.current === mySeq) setBusy(false) }
    })
    return () => {
      // Invalidate this render, cancel any in-flight task so the next can start clean.
      seqRef.current++
      if (taskRef.current) { try { taskRef.current.cancel() } catch {} }
      if (textTaskRef.current) { try { textTaskRef.current.cancel() } catch {} }
    }
  }, [pdf, pageNum, scale, visible, onSize])

  return (
    <div ref={stageRef} data-stage={pageNum} className="relative flex justify-center w-full" style={{ minHeight: size.h || undefined, marginBottom: PAGE_GAP }}>
      <div data-page={pageNum} data-page-wrap className="relative shadow-2xl shrink-0 bg-white"
        style={{ width: size.w || 'auto', height: size.h || 'auto' }}>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#2a2a2a]/40 z-30 pointer-events-none">
            <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className="block" />
        <div ref={textRef} className="textLayer" />

        {/* ── Freehand drawing ink layer ── */}
        <DrawingLayer
          pageNum={pageNum}
          drawings={drawings}
          penMode={penMode}
          penColor={penColor}
          penThickness={penThickness}
          penEraseMode={penEraseMode}
          onAddStroke={onAddStroke}
          onDeleteStroke={onDeleteStroke}
        />

        {/* ── Committed text highlights ── */}
        {showAnnotations && highlights.map(h => (
          <div key={h.id} data-no-select className={cn('absolute inset-0 z-[3]', eraseMode ? 'pointer-events-auto' : 'pointer-events-none')}>
            {h.rects.map((r, i) => (
              h.isBold ? (
                /* Bold underline: crisp dark underline + contrast boost, completely distinct from highlighter */
                <div key={i} onClick={eraseMode ? () => onDeleteHighlight(h.id) : undefined}
                  className={cn('absolute transition', eraseMode && 'cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-red-400')}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    borderBottom: `2.5px solid ${h.color === '#FFF176' ? '#1a1a1a' : h.color}`,
                    backdropFilter: 'contrast(250%)',
                  }}
                  title="Bold underline emphasis" />
              ) : (
                /* Standard highlighter: soft translucent marker wash */
                <div key={i} onClick={eraseMode ? () => onDeleteHighlight(h.id) : undefined}
                  className={cn('absolute mix-blend-multiply transition', eraseMode && 'cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-red-400')}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${(r.y + r.h * (1 - hlThickness) / 2) * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * hlThickness * 100}%`,
                    backgroundColor: h.color,
                    opacity: 0.38,
                  }}
                  title="Highlight" />
              )
            ))}
          </div>
        ))}

        {/* ── Sticky notes & text boxes strictly locked to this page ── */}
        {showAnnotations && notes.map(note => (
          <StickyNoteOverlay key={note.id} note={note} active={activeNoteId === note.id}
            autoStartEdit={note.id === autoEditNoteId}
            colors={colors}
            onSelect={() => onSelectNote(note.id)}
            onUpdate={onUpdateNote} onDelete={onDeleteNote} />
        ))}
      </div>
    </div>
  )
})

/* ━━━━ Selection toolbar button ━━━━━━━━━━━━━━━━ */
function SelBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="h-8 w-8 rounded-lg flex items-center justify-center text-brand-dark/70 hover:text-brand-dark hover:bg-black/[0.06] transition-all">
      <Icon className="h-4 w-4" />
    </button>
  )
}

/* ━━━━ Lazy thumbnail tile ━━━━━━━━━━━━━━━━━━━━ */
function Thumb({ page, url, active, onRequest, onClick }: {
  page: number; url?: string; active: boolean
  onRequest: (p: number) => void; onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  // Render the image only once the tile approaches the viewport.
  useEffect(() => {
    if (url) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { onRequest(page); io.disconnect() }
    }, { rootMargin: '400px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [url, page, onRequest])
  // Keep the current page's tile visible while navigating.
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }) }, [active])
  return (
    <button ref={ref} onClick={onClick} className="flex flex-col items-center gap-1 group shrink-0">
      <span className={cn('text-[9px] font-medium self-start pl-0.5 tabular-nums', active ? 'text-brand-teal' : 'text-brand-dark/40')}>{page}</span>
      <div className={cn('w-full aspect-[0.72] rounded border overflow-hidden transition-all bg-white',
        active ? 'border-brand-teal ring-1 ring-brand-teal/40' : 'border-black/15 group-hover:border-black/35')}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Page ${page}`} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-black/[0.05] animate-pulse" />
        )}
      </div>
    </button>
  )
}

/* ━━━━ Sticky Note / Text Box (draggable + resizable) ━━━━━━ */
function StickyNoteOverlay({ note, active, autoStartEdit, colors, onSelect, onUpdate, onDelete }: {
  note: StickyNoteData; active: boolean; autoStartEdit?: boolean; colors: string[]
  onSelect: () => void
  onUpdate: (id: string, u: Partial<StickyNoteData>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const isBox = note.kind === 'textbox'
  const [dragging, setDragging] = useState(false)
  // When true we play a short fade-out before the parent actually removes us.
  const [deleting, setDeleting] = useState(false)
  // A freshly-created text box drops straight into edit mode so you can type.
  const [editing, setEditing] = useState(!!autoStartEdit)
  const [content, setContent] = useState(note.content)
  const [rotating, setRotating] = useState(false)
  // Local geometry is what we render while dragging or rotating — updating it is cheap and
  // triggers NO network calls. We persist once on release.
  const [geom, setGeom] = useState({
    x: note.x,
    y: note.y,
    width: note.width,
    height: note.height,
    rotation: note.rotation || 0,
  })
  const geomRef = useRef(geom)
  // Keep the ref in sync with committed geometry, but never clobber it mid-drag
  if (!dragging && !rotating) geomRef.current = geom
  const dragStart = useRef({ x: 0, y: 0, nx: 0, ny: 0, w: 0, h: 0 })
  const ref = useRef<HTMLDivElement>(null)

  // Keep local geometry in sync when the server value changes (and we're not mid-drag)
  useEffect(() => {
    if (!dragging && !rotating) {
      setGeom({
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        rotation: note.rotation || 0,
      })
    }
  }, [note.x, note.y, note.width, note.height, note.rotation, dragging, rotating])

  useEffect(() => {
    setContent(note.content)
  }, [note.content])

  useEffect(() => {
    if (autoStartEdit) setEditing(true)
  }, [autoStartEdit])

  const beginDrag = (e: React.MouseEvent, kind: 'move' | 'resize', fromHandle = false) => {
    // If editing and clicked inside the textarea, let them type and select text
    if (editing && !fromHandle && kind === 'move') return
    e.stopPropagation()
    onSelect()
    const parent = ref.current?.parentElement
    if (!parent) return
    const r = parent.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    dragStart.current = { x: startX, y: startY, nx: geomRef.current.x, ny: geomRef.current.y, w: geomRef.current.width, h: geomRef.current.height }

    // If initiated from the explicit drag handle or resize handle, start dragging immediately
    let isMoving = fromHandle || kind === 'resize'
    if (isMoving) setDragging(true)

    const onMove = (me: MouseEvent) => {
      const dist = Math.hypot(me.clientX - startX, me.clientY - startY)
      if (!isMoving && dist > 3) {
        isMoving = true
        setDragging(true)
      }
      if (!isMoving && kind === 'move') return

      const dx = (me.clientX - startX) / r.width
      const dy = (me.clientY - startY) / r.height
      const g = geomRef.current
      const next = kind === 'move'
        ? {
            ...g,
            x: Math.max(-5.0, Math.min(6.0, dragStart.current.nx + dx)),
            y: Math.max(-2.0, Math.min(3.0, dragStart.current.ny + dy)),
          }
        : {
            ...g,
            width: Math.max(0.04, Math.min(4.0, dragStart.current.w + dx)),
            height: Math.max(0.02, Math.min(4.0, dragStart.current.h + dy)),
          }
      geomRef.current = next // own latest value immediately
      setGeom(next)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (isMoving) {
        setDragging(false)
        const g = geomRef.current
        onUpdate(note.id, kind === 'move' ? { x: g.x, y: g.y } : { width: g.width, height: g.height })
      } else if (!editing && kind === 'move') {
        // Plain click without dragging: if already active, enter edit mode
        if (active) {
          setEditing(true)
        }
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const beginRotate = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    setRotating(true)

    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - cx
      const dy = me.clientY - cy
      const rad = Math.atan2(dy, dx)
      // Since handle is above the box (dx=0, dy<0 is -90 deg), add 90 deg so pointing straight up = 0 deg
      let deg = Math.round(rad * (180 / Math.PI)) + 90
      if (deg < 0) deg += 360
      deg = deg % 360

      geomRef.current = { ...geomRef.current, rotation: deg }
      setGeom(prev => ({ ...prev, rotation: deg }))
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setRotating(false)
      const finalDeg = geomRef.current.rotation || 0
      onUpdate(note.id, { rotation: finalDeg })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const finishEdit = () => {
    setEditing(false)
    if (isBox && content.trim() === '') { onDelete(note.id); return } // drop empty boxes
    if (content !== note.content) onUpdate(note.id, { content })
  }

  /* Play a ~200ms fade-out, then let the parent remove us from the DOM. */
  const runDelete = () => {
    if (deleting) return
    setDeleting(true)
    setTimeout(() => onDelete(note.id), 200)
  }

  const handwrittenStyle = {
    fontFamily: "'Caveat', cursive, sans-serif",
    fontWeight: 600,
    fontSize: `${Math.max(16, note.fontSize + (isBox ? 4 : 2))}px`,
    lineHeight: 1.35,
    letterSpacing: '0.02em',
  }

  return (
    <div ref={ref}
      data-no-select
      data-note-overlay
      className={cn(
        'absolute flex flex-col overflow-visible select-none z-20 transition-[opacity,transform] duration-200 ease-out',
        isBox
          ? cn(
              'rounded-md',
              editing
                ? 'border-2 border-brand-teal/80 ring-1 ring-brand-teal/40 shadow-sm bg-white/40'
                : 'border border-transparent hover:border-black/20 hover:bg-black/[0.01]'
            )
          : cn('rounded-sm shadow-lg', dragging && 'opacity-90', active && 'ring-2 ring-brand-teal/60'),
        deleting && 'pointer-events-none',
      )}
      style={{
        left: `${geom.x * 100}%`,
        top: `${geom.y * 100}%`,
        width: `${geom.width * 100}%`,
        height: `${geom.height * 100}%`,
        minWidth: isBox ? 64 : 110,
        minHeight: isBox ? 32 : 80,
        backgroundColor: isBox ? 'transparent' : note.bgColor,
        color: note.textColor,
        cursor: editing ? 'default' : (dragging ? 'grabbing' : 'grab'),
        opacity: deleting ? 0 : 1,
        transform: `${deleting ? 'scale(0.92) ' : ''}rotate(${geom.rotation || 0}deg)`,
        transformOrigin: 'center center',
      }}
      onMouseDown={(e) => beginDrag(e, 'move', false)}
      onClick={onSelect}>

      {/* Rotation handle: small circular knob above the top edge when active or editing */}
      {(editing || active) && (
        <div
          className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-30 select-none group/rot"
          onMouseDown={beginRotate}
          title="Drag to rotate at any angle"
        >
          <div className="h-5 w-5 rounded-full bg-white border border-brand-teal shadow-md flex items-center justify-center hover:scale-110 hover:bg-brand-teal hover:text-white transition-all text-brand-teal">
            <RotateCw className="h-3 w-3" />
          </div>
          <div className="w-px h-2 bg-brand-teal" />
        </div>
      )}

      {/* Header bar: sticky notes have title + trash; textboxes only show drag header when open to write (editing) */}
      {!isBox ? (
        <div
          onMouseDown={e => beginDrag(e, 'move', true)}
          className="flex items-center justify-between px-2 py-1 text-[9px] font-bold opacity-60 uppercase tracking-wider cursor-grab active:cursor-grabbing border-b border-black/10 select-none bg-black/[0.04] shrink-0"
        >
          <div className="flex items-center gap-1 pointer-events-none">
            <GripHorizontal className="h-3 w-3 opacity-60" />
            <span>Note</span>
          </div>
          <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); runDelete() }} className="opacity-50 hover:opacity-100 p-0.5" title="Delete"><Trash2 className="h-3 w-3" /></button>
        </div>
      ) : editing ? (
        <div
          onMouseDown={e => beginDrag(e, 'move', true)}
          className="flex items-center justify-between px-1.5 py-0.5 text-[8px] font-semibold border-b bg-brand-teal/15 border-brand-teal/30 text-brand-dark cursor-grab active:cursor-grabbing select-none shrink-0"
          title="Drag to move text box"
        >
          <div className="flex items-center gap-1 pointer-events-none">
            <GripHorizontal className="h-2.5 w-2.5 opacity-70" />
            <span className="uppercase tracking-wider">Drag</span>
          </div>
          <button
            type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); runDelete() }}
            className="opacity-50 hover:opacity-100 p-0.5 rounded text-black hover:text-red-600 transition-colors"
            title="Delete text box"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      ) : null}

      {/* Content area: textarea when editing, preview div with handwritten font when not */}
      {editing ? (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={e => {
            if (e.key === 'Escape') finishEdit()
          }}
          autoFocus
          onMouseDown={e => e.stopPropagation()}
          placeholder={isBox ? 'Write here…' : 'Write a note…'}
          className="flex-1 bg-transparent resize-none p-1.5 focus:outline-none placeholder:text-black/30 overflow-auto select-text cursor-text"
          style={{ ...handwrittenStyle, color: note.textColor }}
        />
      ) : (
        <div
          className="flex-1 p-1.5 overflow-auto whitespace-pre-wrap select-none cursor-text"
          onClick={e => {
            e.stopPropagation()
            onSelect()
            setEditing(true)
          }}
          onDoubleClick={e => {
            e.stopPropagation()
            onSelect()
            setEditing(true)
          }}
          title={isBox ? 'Click inside to type, drag header to move' : 'Click inside to type, drag header to move'}
          style={{ ...handwrittenStyle, color: note.textColor }}
        >
          <span className={cn(!content && 'text-black/30')}>
            {content || (isBox ? 'Click to write…' : 'Click to write…')}
          </span>
        </div>
      )}

      {/* Floating controls toolbar ("upbar") — ONLY visible while inside the input box (editing) */}
      {active && editing && (
        <div
          className={cn(
            "absolute z-40 flex items-center gap-1 px-2.5 py-1.5 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-black/15 whitespace-nowrap transition-all",
            geom.y < 0.12 ? "top-full mt-1.5 left-0" : "bottom-full mb-1.5 left-0"
          )}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
        >
          {isBox ? (
            /* For text boxes: color options change textColor! */
            <div className="flex items-center gap-1">
              <span className="text-[9px] uppercase tracking-wider font-bold text-black/50 mr-0.5">Ink:</span>
              {['#000000', '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#ffffff'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdate(note.id, { textColor: c })}
                  className={cn(
                    'h-4 w-4 rounded-full border transition-transform hover:scale-125 shadow-xs',
                    note.textColor === c ? 'border-brand-teal ring-2 ring-brand-teal scale-110' : 'border-black/25'
                  )}
                  style={{ background: c }}
                  title={`Text color ${c}`}
                />
              ))}
            </div>
          ) : (
            /* For sticky notes: color options change note bgColor */
            colors.slice(0, 6).map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate(note.id, { bgColor: c })}
                className={cn('h-4 w-4 rounded-full border transition-transform hover:scale-110', note.bgColor === c ? 'border-black scale-110 ring-1 ring-black/40' : 'border-black/15')}
                style={{ background: c }}
                title={`BG ${c}`}
              />
            ))
          )}

          <span className="mx-0.5 w-px h-3.5 bg-black/15" />
          <button type="button" onClick={() => onUpdate(note.id, { fontSize: Math.max(10, note.fontSize - 2) })} className="text-[11px] font-bold text-black/70 hover:text-black px-1.5 py-0.5 rounded hover:bg-black/5" title="Decrease font size">A-</button>
          <button type="button" onClick={() => onUpdate(note.id, { fontSize: Math.min(48, note.fontSize + 2) })} className="text-[13px] font-bold text-black/70 hover:text-black px-1.5 py-0.5 rounded hover:bg-black/5" title="Increase font size">A+</button>
          {!isBox && (
            <button type="button" onClick={() => onUpdate(note.id, { textColor: note.textColor === '#000000' ? '#FFFFFF' : '#000000' })} className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/20 shadow-xs" style={{ background: note.textColor === '#000000' ? '#000' : '#fff', color: note.textColor === '#000000' ? '#fff' : '#000' }} title="Toggle text color">Aa</button>
          )}
          <button
            type="button"
            onClick={() => {
              const nextRot = (((geom.rotation || 0) + 90) % 360)
              setGeom(prev => ({ ...prev, rotation: nextRot }))
              geomRef.current = { ...geomRef.current, rotation: nextRot }
              onUpdate(note.id, { rotation: nextRot })
            }}
            className="flex items-center gap-1 text-[11px] font-bold text-black/70 hover:text-black px-1.5 py-0.5 rounded hover:bg-black/5"
            title="Rotate 90° clockwise"
          >
            <RotateCw className="h-3 w-3" />
            <span className="text-[9px] font-semibold">{geom.rotation || 0}°</span>
          </button>
          <button type="button" onClick={runDelete} className="ml-1 opacity-60 hover:opacity-100 text-red-600 p-1 rounded hover:bg-red-50" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Resize handle — only visible when open to write (editing) */}
      {editing && (
        <div onMouseDown={(e) => beginDrag(e, 'resize', true)} className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize z-10" style={{ background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.3) 50%)' }} title="Resize" />
      )}
    </div>
  )
}

/* ━━━━ Meaning Peek Card (Sideways Floating, Compact Brand Design) ━━━━ */
function MeaningCard({
  meaning,
  onClose,
}: {
  meaning: MeaningData
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(`${meaning.word}: ${meaning.text}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      data-no-select
      className="fixed z-50 w-[240px] sm:w-[260px] animate-in fade-in zoom-in-95 duration-200 select-none shadow-[0_16px_36px_rgba(0,0,0,0.45)]"
      style={{
        left: meaning.x,
        top: meaning.y,
      }}
    >
      <div className="rounded-xl bg-[#16201e]/95 backdrop-blur-xl border border-brand-teal/40 p-3 text-brand-cream overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <span className="px-2 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-wider bg-brand-teal/30 border border-brand-teal/50 text-brand-cream/90">
            {meaning.isExplanation ? 'Explanation' : 'Meaning'}
          </span>
          <button
            onClick={onClose}
            className="h-5 w-5 rounded-full hover:bg-white/10 flex items-center justify-center text-brand-cream/60 hover:text-brand-cream transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Word / Title */}
        <div className="mt-2">
          <h4 className="text-[14px] font-semibold tracking-tight text-brand-cream capitalize font-poppins truncate">
            {meaning.word}
          </h4>
        </div>

        {/* Meaning / Text */}
        <div className="mt-1.5 text-[11.5px] text-brand-cream/80 leading-relaxed font-light max-h-48 overflow-y-auto pr-1 select-text [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
          {meaning.loading ? (
            <div className="flex items-center gap-2 py-2 text-brand-cream/60 text-[11px]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-cream/70" />
              <span className="animate-pulse">Loading…</span>
            </div>
          ) : (
            meaning.text
          )}
        </div>

        {/* Bottom action row */}
        {!meaning.loading && (
          <div className="mt-2.5 pt-2 border-t border-brand-teal/20 flex items-center justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-teal/30 hover:bg-brand-teal/50 border border-brand-teal/40 text-brand-cream/80 hover:text-brand-cream text-[10.5px] font-medium transition-all"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


