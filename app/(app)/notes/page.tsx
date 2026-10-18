'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StickyNote, BookOpen, Loader2 } from 'lucide-react'

interface NoteEntry {
  id: string
  content: string
  page: number
  bgColor: string
  textColor: string
  createdAt: string
  bookId: string
  bookTitle: string | null
}

interface GroupedNotes {
  [bookId: string]: {
    bookTitle: string
    notes: NoteEntry[]
  }
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notes')
      .then((r) => r.json())
      .then((data) => { setNotes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Group by book
  const grouped: GroupedNotes = {}
  notes.forEach((note) => {
    const key = note.bookId
    if (!grouped[key]) {
      grouped[key] = { bookTitle: note.bookTitle || 'Unknown Book', notes: [] }
    }
    grouped[key].notes.push(note)
  })

  return (
    <div className="min-h-screen bg-[#1a1a1a] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#034f46]">
            <StickyNote className="h-5 w-5 text-[#ffffeb]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#ffffeb]/90">Notes</h1>
            <p className="text-xs text-[#ffffeb]/35">All your sticky notes, grouped by book</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-[#ffffeb]/30 animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <StickyNote className="h-10 w-10 text-[#ffffeb]/15 mb-4" />
            <p className="text-sm text-[#ffffeb]/35">No notes yet. Add sticky notes while reading!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([bookId, { bookTitle, notes: bookNotes }]) => (
              <div key={bookId}>
                {/* Book header */}
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-[#f0d7ff]" />
                  <h2 className="text-sm font-semibold text-[#ffffeb]/75">{bookTitle}</h2>
                  <span className="text-[10px] text-[#ffffeb]/50 bg-[#ffffeb]/[0.08] px-2 py-0.5 rounded-full">
                    {bookNotes.length}
                  </span>
                </div>

                {/* Notes grid */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {bookNotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/books/${bookId}?page=${note.page}`}
                      className="group rounded-xl p-4 border border-[#ffffeb]/[0.08] hover:border-[#f0d7ff]/50 transition-all duration-200 bg-[#ffffeb]/[0.03]"
                    >
                      {/* Mini sticky note preview — keeps the note's own saved colors */}
                      <div
                        className="rounded-lg p-3 mb-3 text-sm leading-relaxed line-clamp-3"
                        style={{ backgroundColor: note.bgColor, color: note.textColor }}
                      >
                        {note.content || 'Empty note'}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#ffffeb]/40">Page {note.page}</span>
                        <span className="text-[10px] text-[#ffffeb]/30 group-hover:text-[#f0d7ff] transition-colors">
                          Jump to page →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
