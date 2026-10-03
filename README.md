# TCSM app

App voor de interne tennis- en padelevenementen van de club. Leden zien wie er al
ingeschreven is en schrijven zich zelf in, alleen of met een partner.

The app is a mobile-friendly website in Dutch that members can add to their home
screen. Plan and decisions: [TCSM club app plan](https://claude.ai/code/artifact/4a8707df-9878-474b-9e61-9c61ea169e3b).

## What it does (phase 1)

- **Accounts**: members sign up with name, email and password. An admin approves
  each account; until then the member only sees a "waiting for approval" page.
  The very first account that signs up becomes an approved admin automatically.
- **Roles**: member, organiser (manages events), admin (also approves accounts
  and assigns roles).
- **Events**: an organiser creates an event with one or more categories, each a
  sport (tennis or padel) and a format (singles or doubles), optionally with an
  extra name ("Gemengd") and a maximum number of players.
- **Registrations**: members register per category with their current ranking,
  pre-filled with the one they used last time. For doubles they pick a partner,
  who has to confirm with their own ranking, or register alone as "looking for a
  partner". Organisers pair up members who are looking for a partner.
- **Motivation**: the event list shows how many players and who already joined.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, server actions), TypeScript, Tailwind CSS
- [Supabase](https://supabase.com): Postgres, login and row level security.
  All registration rules (deadline, capacity, partners) live in database
  functions in `supabase/migrations/`.
- Hosting: [Vercel](https://vercel.com), deploying from this repository.

## Going live

1. **Supabase**: create a free project at supabase.com. In the SQL editor, run
   `supabase/migrations/20261002000000_initial_schema.sql`
   (or `npx supabase link` and `npx supabase db push`).
2. **Supabase auth settings** (Authentication → URL Configuration): set the Site
   URL to the address of the app, and add `https://<your-app>/auth/callback` to
   the redirect URLs. Optionally translate the email templates to Dutch.
3. **Vercel**: import this repository and set two environment variables, found in
   Supabase under Project Settings → API Keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. **First admin**: sign up yourself right after the first deploy. The first
   account becomes admin; approve everyone else under Beheer → Leden.

Note: free Supabase projects pause after a week without any activity; a paused
project is resumed from the Supabase dashboard.

## Local development

Requires Node 20.9+ and Docker.

```bash
npm install
npx supabase start          # local Supabase with the migration applied
cp .env.example .env.local  # fill in the URL and publishable key printed by supabase start
npm run dev                 # http://localhost:3000
```

The local Supabase does not send real emails; confirmation is switched off and
mails show up in Mailpit at http://127.0.0.1:54324.

Checks: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Rankings

The ranking lists are in `src/lib/rankings.ts`. Tennis en Padel Vlaanderen has
no public API for rankings, so members pick their own ranking when registering.
Each registration stores the ranking used at that moment.
