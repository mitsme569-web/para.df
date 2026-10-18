'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Search, X, Copy, Check, Bookmark, ArrowRight, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoogleAILookupProps {
  meaning: { word: string; text: string; x: number; y: number }
  bookTitle?: string
  currentPage: number
  bookId: string
  onClose: () => void
  onSearch: (query: string) => Promise<void>
}

export function GoogleAILookup({
  meaning,
  bookTitle,
  currentPage,
  bookId,
  onClose,
  onSearch,
}: GoogleAILookupProps) {
  const [query, setQuery] = useState(meaning.word === 'Explanation' ? '' : meaning.word)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQuery(meaning.word === 'Explanation' ? '' : meaning.word)
    setCopied(false)
    setSaved(false)
  }, [meaning.word, meaning.text])

  const isLoading = meaning.text === 'Thinking…' || searching

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || isLoading) return
    setSearching(true)
    try {
      await onSearch(trimmed)
    } finally {
      setSearching(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(meaning.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleSave = async () => {
    if (saved) return
    try {
      await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: meaning.word,
          meaning: meaning.text,
          sentence: null,
          bookId,
          page: currentPage,
          source: 'saved',
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error(err)
    }
  }

  // Safe viewport positioning
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const left = Math.max(190, Math.min(vw - 190, meaning.x))
  const placeAbove = meaning.y > 340
  const top = placeAbove ? Math.max(40, meaning.y - 14) : Math.min(vh - 280, meaning.y + 14)

  return (
    <div
      data-no-select
      className="fixed z-50 w-[340px] sm:w-[380px] transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
      style={{
        left,
        top,
        transform: `translate(-50%, ${placeAbove ? '-100%' : '0'})`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Outer iridescent glowing shell */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-br from-[#4285F4]/60 via-[#9b72cf]/60 to-[#d96570]/60 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_35px_rgba(155,114,207,0.22)]">
        <div className="flex flex-col bg-[#131314]/95 backdrop-blur-2xl rounded-[23px] overflow-hidden border border-white/10 text-white">

          {/* ━━━━ Google AI Pill Search Bar ━━━━ */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#1e1f20]/90 border-b border-white/[0.08]"
          >
            {/* Multi-color Google AI Sparkles Icon */}
            <div className="relative flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-[#70a5ff] animate-pulse" />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Google AI or search definition…"
              className="flex-1 bg-transparent text-[13px] font-normal text-white placeholder:text-white/35 focus:outline-none min-w-0"
            />

            {query.trim() && (
              <button
                type="submit"
                disabled={isLoading}
                title="Search / Ask AI"
                className="h-6 w-6 rounded-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity shrink-0"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="h-6 w-6 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* ━━━━ Google AI Overview Response Box ━━━━ */}
          <div className="p-4 flex flex-col gap-3">
            {/* Header: AI Overview shimmer badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-ping" />
                <span className="text-[11px] font-bold tracking-wider uppercase bg-gradient-to-r from-[#70a5ff] via-[#c58fff] to-[#ff9494] bg-clip-text text-transparent">
                  AI Overview
                </span>
              </div>

              {meaning.word && meaning.word !== 'Explanation' && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.07] border border-white/10 text-white/70 truncate max-w-[150px]">
                  {meaning.word}
                </span>
              )}
            </div>

            {/* Content area: Shimmering skeleton while loading, formatted text when ready */}
            {isLoading ? (
              <div className="py-2 space-y-2.5 animate-pulse">
                <div className="h-3.5 rounded-full bg-gradient-to-r from-blue-500/25 via-purple-500/25 to-pink-500/25 w-5/6" />
                <div className="h-3.5 rounded-full bg-gradient-to-r from-purple-500/25 via-pink-500/25 to-blue-500/25 w-full" />
                <div className="h-3.5 rounded-full bg-gradient-to-r from-pink-500/25 via-blue-500/25 to-purple-500/25 w-4/6" />
                <p className="text-[11px] text-white/40 pt-1 font-light italic">
                  Synthesizing with Google AI…
                </p>
              </div>
            ) : (
              <div className="text-[12.5px] text-white/85 leading-relaxed font-normal whitespace-pre-wrap max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/15">
                {meaning.text}
              </div>
            )}

            {/* Bottom action bar */}
            {!isLoading && meaning.text && (
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] mt-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Copy definition"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-green-400" />
                        <span className="text-green-400 font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Save word to vocabulary"
                  >
                    {saved ? (
                      <>
                        <Check className="h-3 w-3 text-brand-teal" />
                        <span className="text-brand-teal font-medium">Saved</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-3 w-3" />
                        <span>Save Word</span>
                      </>
                    )}
                  </button>
                </div>

                <span className="text-[10px] text-white/30 font-light select-none">
                  paraDF AI
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
