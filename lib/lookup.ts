// ─── Shared meaning resolver ────────────────────────────────────────────────
// Single decision point used by both /api/words/define and /api/words/explain:
//   • a single word that the free dictionary knows  → dictionary (0 Groq credits)
//   • a longer selection OR a dictionary miss        → Groq AI fallback
// The AI prompt is kept simple + low-credit here so every lookup behaves the
// same and output stays easy to understand.

import { lookupDictionary } from '@/lib/dictionary'
import { groqChat, isGroqConfigured } from '@/lib/groq'

const SYSTEM_PROMPT =
  'Explain the meaning of the word or passage below in very simple, everyday English that anyone can understand. Use just 1-2 short sentences. Plain text only — no markdown, no headings, no extra words.'

export interface MeaningResult {
  meaning: string | null
  source: 'dictionary' | 'ai' | 'not-found'
}

export async function resolveMeaning(
  rawText: string,
  ctx?: { bookTitle?: string; page?: number },
): Promise<MeaningResult> {
  const trimmed = rawText.trim()
  const isSingleWord = !/\s/.test(trimmed) && trimmed.length <= 30

  // 1) Single word → free dictionary first (no AI credits).
  if (isSingleWord) {
    const dict = await lookupDictionary(trimmed)
    if (dict.meaning) return { meaning: dict.meaning, source: 'dictionary' }
    // dictionary miss → fall through to AI below
  }

  // 2) Longer selection OR dictionary miss → Groq AI, when configured.
  if (!isGroqConfigured()) return { meaning: null, source: 'not-found' }

  const prefix = ctx?.bookTitle
    ? `From "${ctx.bookTitle}"${ctx.page ? `, p.${ctx.page}` : ''}. `
    : ''
  const ai = await groqChat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${prefix}"${trimmed.slice(0, 1200)}"` },
    ],
    { temperature: 0.3, maxTokens: 140 },
  )
  return { meaning: ai, source: 'ai' }
}
