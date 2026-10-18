import { BookOpen, Upload, FilterX } from 'lucide-react'
import type { Genre } from '@/components/books/genre-filter'

export function EmptyState({
  genre,
  onClearFilter,
}: {
  genre?: Genre
  onClearFilter?: () => void
}) {
  const isFiltered = genre && genre !== 'All'

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      {/* Icon cluster */}
      <div className="relative">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(13,79,70,0.25) 0%, transparent 70%)',
          }}
        >
          {isFiltered ? (
            <FilterX className="h-10 w-10 text-brand-teal/60" />
          ) : (
            <BookOpen className="h-10 w-10 text-brand-teal/60" />
          )}
        </div>
        <div
          className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center
                     rounded-full bg-[#0a1f1c] border border-white/[0.07]"
        >
          {isFiltered ? (
            <BookOpen className="h-4 w-4 text-white/40" />
          ) : (
            <Upload className="h-4 w-4 text-white/30" />
          )}
        </div>
      </div>

      <div className="space-y-2 max-w-xs">
        <h3 className="text-base font-semibold text-white/80">
          {isFiltered ? `No ${genre} books found` : 'No books yet'}
        </h3>
        <p className="text-sm text-white/35 leading-relaxed">
          {isFiltered
            ? `We couldn't find any books classified under ${genre} in your shelf.`
            : 'Upload your first PDF above and it will appear here. Your library will grow with every book you add.'}
        </p>
        {isFiltered && onClearFilter && (
          <button
            onClick={onClearFilter}
            className="mt-3 inline-block rounded-lg px-4 py-1.5 text-[12px] font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Show All Books
          </button>
        )}
      </div>
    </div>
  )
}
