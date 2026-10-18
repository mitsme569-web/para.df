'use client'

import { useState, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
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
    <div className="min-h-screen">

      {/* ═══════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center px-4 sm:px-6"
        style={{
          backgroundImage: "url('/images/books-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 65%',
          backgroundRepeat: 'no-repeat',
          minHeight: '70vh',
        }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute bottom-0 left-0 right-0 h-40" style={{ background: 'linear-gradient(to top, #0a1f1c, transparent)' }} />

        <div className="relative z-10 flex flex-col items-center gap-4 text-center w-full max-w-2xl pt-40 pb-16">
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          LIBRARY SECTION
      ═══════════════════════════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-10 pb-20" style={{ backgroundColor: '#0a1f1c' }}>
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
