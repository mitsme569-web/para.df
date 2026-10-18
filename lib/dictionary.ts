// ─── External dictionary helper (server-side) ───────────────────────────────
// Uses the free Dictionary API (dictionaryapi.dev). No API key and no AI
// credits, so callers should prefer this for single-word lookups and fall back
// to Groq only for multi-word passages the dictionary can't explain.

export interface DictionaryResult {
  word: string
  meaning: string | null
  source: 'dictionary' | 'not-found' | 'error'
}

export async function lookupDictionary(rawWord: string): Promise<DictionaryResult> {
  const clean = rawWord.trim().toLowerCase()
  if (!clean) return { word: rawWord, meaning: null, source: 'not-found' }

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return { word: clean, meaning: null, source: 'not-found' }

    const data = await res.json()
    const entry = Array.isArray(data) ? data[0] : null

    // Build a concise, human-readable meaning from the first few definitions.
    let meaning = ''
    if (entry?.meanings) {
      const parts: string[] = []
      for (const m of entry.meanings.slice(0, 3)) {
        const pos = m.partOfSpeech ? `${m.partOfSpeech} — ` : ''
        const defs = (m.definitions || []).slice(0, 2).map((d: any) => d.definition)
        if (defs.length) parts.push(`${pos}${defs.join('; ')}`)
      }
      meaning = parts.join(' | ')
    }

    return { word: entry?.word || clean, meaning: meaning || null, source: 'dictionary' }
  } catch {
    return { word: clean, meaning: null, source: 'error' }
  }
}
