import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })

let schemaChecked = false
export async function ensureGenreColumn() {
  if (schemaChecked) return
  try {
    await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS genre text;`
    schemaChecked = true
  } catch (err) {
    console.warn('Could not alter table books to add genre column:', err)
  }
}

let rotationChecked = false
export async function ensureStickyNoteRotationColumn() {
  if (rotationChecked) return
  try {
    await sql`ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS rotation real DEFAULT 0;`
    rotationChecked = true
  } catch (err) {
    console.warn('Could not alter table sticky_notes to add rotation column:', err)
  }
}
