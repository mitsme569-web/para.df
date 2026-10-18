'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BookMarked, Plus, Search, Loader2, Trash2, Sparkles } from 'lucide-react'

interface WordEntry {
  id: string
  word: string
  meaning: string | null
  sentence: string | null
  bookId: string | null
  page: number | null
  source: string
  createdAt: string
}

export default function ParadictPage() {
  const [words, setWords] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(() => {
    fetch('/api/words')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load words'))))
      .then((data) => { setWords(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setWords([]); setLoading(false) })
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const filtered = words.filter((w) =>
    w.word.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    const word = newWord.trim()
    if (!word) return
    setAdding(true)
    try {
      // Look up the definition, then save. The POST returns the created row, so we
      // prepend it straight into state — no follow-up re-fetch (saves a round-trip).
      const defRes = await fetch('/api/words/define', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const { meaning } = await defRes.json()

      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, meaning, source: 'manual' }),
      })
      const saved = await res.json()
      if (saved && saved.id) setWords((prev) => [saved, ...prev])
      setNewWord('')
      setShowAdd(false)
    } catch (err) {
      console.error('Failed to add word:', err)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    // Optimistic: remove the card instantly and delete on the server in the
    // background, rolling back only if the request fails. Keeps the UI smooth
    // regardless of Neon serverless round-trip latency (no blocking refetch).
    const snapshot = words
    setWords((prev) => prev.filter((w) => w.id !== id))
    try {
      const res = await fetch(`/api/words/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`delete failed: ${res.status}`)
    } catch (err) {
      console.error('Failed to delete word:', err)
      setWords(snapshot)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#034f46]">
              <BookMarked className="h-5 w-5 text-[#ffffeb]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#ffffeb]/90">Paradict</h1>
              <p className="text-xs text-[#ffffeb]/35">Your personal dictionary</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium bg-[#034f46] text-[#ffffeb] hover:bg-[#034f46]/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add word
          </button>
        </div>

        {/* Add word form */}
        {showAdd && (
          <div className="mb-6 rounded-xl border border-[#ffffeb]/[0.1] p-4 bg-[#ffffeb]/[0.03]">
            <div className="flex gap-3">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Type a word (e.g. circuit)"
                className="flex-1 h-10 rounded-lg bg-[#ffffeb]/[0.06] border border-[#ffffeb]/[0.1] px-3 text-[13px] text-[#ffffeb]/80 placeholder:text-[#ffffeb]/25 focus:outline-none focus:border-[#f0d7ff]/60"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newWord.trim()}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium bg-[#ffffeb] text-[#1a1a1a] hover:bg-[#ffffeb]/90 transition-colors disabled:opacity-40"
              >
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Define
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#ffffeb]/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words..."
            className="w-full h-10 rounded-xl bg-[#ffffeb]/[0.04] border border-[#ffffeb]/[0.1] pl-10 pr-4 text-[13px] text-[#ffffeb]/70 placeholder:text-[#ffffeb]/25 focus:outline-none focus:border-[#f0d7ff]/60"
          />
        </div>

        {/* Words list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-[#ffffeb]/30 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookMarked className="h-10 w-10 text-[#ffffeb]/15 mb-4" />
            <p className="text-sm text-[#ffffeb]/35">
              {search ? 'No matching words found.' : 'Your dictionary is empty. Save words while reading!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((w) => {
              // A saved entry can be a single dictionary word OR a long passage the
              // reader saved. Render short words as a prominent heading and long text
              // as a comfortable, clamped excerpt so it never looks like heavy heading type.
              const isLong = w.word.length > 48
              // Two visual card types replace the old text badge: "Saved" text excerpts
              // get a teal background, "Manual"/lookup dictionary entries a lavender one.
              // Both tints stay dark enough that the cream (#ffffeb) text keeps contrast.
              const isSaved = w.source === 'saved'
              const cardCls = isSaved
                ? 'border-[#034f46]/50 bg-[#034f46]/30 hover:border-[#034f46]/70'
                : 'border-[#f0d7ff]/25 bg-[#f0d7ff]/[0.08] hover:border-[#f0d7ff]/45'
              return (
                <article
                  key={w.id}
                  className={`group rounded-2xl border p-5 transition-colors ${cardCls}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5">
                        {isLong ? (
                          <p className="line-clamp-4 min-w-0 text-[13.5px] font-normal leading-relaxed text-[#ffffeb]/90 [overflow-wrap:break-word]">
                            {w.word}
                          </p>
                        ) : (
                          <h3 className="truncate text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#ffffeb]">
                            {w.word}
                          </h3>
                        )}
                      </div>
                      {w.meaning && (
                        <p className="mb-1.5 text-[13px] leading-relaxed text-[#ffffeb]/60 [overflow-wrap:break-word]">
                          {w.meaning}
                        </p>
                      )}
                      {w.sentence && (
                        <p className="line-clamp-2 text-[12px] italic leading-relaxed text-[#ffffeb]/40">
                          &ldquo;{w.sentence}&rdquo;
                        </p>
                      )}
                      {w.bookId && w.page && (
                        <Link
                          href={`/books/${w.bookId}?page=${w.page}`}
                          className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#f0d7ff] transition-colors hover:text-[#f0d7ff]/75"
                        >
                          Page {w.page} <span aria-hidden>→</span>
                        </Link>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(w.id)}
                      aria-label="Delete saved word"
                      className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-[#ffffeb]/20 opacity-0 transition-[opacity,color,background-color] hover:bg-[#ffffeb]/[0.06] hover:text-[#f0d7ff] group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Count */}
        {!loading && words.length > 0 && (
          <div className="mt-6 text-center text-[11px] text-[#ffffeb]/25">
            {words.length} word{words.length !== 1 ? 's' : ''} in your dictionary
          </div>
        )}
      </div>
    </div>
  )
}
