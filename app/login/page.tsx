'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'

function MinimalLoginForm() {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('from') || '/books'

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!pin.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Incorrect PIN')
      }

      // Success: navigate to destination
      window.location.href = returnTo
    } catch (err: any) {
      setError(err?.message || 'Incorrect PIN')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPin('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#111817] select-none overflow-hidden">
      {/* ── Ambient Background Blur Patches (matches brand palette) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[380px] rounded-full bg-gradient-to-br from-[#0d4f46]/40 via-[#13796a]/20 to-transparent blur-[130px]" />
        <div className="absolute bottom-16 right-1/4 w-[380px] h-[280px] rounded-full bg-gradient-to-bl from-[#f0d7ff]/8 via-[#0f6357]/15 to-transparent blur-[110px]" />
      </div>

      {/* ── Minimal Handwritten Lock ── */}
      <div
        className={`relative z-10 flex flex-col items-center gap-6 w-full max-w-[340px] text-center transition-transform duration-300 ${
          shake ? 'animate-[shake_0.4s_ease-in-out]' : ''
        }`}
      >
        {/* Handwritten Headline */}
        <h1
          style={{ fontFamily: "'Caveat', cursive, sans-serif" }}
          className="text-4xl sm:text-5xl font-semibold text-[#ffffeb] tracking-wide leading-tight drop-shadow-md"
        >
          Enter the PIN
        </h1>

        {/* Minimal Input Box */}
        <form onSubmit={handleSubmit} className="w-full relative">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={7}
              value={pin}
              onChange={(e) => {
                let val = e.target.value.replace(/[^0-9a-zA-Z]/g, '')
                if (val.length > 7) val = val.slice(0, 7)
                if (val.length >= 4) {
                  val = val.slice(0, 3) + val[3].toUpperCase() + val.slice(4)
                }
                setPin(val)
                if (error) setError(null)
              }}
              disabled={loading}
              className={`w-full h-13 px-5 pr-12 text-center text-2xl tracking-[0.35em] font-mono font-medium rounded-2xl bg-black/40 backdrop-blur-xl border text-[#ffffeb] focus:outline-none transition-all duration-200 shadow-[0_12px_36px_rgba(0,0,0,0.5)] ${
                error
                  ? 'border-rose-500/70 focus:border-rose-500 ring-1 ring-rose-500/30'
                  : 'border-white/15 focus:border-[#13796a] focus:ring-1 focus:ring-[#13796a]/50'
              }`}
            />

            {/* Enter/Submit button inside input */}
            <button
              type="submit"
              disabled={loading || !pin.trim()}
              title="Submit PIN"
              className="absolute right-2.5 h-8 w-8 rounded-xl bg-white/10 hover:bg-[#13796a] disabled:opacity-0 disabled:pointer-events-none text-[#ffffeb] transition-all flex items-center justify-center cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#ffffeb]" />
              ) : (
                <ArrowRight className="h-4 w-4 text-[#ffffeb]" />
              )}
            </button>
          </div>

          {/* Handwritten error note */}
          {error && (
            <p
              style={{ fontFamily: "'Caveat', cursive, sans-serif" }}
              className="mt-3 text-xl text-rose-400 font-medium animate-in fade-in duration-150"
            >
              {error.toLowerCase()}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#111817]" />}>
      <MinimalLoginForm />
    </Suspense>
  )
}
