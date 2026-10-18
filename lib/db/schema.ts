import { pgTable, uuid, text, integer, timestamp, boolean, real, jsonb, date } from 'drizzle-orm/pg-core'

// ── Books ────────────────────────────────────────
export const books = pgTable('books', {
  id: uuid('id').primaryKey().defaultRandom(),
  fingerprint: text('fingerprint').unique().notNull(),
  title: text('title').notNull(),
  fileName: text('file_name').notNull(),
  coverUrl: text('cover_url'),
  pdfKey: text('pdf_key').notNull(),
  pageCount: integer('page_count').notNull(),
  lastPage: integer('last_page').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Highlights / text marks ──────────────────────
export const highlights = pgTable('highlights', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  page: integer('page').notNull(),
  text: text('text').notNull(),
  color: text('color').default('#FFFF00').notNull(),
  isBold: boolean('is_bold').default(false).notNull(),
  rects: jsonb('rects').notNull(), // [{x, y, w, h}, ...] normalized coords
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Sticky notes ─────────────────────────────────
export const stickyNotes = pgTable('sticky_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  page: integer('page').notNull(),
  content: text('content').default('').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  width: real('width').default(0.2).notNull(),
  height: real('height').default(0.15).notNull(),
  bgColor: text('bg_color').default('#FFFF00').notNull(),
  textColor: text('text_color').default('#000000').notNull(),
  fontSize: integer('font_size').default(14).notNull(),
  kind: text('kind').default('note').notNull(), // 'note' | 'textbox'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Dictionary (Paradict) ────────────────────────
export const words = pgTable('words', {
  id: uuid('id').primaryKey().defaultRandom(),
  word: text('word').notNull(),
  meaning: text('meaning'),
  sentence: text('sentence'),
  bookId: uuid('book_id').references(() => books.id, { onDelete: 'set null' }),
  page: integer('page'),
  source: text('source').default('lookup').notNull(), // 'lookup' | 'saved' | 'manual'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Reading sessions (for stats) ─────────────────
export const readingSessions = pgTable('reading_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookId: uuid('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  pagesRead: integer('pages_read').notNull(),
  durationSec: integer('duration_sec'),
  date: date('date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Types ────────────────────────────────────────
export type Book = typeof books.$inferSelect
export type NewBook = typeof books.$inferInsert
export type Highlight = typeof highlights.$inferSelect
export type NewHighlight = typeof highlights.$inferInsert
export type StickyNote = typeof stickyNotes.$inferSelect
export type NewStickyNote = typeof stickyNotes.$inferInsert
export type Word = typeof words.$inferSelect
export type NewWord = typeof words.$inferInsert
export type ReadingSession = typeof readingSessions.$inferSelect
