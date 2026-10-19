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

let authTablesChecked = false
export async function ensureAuthRateLimitTables() {
  if (authTablesChecked) return
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS auth_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        success BOOLEAN NOT NULL DEFAULT false,
        attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_attempts_account_time ON auth_attempts (account, attempted_at);

      CREATE TABLE IF NOT EXISTS account_ips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        UNIQUE (account, ip_address)
      );
      CREATE INDEX IF NOT EXISTS idx_account_ips_account ON account_ips (account);
    `
    authTablesChecked = true
  } catch (err) {
    console.warn('Could not ensure auth rate limit tables:', err)
  }
}

