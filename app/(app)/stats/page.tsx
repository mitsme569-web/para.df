'use client'

import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, Type, StickyNote, FileText, Loader2 } from 'lucide-react'

interface Stats {
  totalBooks: number
  totalWords: number
  totalNotes: number
  totalPagesRead: number
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-[#ffffeb]/30 animate-spin" />
      </div>
    )
  }

  const cards = [
    { label: 'Books', value: stats?.totalBooks || 0, icon: BookOpen, tile: '#0d4f46', iconColor: '#ffffff' },
    { label: 'Pages Read', value: stats?.totalPagesRead || 0, icon: FileText, tile: '#13796a', iconColor: '#ffffff' },
    { label: 'Words Saved', value: stats?.totalWords || 0, icon: Type, tile: '#0d4f46', iconColor: '#ffffff' },
    { label: 'Notes Written', value: stats?.totalNotes || 0, icon: StickyNote, tile: '#13796a', iconColor: '#ffffff' },
  ]

  return (
    <div className="min-h-screen bg-[#1a1a1a] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#ffffeb]/90">Stats</h1>
            <p className="text-xs text-[#ffffeb]/35">Your reading journey in numbers</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, value, icon: Icon, tile, iconColor }) => (
            <div
              key={label}
              className="rounded-2xl border border-[#ffffeb]/[0.08] p-5 flex flex-col gap-3 bg-[#ffffeb]/[0.02]"
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: tile }}
              >
                <Icon className="h-5 w-5" style={{ color: iconColor }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#ffffeb]">{value.toLocaleString()}</p>
                <p className="text-[11px] text-[#ffffeb]/40 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Empty state if no data */}
        {stats && stats.totalBooks === 0 && (
          <div className="mt-12 text-center">
            <p className="text-sm text-[#ffffeb]/30">Start reading to see your stats grow!</p>
          </div>
        )}
      </div>
    </div>
  )
}
