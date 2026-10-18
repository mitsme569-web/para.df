'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, StickyNote, BookMarked, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Books',    href: '/books',    icon: BookOpen   },
  { label: 'Notes',    href: '/notes',    icon: StickyNote },
  { label: 'Paradict', href: '/paradict', icon: BookMarked },
  { label: 'Stats',    href: '/stats',    icon: BarChart3  },
] as const

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="fixed top-8 left-0 right-0 z-50">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">

        {/* ── Logo (left) ─────────────────────────── */}
        <Link href="/books" className="flex items-center gap-2 select-none group">
          <BookMarked className="h-5 w-5 text-brand-cream/90" />
          <span className="text-[15px] font-semibold tracking-tight text-brand-cream/90">
            Paradict
          </span>
        </Link>

        {/* ── Center pill nav (like Sherpa) ─────────── */}
        <nav
          className="hidden sm:flex items-center gap-0 rounded-full border border-white/10 p-1"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)' }}
        >
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200',
                  active
                    ? 'bg-white/15 text-brand-cream'
                    : 'text-white/50 hover:text-white/80',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', active ? 'text-brand-cream' : 'text-white/40')} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* ── Mobile nav (compact pills) ───────────── */}
        <nav
          className="flex sm:hidden items-center gap-0 rounded-full border border-white/10 p-0.5"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}
        >
          {navItems.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200',
                  active
                    ? 'bg-white/15 text-brand-cream'
                    : 'text-white/45',
                )}
              >
                <Icon className="h-3 w-3" />
                <span className={cn(active ? 'inline' : 'hidden xs:inline')}>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* ── Right spacer (balances logo) ─────────── */}
        <div className="w-20 hidden sm:block" />

      </div>
    </header>
  )
}
