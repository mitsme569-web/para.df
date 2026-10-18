'use client'

import { useState, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { UploadCard } from '@/components/books/upload-card'
import { GenreFilter, type Genre } from '@/components/books/genre-filter'
import { BookCard } from '@/components/books/book-card'
import { EmptyState } from '@/components/books/empty-state'
import { useBooks } from '@/hooks/use-books'
import { classifyBookGenre } from '@/lib/genre'
import { cn } from '@/lib/utils'

export default function BooksPage() {
  const { books, loading, addBook } = useBooks()
  const [activeGenre, setActiveGenre] = useState<Genre>('All')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Dynamically build filter list: base default genres + any new custom genres from AI or rules
  const availableGenres = useMemo(() => {
    const base: string[] = ['All', 'Fiction', 'Non-Fiction', 'Science', 'History', 'Philosophy', 'Biography', 'Classic']
    const custom = new Set<string>()
    for (const b of books) {
      const g = b.genre || classifyBookGenre(b)
      if (g && !base.some((item) => item.toLowerCase() === g.toLowerCase())) {
        custom.add(g)
      }
    }
    return [...base, ...Array.from(custom)]
  }, [books])

  // Filter books by active genre (auto-classified or explicit)
  const filtered = useMemo(() => {
    if (activeGenre === 'All') return books
    return books.filter((book) => {
      const genre = book.genre || classifyBookGenre(book)
      return genre.toLowerCase() === activeGenre.toLowerCase()
    })
  }, [books, activeGenre])

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: dir === 'left' ? -300 : 300,
      behavior: 'smooth',
    })
  }

  return (
    <div className="min-h-screen bg-[#0a1f1c]">

      {/* ═══════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center px-4 sm:px-6 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(13, 79, 70, 0.45), transparent 70%), linear-gradient(180deg, #111817 0%, #0d221f 55%, #0a1f1c 100%)',
        }}
      >
        {/* Ambient Blur Patches matching brand color palette */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Top-center primary brand teal glow */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[650px] max-w-[90vw] h-[360px] rounded-full bg-gradient-to-b from-[#0d4f46]/45 via-[#13796a]/25 to-transparent blur-[120px]" />
          
          {/* Left atmospheric teal patch */}
          <div className="absolute top-1/4 -left-20 w-[420px] h-[300px] rounded-full bg-[#0d4f46]/35 blur-[100px]" />

          {/* Right subtle lavender/teal accent patch */}
          <div className="absolute top-16 -right-20 w-[380px] h-[320px] rounded-full bg-gradient-to-bl from-[#f0d7ff]/10 via-[#0f6357]/25 to-transparent blur-[110px]" />

          {/* Under-card teal glow patch */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[520px] max-w-[85vw] h-[180px] rounded-full bg-[#13796a]/20 blur-[90px]" />
        </div>

        {/* Bottom smooth fade to library section */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a1f1c] to-transparent" />

        <div className="relative z-10 flex flex-col items-center gap-4 text-center w-full max-w-3xl pt-32 pb-4 sm:pb-6">
          <h1 className="font-segoe text-3xl sm:text-4xl md:text-[44px] font-light leading-[1.15] tracking-tight text-white">
            Lets add one more
            <br />
            in the shelf.
          </h1>

          <p className="font-segoe text-sm sm:text-[15px] text-white/45 font-light max-w-md leading-relaxed">
            Starting the journey again with more learnings and joy.
            <br />
            One page at a time, one word at a time.
          </p>

          <div className="w-full mt-3">
            <UploadCard onUpload={addBook} />
          </div>

          {/* ━━━━ Middle Space Separator Banner ━━━━ */}
          <div className="w-full max-w-[440px] sm:max-w-[480px] mx-auto mt-5 sm:mt-6 px-4">
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl shadow-[0_18px_45px_rgba(0,0,0,0.55)] border border-white/10 hover:border-white/20 transition-all duration-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/aep.png"
                alt="It's not a case you read a book and you think differently."
                className="w-full h-auto object-cover block select-none pointer-events-none"
                loading="lazy"
              />
            </div>
          </div>

          {/* ━━━━ Scroll Down Indicator ━━━━ */}
          <button
            type="button"
            onClick={() => {
              document.getElementById('library-section')?.scrollIntoView({ behavior: 'smooth' })
            }}
            aria-label="Scroll to library"
            className="group mt-3 sm:mt-4 flex flex-col items-center gap-1 text-white/40 hover:text-white/80 transition-all duration-200 cursor-pointer"
          >
            <div className="w-4 h-7 rounded-full border border-white/25 group-hover:border-white/50 flex items-start justify-center p-0.5 transition-colors">
              <div className="w-1 h-1.5 rounded-full bg-white/60 group-hover:bg-white animate-bounce" />
            </div>
            <ChevronDown className="h-3 w-3 text-white/35 group-hover:text-white/80 transition-colors animate-pulse" />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          LIBRARY SECTION
      ═══════════════════════════════════════════════════ */}
      <section id="library-section" className="px-4 sm:px-6 lg:px-8 pt-2 sm:pt-4 pb-20" style={{ backgroundColor: '#0a1f1c' }}>
        <div className="mx-auto max-w-6xl">

          <div className="flex flex-col items-center gap-4 mb-8">
            <p className="font-segoe text-sm text-white/40 font-light">
              Pick up where you left off, or start something new
            </p>
            <GenreFilter selected={activeGenre} onChange={setActiveGenre} genres={availableGenres} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 text-white/30 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState genre={activeGenre} onClearFilter={() => setActiveGenre('All')} />
          ) : (
            <div className="relative group/scroll">
              <button
                onClick={() => scroll('left')}
                className={cn(
                  'absolute left-0 top-[35%] -translate-y-1/2 z-20',
                  'h-9 w-9 rounded-full flex items-center justify-center',
                  'bg-[#0a1f1c] border border-white/10 text-white/50',
                  'opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200',
                  'hover:text-white -translate-x-2',
                )}
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div
                ref={scrollRef}
                className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 scroll-smooth
                           [-webkit-overflow-scrolling:touch] [scrollbar-width:none]
                           [&::-webkit-scrollbar]:hidden"
              >
                {filtered.map((book) => (
                  <BookCard
                    key={book.id}
                    id={book.id}
                    title={book.title}
                    genre={book.genre || classifyBookGenre(book)}
                    coverUrl={book.coverUrl}
                    currentPage={book.lastPage}
                    pageCount={book.pageCount}
                  />
                ))}
              </div>

              <button
                onClick={() => scroll('right')}
                className={cn(
                  'absolute right-0 top-[35%] -translate-y-1/2 z-20',
                  'h-9 w-9 rounded-full flex items-center justify-center',
                  'bg-[#0a1f1c] border border-white/10 text-white/50',
                  'opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200',
                  'hover:text-white translate-x-2',
                )}
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0a1f1c] to-transparent z-10" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0a1f1c] to-transparent z-10" />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
