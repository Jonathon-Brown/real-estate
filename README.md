# ShootLink

Real estate photographers upload a shoot and get a shareable link. The agent
opens the link, sees a clean gallery, downloads the photos, and copies an
AI-generated MLS listing description.

Next.js (App Router) + TypeScript + Tailwind, Supabase for Postgres and file
storage, Anthropic API for descriptions. Deploys to Vercel.

## First-time setup

1. **Create a Supabase project** at [database.new](https://database.new).

2. **Run the schema.** In the Supabase dashboard open *SQL Editor*, paste the
   contents of [`supabase/schema.sql`](supabase/schema.sql), and run it once.
   This creates the tables, security rules, and the storage bucket.

3. **Get your keys.** In *Project Settings → API*, copy the project URL, the
   `anon` key, and the `service_role` key.

4. **Configure the app.**

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in the values you just copied. `ANTHROPIC_API_KEY` comes from
   [console.anthropic.com](https://console.anthropic.com) — it powers the
   "Generate description" button and never leaves the server.

5. **Run it.**

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000 — you'll be redirected to the login page.
   Enter your email, click the magic link it sends you, and you land on the
   dashboard.

### Notes on login

- Open the magic link **in the same browser** you requested it from — the
  sign-in handshake is tied to that browser.
- Supabase's built-in email service is heavily rate-limited (a couple of
  emails per hour). Fine for a single user; if you ever hit the limit, wait
  an hour or configure custom SMTP in Supabase auth settings.

## Project layout

- `app/dashboard` — photographer's side: create shoots, upload photos, copy links (login required)
- `app/login`, `app/auth` — magic-link sign-in flow
- `app/g/[slug]` — public gallery an agent sees (Phase 2)
- `lib/supabase` — database client helpers (browser and server variants)
- `proxy.ts` — refreshes the session and keeps `/dashboard` behind login
- `supabase/schema.sql` — the database schema; run in the Supabase SQL editor
