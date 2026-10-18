import { defineConfig } from 'drizzle-kit'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// drizzle-kit does not auto-load Next.js `.env.local`, so read it here.
if (!process.env.DATABASE_URL) {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      const value = line.slice(eq + 1).trim()
      if (key && !process.env[key]) process.env[key] = value
    }
  } catch {
    // no .env.local present; rely on existing process.env
  }
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
