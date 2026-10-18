'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type UploadState = 'idle' | 'dragging' | 'processing'

interface UploadCardProps {
  onUpload: (file: File, onStatus?: (msg: string) => void) => Promise<{ bookId: string; alreadyExists: boolean }>
}

export function UploadCard({ onUpload }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [state, setState] = useState<UploadState>('idle')
  const [status, setStatus] = useState('')

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.')
      return
    }

    setState('processing')
    try {
      const { bookId, alreadyExists } = await onUpload(file, setStatus)

      if (alreadyExists) {
        setStatus('Book already exists! Opening...')
      } else {
        setStatus('Done! Opening viewer...')
      }

      await new Promise((r) => setTimeout(r, 400))
      router.push(`/books/${bookId}`)
    } catch (err: any) {
      console.error('Upload failed:', err)
      alert(err?.message || 'Upload failed. Please try again.')
      setState('idle')
      setStatus('')
    }
  }, [onUpload, router])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setState('idle')
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setState('dragging') }}
      onDragLeave={() => setState('idle')}
      onDrop={onDrop}
      onClick={() => state !== 'processing' && inputRef.current?.click()}
      className={cn(
        'relative w-full max-w-lg mx-auto',
        state !== 'processing' && 'cursor-pointer',
        'rounded-xl transition-all duration-300',
        state === 'dragging' && 'scale-[1.01]',
      )}
      role="button"
      tabIndex={0}
      aria-label="Upload a PDF book"
      onKeyDown={(e) => e.key === 'Enter' && state !== 'processing' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
        id="pdf-upload-input"
      />

      <div
        className={cn(
          'flex items-center gap-3 rounded-xl',
          'border transition-colors duration-300',
          'h-12 px-4',
          state === 'dragging'
            ? 'border-white/25 bg-white/[0.08]'
            : 'border-white/[0.10] bg-white/[0.04]',
        )}
        style={{ backdropFilter: 'blur(16px)' }}
      >
        {state === 'processing' ? (
          <Loader2 className="h-4 w-4 text-white/35 animate-spin shrink-0" />
        ) : (
          <Upload className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            state === 'dragging' ? 'text-white/50' : 'text-white/25',
          )} />
        )}

        <span className="flex-1 text-[13px] text-white/30 truncate font-light select-none">
          {state === 'processing'
            ? status
            : state === 'dragging'
            ? 'Drop it here...'
            : 'Drop your PDF here or click to browse...'}
        </span>

        {state !== 'processing' && (
          <span
            className={cn(
              'shrink-0 rounded-lg px-5 py-1.5 text-[12px] font-semibold',
              'bg-brand-cream text-brand-dark',
              'hover:bg-white transition-colors duration-200',
            )}
          >
            Upload
          </span>
        )}
      </div>
    </div>
  )
}
