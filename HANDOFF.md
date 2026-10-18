# Paradict — Codebase Handoff

> Full context for continuing development. Written for hand-off to another IDE / agent.
> Last updated: 2026-10-18.

## 1. Project Overview & Stack

**Paradict** — a PDF reading + annotation + dictionary web app (read books, highlight, take notes, look up words).

- **Framework:** Next.js 15.5 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind CSS (`tailwind.config.ts`, custom `brand-*` colors)
- **PDF rendering:** `pdfjs-dist@4.9` (worker loaded from cdnjs CDN)
- **Database:** Neon PostgreSQL via Drizzle ORM (`@neondatabase/serverless` + `drizzle-orm/neon-http`)
- **Storage:** Supabase Storage (PDFs), Cloudinary (covers)
- **Icons:** `lucide-react`
- **Other deps:** `@tanstack/react-query`, `@radix-ui/*`, `zod`, `clsx` + `tailwind-merge` (via `cn()` in `lib/utils.ts`)
- **Env:** Windows, PowerShell — **use `;` not `&&`**. Dev server: `npm run dev` (localhost:3000). DB push: `npm run db:push`.

## 2. File Map

```
app/
├── (app)/              # library shell: books/, notes/, paradict/, stats/ + layout + navbar
├── (viewer)/books/[bookId]/page.tsx   # ★ THE PDF READER (main file, ~1177 lines)
├── api/
│   ├── books/route.ts                  # GET all, POST create
│   ├── books/[id]/route.ts             # GET / PATCH(progress) / DELETE(book+files)
│   ├── books/[id]/highlights/route.ts  # GET(all|?page) POST DELETE(all|?page)
│   ├── books/[id]/notes/route.ts       # GET all, POST
│   ├── highlights/[id]/route.ts        # single
│   ├── notes/[id]/route.ts             # PATCH / DELETE single
│   ├── words/route.ts                  # GET all, POST save word
│   ├── words/[id]/route.ts             # single
│   ├── words/define/route.ts           # ★ free dictionary (dictionaryapi.dev)
│   ├── reading-sessions/route.ts       # POST stats
│   ├── stats/route.ts
│   └── upload/pdf/ & upload/cover/     # ingestion
├── layout.tsx, page.tsx, globals.css
lib/
├── db/schema.ts, db/index.ts
├── supabase.ts (getSignedPdfUrl, deletePdf), cloudinary.ts, r2.ts
├── pdf.ts, fingerprint.ts, store.ts, utils.ts
```

## 3. Data Model (`lib/db/schema.ts`)

- **books**: id, fingerprint(unique), title, fileName, coverUrl, pdfKey, pageCount, lastPage, timestamps
- **highlights**: id, bookId→books (cascade), page, text, color, isBold, **rects jsonb** `[{x,y,w,h}]` normalized, createdAt
- **stickyNotes**: id, bookId (cascade), page, content, x, y, width, height, bgColor, textColor, fontSize, **kind** `'note'|'textbox'`
- **words**: id, word, meaning, sentence, bookId (set null), page, **source** `'lookup'|'saved'|'manual'`, createdAt
- **readingSessions**: id, bookId (cascade), pagesRead, durationSec, date

All annotations are **page-scoped** and coordinates are **normalized fractions** (0–1) of the page/stage, so they survive zoom.

## 4. The Viewer (`app/(viewer)/books/[bookId]/page.tsx`) — how it works

**Continuous vertical page-flow:**
- Scrolls a **window** of pages `[currentPage-3 … currentPage+5]` with top/bottom spacer divs sized by `pitch = pageSize.h + PAGE_GAP(24)` to preserve total scroll height.
- `currentPage` is **derived from scroll position** (page at viewport centre) via a rAF-throttled scroll listener.
- `goToPage` = smooth `scrollTo`; keyboard (Arrow/PageDown/Space) scrolls continuously.
- All notes + highlights loaded **once** into `allNotes`/`allHighlights`; each `PageView` filters to its own page.

**`PageView` component (the critical renderer):**
- Each page owns its **own canvas + text layer**.
- Renders are **serialized** through a promise chain (`chainRef`) + a monotonic `seqRef` guard; cleanup **cancels both the render task and the text layer**. This fixed the "same canvas during multiple render()" crash + missing text under React 19 StrictMode.
- Canvas renders first (`await task.promise`), **then** the `TextLayer` is built via `new pdfjsLib.TextLayer({ textContentSource: page.streamTextContent(), ... })`.
- DOM markers: `data-stage`, `data-page`, `data-page-wrap` on each page.
- Lazy paint via `IntersectionObserver` (`rootMargin: '800px'`); `eager` bootstraps the current page.

**Highlight capture (`handleMouseUp`):**
- **Synchronous.** Merges the browser's `Range.getClientRects()` into per-line **selection bands** (bucket by `Math.round(top/8)`) for the **horizontal** extent (word-accurate), then takes the **vertical** extent from the page's real PDF text metrics — normalized glyph boxes (`baseline + font height`) built **once per page** and cached in `glyphCacheRef` by `PageView` (via `page.getTextContent()` at scale 1; **never `page.cleanup()`** — the proxy is shared with the live text layer). Falls back to the em-box merge if a page's glyphs aren't cached yet.
- Stored as `rects` (normalized 0–1) + `page`. `PageView` is `React.memo`'d and fed **stable** per-page arrays (`hlByPage`/`notesByPage` via `useMemo`) so selecting text no longer re-renders every visible page (was the ~600ms lag).

**Word lookup (`lookupWord`):** calls `/api/words/define` (free), shows a "meaning peek" card, saves to `/api/words`. `sendToClaude` just opens `claude.ai/new?q=…` (no API integration).

**Toolbars:** top bar (nav/zoom/undo/redo/save/journal/**MoreVertical → Delete Book dropdown**); right lavender **pill** (`PillBtn` w/ custom fade tooltip, `aria-label` only — no native `title`); highlight sub-bar (color circle + pen/eraser/clear/remove); color+thickness palette modal. `StickyNoteOverlay` supports drag/resize, color palette (shared by notes & text boxes), fade-out delete. Near the viewport top the selection toolbar flips **below** the selection so it isn't hidden behind the top bar.

## 5. What's DONE (recent, verified)

- ✅ Continuous page-flow reading (scroll-based, windowed, no canvas clash, full text paint)
- ✅ Highlight geometry merge/hug fix; page-anchored highlights
- ✅ Sticky notes + text boxes: smaller defaults, shared color palette, transparent-fill option for boxes, **200ms fade-out delete animation**
- ✅ Removed duplicate tooltips (native `title` off pill buttons)
- ✅ `DELETE /api/books/[id]` route already fully implemented (deletes PDF from Supabase + cover from Cloudinary + DB row cascades annotations)
- ✅ **Task 3 — Delete Book dropdown**: `MoreVertical` opens a dark menu → "Delete Book" (confirm → `DELETE /api/books/[id]` → `router.push('/books')`); click-outside + Escape close it; spinner while deleting.
- ✅ **Task 1 — Highlight alignment (re-architected)**: highlights now hug the true glyph baseline via **cached PDF text metrics** (see §4) — fixes "bars sit above the text / drift when zooming." Delivered as a synchronous cached hybrid, **not** the async `streamTextContent()` plan (that version lagged the toolbar and its `page.cleanup()` broke the live text layer).
- ✅ **Perf**: `PageView` wrapped in `React.memo` + stable `useMemo` per-page annotation arrays → selection no longer re-renders the whole page stack.
- ✅ **Sidebar toggle icon**: right-rail `NotebookPen` → `PanelLeftClose`/`PanelLeftOpen` (directional, reflects open state).
- ✅ **Selection toolbar flip** near viewport top (renders below the selection instead of hiding behind the top bar).
- ✅ **Color palette lock**: `stats`, `paradict`, `notes` pages restricted to the 4 brand colors (`#1a1a1a`, `#034f46`, `#ffffeb`, `#f0d7ff`) + alpha variants.
- ✅ **Paradict saved-word cards — typography pass** (`app/(app)/paradict/page.tsx`): a saved entry's `word` field can be a single term OR a long saved passage, so it now branches on length — long text renders as a readable `line-clamp-4` excerpt (`text-[13.5px] font-normal leading-relaxed text-[#ffffeb]/85`) instead of the old heavy bold heading; short words stay a `truncate` semibold heading. Added clear hierarchy (meaning `/60`, example sentence `/40` in curly `&ldquo;&rdquo;` quotes, `Page N →` meta at 11px), `p-5` + `rounded-2xl` + lavender hover border, `[overflow-wrap:break-word]` to stop horizontal overflow, and a padded `aria-label` delete button. Palette-locked.
- ✅ **Paradict cards — badge → background-color typing**: removed the `SAVED`/`Manual` text badge entirely. Card type is now conveyed by background: `source === 'saved'` (text excerpts) → teal `bg-[#034f46]/30` + teal border; manual/lookup dictionary entries → lavender `bg-[#f0d7ff]/[0.08]` + lavender border. Both tints stay dark so cream text keeps strong contrast (excerpt bumped to `/90`).
- ✅ **Paradict — delete/add lag fixed (optimistic UI)**: delete now removes the card from state **instantly** and fires the `DELETE` in the background (rolls back on failure) instead of `await DELETE` → full `GET` refetch. Add uses the `POST` response to prepend the new row (dropped the extra refetch). Card/button `transition-all` → `transition-colors` / `transition-[opacity,color,background-color]` to stop layout-paint jank. Root cause was sequential Neon serverless round-trips blocking the UI.
- ✅ **Groq AI integration (passage explanation)**: new `lib/groq.ts` (server-only helper calling Groq's OpenAI-compatible `/v1/chat/completions` via `fetch`, no SDK) + `POST /api/words/explain` route. The viewer's old "Send to Claude" external redirect is now an in-app **Explain passage** button that calls Groq and shows the answer in the peek card. Env: `GROQ_API_KEY` (required) + `GROQ_MODEL` (default `qwen/qwen3.8-27b`, override if your Groq catalog id differs). Route returns 503 with a friendly message when the key is absent. **Lean prompt** to save Groq credits: short system instruction, plain-language 1–2 sentence output, `maxTokens` 140, `temperature` 0.3, input sliced to 1200 chars.
- ✅ **External dictionary (free) shared + Explain fast-path**: extracted `lookupDictionary()` into `lib/dictionary.ts` (dictionaryapi.dev, no key / no AI credits); `/api/words/define` now uses it. `/api/words/explain` calls it **first for single words** and returns the dictionary meaning, only reaching Groq for multi-word passages or words the dictionary can't define — further cutting Groq credit usage.
- ✅ **Unified lookup resolver** (`lib/lookup.ts` → `resolveMeaning()`): single decision point used by BOTH `/api/words/define` and `/api/words/explain`. Rule — single word the dictionary knows → **dictionary** (0 credits); a **longer selection** OR a **dictionary miss** → **Groq AI** fallback. One simple, low-credit system prompt lives here (`maxTokens` 140, `temp` 0.3, input ≤1200 chars, plain 1–2 sentence output). Returns `{ meaning, source }` with `source` ∈ `dictionary | ai | not-found`; both routes map it to their existing shapes (`{word,meaning,source}` / `{explanation,source}`).

## 6. What's NEXT

### ~~Task 3 — Three-dot "Delete Book" menu~~ ✅ DONE
- Implemented (see §5): dropdown + confirm + `DELETE` + redirect + click-outside/Escape + deleting spinner.

### ~~Task 1 — Highlight alignment via real PDF text metrics~~ ✅ DONE (re-architected)
- Implemented via **cached glyph boxes** (see §4), not the async `streamTextContent()` plan.
- **Gotcha (still true):** highlights created *before* this fix keep their old em-box geometry and won't retro-align — re-highlight to get corrected placement.

### Task 2 — Dictionary + AI lookup with quota *(partially done)*
- ✅ **AI provider wired**: Groq via `lib/groq.ts` + `POST /api/words/explain` (passage explanation, shown in-app). Free lookup still works (`/api/words/define` → dictionaryapi.dev).
- ⏳ **Still pending:** (a) routing *definitions* through Groq for richer answers (optional — current free dictionary is non-breaking); (b) the **5/day quota** store + warning near exhaustion — needs a new table/column (e.g. `aiLookups` with `date` + `count`, or a `dailyQuota` table) and `npm run db:push`; (c) persisting explanations into `words`.
- **Gotcha:** the default model id `qwen/qwen3.8-27b` must match an entry in your Groq account's catalog — set `GROQ_MODEL` in `.env.local` if Groq rejects it.

### Task 4 — Freehand drawing tool *(needs schema + API + UI)*
- New **`drawings`** table: id, bookId (cascade), page, **strokes jsonb** (array of `{color, size, points:[{x,y}...]}` normalized), createdAt.
- New API route(s) under `/api/books/[id]/drawings` (GET all, POST, DELETE).
- UI: a **transparent `<canvas>` overlay** above each page's canvas in `PageView`; a pencil tool toggle; capture mousedown/move/up (and touch) → record points; render strokes; **reuse existing palette + thickness slider**; eraser clears strokes; persist on stroke end.
- **Gotcha:** the overlay must not block text selection when the draw tool is off (`pointer-events-none` unless active), and must respect the same serialized-render / dpr handling as `PageView`.

**Suggested order:** ~~Task 3~~ ✅ → ~~Task 1~~ ✅ → Task 2 → Task 4 → the open UX issues below.

### ⚠ Open UX issues raised 2026-10-18 (NOT yet fixed)
- **Selection toolbar overlaps the text being marked** — the floating pill covers the glyphs (see user screenshot); needs vertical clearance so it never sits on the selection.
- **Highlight boundary overflow** — some bars still bleed past exact character bounds (esp. partial / multi-line picks); tighten band→glyph clipping on the horizontal edges.
- **Animation / visual feedback feel sluggish** — review highlight placement + toolbar show/hide transitions for snappier, immediate confirmation.
- **Draggable overlay (sticky note / text box) reliability** — only appears under certain conditions; make it consistently triggerable across scenarios.
- (Sidebar toggle icon from this batch is already ✅ done — see §5.)

### ⚠ Build status note (2026-10-18, in-progress — not from the paradict work)
- The viewer `app/(viewer)/books/[bookId]/page.tsx` currently does **not** type-check: it references an undefined `liveDrag` value (L872) and `LiveDragState` type (L1129), plus implicit-`any` params at L1258. This is unfinished "live drag" code being added separately — resolve those before the build goes green.

## 7. Key Conventions & Pitfalls

- Normalized (0–1) coordinates everywhere for annotations → zoom-resilient.
- `db` from `@/lib/db`; Drizzle `neon-http` (serverless, no transactions).
- Supabase URL must be base project URL (no `/rest/v1/`).
- Client list fetches guard against non-array error responses (`if (Array.isArray(data))`).
- pdf.js: never two `render()` on one canvas; cancel tasks in effect cleanup; swallow `RenderingCancelledException` + `AbortException`.
- After visual fixes, **hard refresh** the browser.
- Pill buttons use custom fade tooltip + `aria-label`, never native `title`.

## 8. Quick Commands

```powershell
npm run dev          # start dev server (localhost:3000)
npm run db:push      # push schema changes to Neon
npm run type-check   # tsc --noEmit
```
