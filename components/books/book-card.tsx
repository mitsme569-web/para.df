import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const COVER_GRADIENTS = [
  'from-[#0d4f46] to-[#1a2f2b]',
  'from-[#1a0d4f] to-[#0d1a2f]',
  'from-[#4f0d1a] to-[#2f1a0d]',
  'from-[#2d4f0d] to-[#1a2f0d]',
  'from-[#4f3a0d] to-[#2f1a0d]',
  'from-[#0d2a4f] to-[#0d1a3a]',
]

export interface BookCardProps {
  id: string
  title: string
  author?: string
  genre?: string
  coverUrl?: string | null
  currentPage: number
  pageCount: number
}

export function BookCard({
  id,
  title,
  author,
  genre,
  coverUrl,
  currentPage,
  pageCount,
}: BookCardProps) {
  const progress   = pageCount > 0 ? Math.round((currentPage / pageCount) * 100) : 0
  const isFinished = progress >= 100
  const gradientIdx = id.charCodeAt(0) % COVER_GRADIENTS.length

  // Badge: only completed or percentage
  const badgeText = isFinished ? 'Completed' : `${progress}%`

  return (
    <Link
      href={`/books/${id}`}
      className="group flex flex-col gap-2.5 w-[170px] sm:w-[200px] shrink-0"
      aria-label={`Open ${title}`}
    >
      {/* ── Cover image ────────────────────── */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl">
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt={`Cover of ${title}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className={cn(
              'h-full w-full bg-gradient-to-br flex flex-col items-center justify-center gap-3',
              COVER_GRADIENTS[gradientIdx],
            )}
          >
            <BookOpen className="h-9 w-9 text-white/20" />
            <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-3 text-center leading-tight">
              {title}
            </span>
          </div>
        )}

        {/* ── Badge — top left ──────────────── */}
        <div className="absolute top-2 left-2">
          {isFinished ? (
            <span
              className="inline-block rounded-md px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-wide text-black"
              style={{
                backgroundColor: '#22c55e',
                border: '1.5px solid #1a1a1a',
              }}
            >
              {badgeText}
            </span>
          ) : (
            <span
              className="inline-block rounded-md px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-wide text-black"
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #1a1a1a',
              }}
            >
              {badgeText}
            </span>
          )}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors duration-300 rounded-xl" />
      </div>

      {/* ── Info below cover ───────────────── */}
      <div className="flex flex-col gap-1 px-0.5">
        <h3 className="font-poppins text-[13px] font-semibold text-brand-cream/90 leading-snug line-clamp-1">
          {title}
        </h3>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
            {genre && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30 shrink-0">
                {genre}
              </span>
            )}
            {author && (
              <>
                <span className="text-white/15 shrink-0">·</span>
                <span className="text-[10px] text-white/25 truncate">{author}</span>
              </>
            )}
          </div>

          <button
            className={cn(
              'shrink-0 rounded-lg border px-3 py-1 text-[11px] font-semibold',
              'transition-all duration-200',
              'border-white/15 text-white/60 hover:text-white hover:border-white/30 hover:bg-white/[0.06]',
            )}
            onClick={(e) => e.preventDefault()}
          >
            {isFinished ? 'Read' : 'Continue'}
          </button>
        </div>
      </div>
    </Link>
  )
}
