# paraDF — Read Deeper, Remember More

Personal reading app with PDF reader, personal dictionary (Paradict), sticky notes, and reading statistics.

---

## Security & Authentication

### Master PIN Lock
The application is guarded by a master PIN mechanism. Access requires a valid PIN meeting the following format:
* **Format**: 6 numbers with 1 capital letter in the 4th position (e.g., `283A719`).
* **Session**: Once entered, a secure, `httpOnly` cookie (`paradf_session`) is issued, remaining valid for 30 days so you do not have to re-enter it repeatedly.

### Rate Limiting Policy
To prevent brute-force attacks on the lock screen:
* **Hourly Limit**: Max 3 failed attempts per hour across all IPs combined.
* **Daily Limit**: Max 5 failed attempts per 24 hours.
* **IP Allowlist**: Up to 3 distinct IPs can access the account within a rolling 30-day window. Attempts from a 4th distinct IP are rejected (`HTTP 403`).
* **Persistence**: State is maintained in Neon PostgreSQL (`auth_attempts` and `account_ips`).

---

## Environment Variables

Copy `.env.example` to `.env.local` and populate the required keys:

```bash
cp .env.example .env.local
```

Required keys:
* `DATABASE_URL`: Neon PostgreSQL connection string.
* `APP_PIN`: Secret 7-character PIN (`^\d{3}[A-Z]\d{3}$`).
* `APP_AUTH_SECRET`: Random 32+ character string for HMAC signing.
* `GROQ_API_KEY`: Groq API key for dictionary meanings and passage explanations.
* `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Supabase storage credentials.
* `CLOUDINARY_*`: Cloudinary credentials for cover images.

---

## Development

```bash
# Run local dev server
npm run dev

# Run unit tests
npm test

# Type check
npm run type-check
```
