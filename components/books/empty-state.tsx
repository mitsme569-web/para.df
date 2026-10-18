import { BookOpen, Upload } from 'lucide-react'

export function EmptyState() {
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
          <BookOpen className="h-10 w-10 text-brand-teal/60" />
        </div>
        <div
          className="absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center
                     rounded-full bg-surface-raised border border-white/[0.07]"
        >
          <Upload className="h-4 w-4 text-white/30" />
        </div>
      </div>

      <div className="space-y-2 max-w-xs">
        <h3 className="text-base font-semibold text-white/80">No books yet</h3>
        <p className="text-sm text-white/35 leading-relaxed">
          Upload your first PDF above and it will appear here. Your library will grow with every book you add.
        </p>
      </div>
    </div>
  )
}
