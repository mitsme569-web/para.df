'use client'

import { cn } from '@/lib/utils'

export const GENRES = [
  'All',
  'Fiction',
  'Non-Fiction',
  'Science',
  'History',
  'Philosophy',
  'Biography',
  'Classic',
] as const

export type Genre = (typeof GENRES)[number]

interface GenreFilterProps {
  selected: Genre
  onChange: (genre: Genre) => void
}

/**
 * Genre pills styled like Sherpa's category filters:
 * bordered pills, active one has filled background.
 */
export function GenreFilter({ selected, onChange }: GenreFilterProps) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto py-1
                 [-webkit-overflow-scrolling:touch] [scrollbar-width:none]
                 [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Filter books by genre"
    >
      {GENRES.map((genre) => {
        const active = genre === selected
        return (
          <button
            key={genre}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(genre)}
            className={cn(
              'shrink-0 rounded-full px-4 py-1.5 text-[12px] font-medium whitespace-nowrap',
              'border transition-all duration-200',
              active
                ? 'bg-white text-brand-dark border-white'
                : 'bg-transparent border-white/15 text-white/45 hover:border-white/30 hover:text-white/70',
            )}
          >
            {genre}
          </button>
        )
      })}
    </div>
  )
}
