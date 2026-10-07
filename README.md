# Flawless

Flawless is a browser-based cybersecurity platform built around two products:

- **Flawless Guard** — a *defensive* scanner. Drop a file, paste a URL, or paste raw email headers, and Flawless asks 70+ antivirus / reputation engines (via VirusTotal) what they think. You get a verdict (safe / suspicious / malicious), a per-engine breakdown, and a plain-English explanation of the threat category.
- **Flawless Vanguard** — an *offensive* / educational view of the same intel. Instead of a "clean vs bad" verdict, Vanguard maps the target to up to 12 attack-vector profiles (XSS, SQLi, phishing, DDoS, cryptojacking, etc.) with a short exploit path and an example payload for each. It also ships a domain/IP recon toolkit (DNS, TLS, WHOIS, categories) and a set of curated learning paths with progress tracking.

The whole thing runs in a modern browser, supports **English + Arabic** (with full RTL), has a **dark/light theme**, and backs user data with Supabase.

---

## Table of contents

1. [What you can do with it](#what-you-can-do-with-it)
2. [How a scan actually flows end-to-end](#how-a-scan-actually-flows-end-to-end)
3. [Tools & libraries used](#tools--libraries-used)
4. [Project architecture](#project-architecture)
5. [Folder layout](#folder-layout)
6. [Getting it running locally](#getting-it-running-locally)
7. [How the Supabase side works](#how-the-supabase-side-works)
8. [Known limitations / honest caveats](#known-limitations--honest-caveats)

---

## What you can do with it

- Sign up or log in with an **email or username + password** (Supabase Auth).
- Scan three kinds of inputs:
  - **File** — we hash it locally with SHA-256 and only send the hash. The file bytes never leave your machine.
  - **URL** — we submit the URL to VirusTotal, poll until engines finish, and show the aggregated verdict.
  - **Email headers** — we pull the first URL out of the pasted headers and scan that.
- See a **per-engine table** (which AV flagged it, which said clean, which timed out) with a "show all 70+" toggle.
- Expand a **Read more** panel that explains the threat category in plain language and lists concrete mitigations.
- Browse your **persistent scan history** across devices — it's keyed to your account via Row-Level Security.
- Flip to **Vanguard** and see the same target through an offensive lens: attack vectors, severity badges, exploit paths, example payloads.
- Run **Recon** on any domain or IP: reputation score, DNS resolutions, TLS certificate details, WHOIS, VT categories.
- Switch language (EN ↔ AR, RTL-aware) and theme (dark ↔ light) from the top-right.

---

## How a scan actually flows end-to-end

This is the single most useful thing to understand about the project, because almost every feature is a variation on it. Here it is for a **URL scan**:

```
┌──────────────┐   1. user pastes URL
│   Browser    │
│  (React app) │
└──────┬───────┘
       │
       │ 2. supabase.functions.invoke('virustotal-proxy', { action: 'scan-url', url })
       ▼
┌────────────────────────┐
│  Supabase Edge Function│   ← Deno runtime, holds the VT API key in env
│   virustotal-proxy     │
└──────┬─────────────────┘
       │
       │ 3. POST https://www.virustotal.com/api/v3/urls
       ▼
┌──────────────┐
│ VirusTotal   │  ← returns an analysisId (scan queued)
└──────┬───────┘
       │
       │ 4. client polls `get-analysis` every 3s
       │    until attributes.status === 'completed'
       ▼
   engines results → stats → verdict + per-engine table → UI
       │
       │ 5. if logged in, INSERT into scan_history (RLS scoped to user.id)
       ▼
   your scan appears in the History tab on any device you're logged into
```

A **file scan** is the same shape, minus step 3 — we skip submitting bytes. Instead, the browser computes the file's SHA-256 using `crypto.subtle.digest('SHA-256', ...)`, and the proxy does a single `GET /files/{hash}` against VT. If VT has never seen the hash, we return a friendly "unknown file" state instead of a 404 error.

An **email scan** regex-matches the first `https?://...` URL out of the pasted headers and reuses the URL flow above.

**Why a proxy?** Two reasons:
1. The VirusTotal API key is secret. If we put it in frontend code, anyone viewing the bundle could grab it and burn through our rate limit.
2. CORS. VT doesn't let browsers hit them directly anyway.

So the key lives as a Supabase edge-function secret (`VIRUSTOTAL_API_KEY`). The frontend only ever talks to our own function with an `action` name and the relevant input.

### How Vanguard classifies an attack vector

VirusTotal returns a detection *name* from each engine that flags a target (e.g. `"Trojan.GenericKD.83712"` or `"Phishing.URL.Generic"`). It does **not** return a clean machine-readable category. So Vanguard does its own keyword tally:

1. Collect every detection string across all engines.
2. For each of the 12 attack-vector profiles, count how many of its keywords appear in that joined text (`phish`, `trojan`, `sqli`, `spoof`, `miner`, etc.).
3. Sort vectors by score descending.
4. If nothing matched (common for clean targets), fall back to "most-common-web-surfaces" so the user still sees something educational (XSS / CSRF / Clickjacking).

This is intentionally simple — no ML, no fancy model — and that keeps it fast, explainable, and debuggable.

---

## Tools & libraries used

Grouped by what they're actually for, so you can tell them apart.

**Framework / build**
- **React 18** — UI component model.
- **Vite 5** — dev server + build tool. Fast HMR, zero config for most things.
- **TypeScript 5** — static types. Lets the editor autocomplete Supabase table columns, VT response fields, etc.

**Styling**
- **Tailwind CSS v3** — utility classes for 95% of styling.
- **shadcn/ui** — a set of copy-pasted, Tailwind-styled React components built on Radix UI primitives (Dialog, Tabs, Toast, Accordion, etc.). They live in `src/components/ui/` and you can edit them directly.
- **Radix UI** — the headless, accessible primitives underneath shadcn.
- **lucide-react** — SVG icon pack (`Shield`, `Skull`, `Lock`, ...).
- **CSS variables in HSL** — the dark/light theme is one set of `--primary`, `--background`, `--border`, etc. tokens swapped between `.dark` and `:root`. No theme context needed in individual components.

**Animation & 3D**
- **framer-motion** — mount/exit animations, layout transitions.
- **@react-three/fiber + @react-three/drei + three** — the 3D "security shield" on the landing page. It changes colour based on the current scan state (idle / safe / suspicious / malicious).

**Routing & data**
- **React Router DOM v6** — pages and navigation.
- **@tanstack/react-query** — cache + async state for data fetched from Supabase (scan history, learning path progress, etc.).

**i18n**
- **i18next + react-i18next** — translation engine.
- **i18next-browser-languagedetector** — picks EN / AR on first load.
- Full **RTL** flip handled with Tailwind's logical properties (`ps-`, `pe-`, `start-`, `end-`).

**Backend (Supabase)**
- **Postgres** — `profiles`, `scan_history` tables.
- **Row-Level Security** — the reason you can only see your own scan history even though everyone queries the same table.
- **Supabase Auth** — email/password + a `profiles` mirror so we can look up users by username.
- **Edge Functions (Deno)** — `virustotal-proxy` and `recon`, see above.

**Testing / tooling**
- **Playwright** — end-to-end tests live in `tests/e2e`. Config is in `playwright.config.ts`.
- **ESLint** — code lint.

---

## Project architecture

### Frontend

```
src/
├── pages/            # one file per route (/, /auth, /guard, /vanguard, /history, /learning/:slug, ...)
├── components/       # reusable UI (Navigation, ScannerHub, SecurityShield, FeaturesGrid, ...)
│   ├── ui/           # shadcn primitives — owned by us, edit freely
│   └── vanguard/     # Vanguard-specific (VanguardScanner, ReconPanel, LearningPaths)
├── contexts/         # AuthContext + ThemeContext — global state, one provider each at App root
├── hooks/            # useAuth, useToast, ...
├── integrations/
│   └── supabase/     # the single supabase-js client instance + generated DB types
├── i18n/             # i18next init + EN/AR JSON bundles
└── lib/              # tiny helpers (cn() classname merger, etc.)
```

The component style is deliberately boring: **function components + hooks**, local `useState` for UI state, React Query for server state, a context only when state is truly global (auth, theme). No Redux, no MobX, no Zustand.

### Backend (Supabase)

Tables — full definitions live in `supabase/migrations/`:

| Table               | What it holds                                            |
|---------------------|----------------------------------------------------------|
| `profiles`          | Mirror of `auth.users` with `username`, `email`, `display_name`. Auto-populated by a trigger on sign-up. Used to resolve username → email at login. |
| `scan_history`      | One row per scan. `user_id`, `scan_type`, `target`, `verdict`, `detected`, `total_engines`, `stats` (jsonb), `file_hash`, `created_at`. |

Every user-owned table has RLS policies that restrict `SELECT` / `INSERT` / `UPDATE` / `DELETE` to rows where `auth.uid() = user_id`. So even though the Supabase anon key is public, a user literally cannot read another user's history.

Edge functions:

| Function           | Purpose                                                   |
|--------------------|-----------------------------------------------------------|
| `virustotal-proxy` | Actions: `scan-url`, `get-analysis`, `scan-file`. Holds the VT API key. |
| `recon`            | Given a domain or IP, returns VT base record + resolutions + comments merged into one response. |

Both are public (`verify_jwt = false`) because they're also used by unauthenticated "guest mode" scans. The VT key never lives in the browser either way.

---

## Folder layout

```
HERE/
├── index.html                # Vite entry, meta tags, preloaded fonts
├── vite.config.ts            # dev server port (8080), `@` path alias
├── tailwind.config.ts        # theme tokens, animation keyframes
├── tsconfig*.json            # TS config (strict on app, looser on node tooling)
├── playwright.config.ts      # e2e test runner config
├── src/                      # frontend source (see above)
├── public/                   # static assets shipped as-is
├── supabase/
│   ├── config.toml           # project ref + function flags
│   ├── functions/            # Deno edge functions
│   │   ├── virustotal-proxy/
│   │   └── recon/
│   └── migrations/           # SQL schema history
├── tests/e2e/                # Playwright specs
├── .env.example              # template — copy to .env and fill in
└── README.md                 # this file
```

---

## Getting it running locally

**1. Install dependencies**

```bash
npm install
```

**2. Fill in environment variables**

```bash
cp .env.example .env
```

Then open `.env` and fill in:

- `VITE_SUPABASE_URL` — your Supabase project URL (`https://<project-ref>.supabase.co`).
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the `anon` public API key from Supabase → Project Settings → API.
- `VITE_SUPABASE_PROJECT_ID` — the project ref itself (`<project-ref>`).
- `VITE_VIRUSTOTAL_API_KEY` — only if you want to bypass the edge function and call VT directly for dev. The deployed app does not use this.

> Note: the `VITE_` prefix is important. Vite only exposes variables starting with `VITE_` to the browser bundle. Anything *without* that prefix stays server-side (used by Supabase CLI, edge functions, etc.).

**3. Start the dev server**

```bash
npm run dev
```

The app runs on [http://localhost:8080](http://localhost:8080).

**4. (Optional) Deploy edge functions**

If you're running your own Supabase project and want scans to work, push the functions up:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set VIRUSTOTAL_API_KEY=<your-vt-key>
npx supabase functions deploy virustotal-proxy
npx supabase functions deploy recon
```

**5. (Optional) Run the e2e tests**

```bash
npx playwright install   # first time only — downloads browsers
npm run dev &            # make sure the app is running
npx playwright test
```

---

## How the Supabase side works

### Authentication

- Sign up collects: **display name**, **username** (3–20 chars, `[a-zA-Z0-9_]`), **email**, **password**.
- Username is stored both in Supabase Auth metadata (via `options.data`) *and* in the public `profiles` table. The `profiles` row is created automatically by a `handle_new_user` trigger on `auth.users` INSERT.
- Log-in accepts **email or username**. If the identifier doesn't contain `@`, the Auth page queries `profiles.username` to find the matching `email`, then calls `signInWithPassword({ email, password })`. This is necessary because `auth.users` is not directly readable from the browser — `profiles` is our readable mirror.
- Password reset uses `supabase.auth.resetPasswordForEmail(...)` with a redirect to `/reset-password`.

### Scan history persistence

After every scan, if a user is logged in:

```ts
await supabase.from('scan_history').insert({
  user_id: user.id,
  scan_type: 'file' | 'url' | 'email' | 'vanguard-url' | ...,
  target,
  verdict,
  detected,
  total_engines,
  stats,   // jsonb — the full VT stats object
  file_hash,
});
```

The History tab at `/history` just `SELECTs` from the same table ordered by `created_at DESC`. RLS makes sure you only see your own.

### Guest mode

If you're not logged in, scans still work — we just skip the `INSERT` step. This is enforced by a `null`-check on `user` in the scan handlers, not by Supabase permissions (guests don't have `auth.uid()` so they couldn't write anyway).

---

## Known limitations / honest caveats

- **VirusTotal free-tier rate limits.** 4 requests/min on the public API. If you hammer it, scans will start failing with 429. For production use you'd want a paid VT key or a request queue.
- **Email scanning is deliberately simple.** We only extract and scan the *first* URL out of the headers. A real email threat detector would analyse SPF/DKIM/DMARC headers, check sender reputation, cross-reference Received chains, etc. We don't do any of that — this is a teaching-focused UI.
- **Attack-vector classification is keyword-based**, not ML. That's a feature, not a bug (it's explainable and auditable), but it means a cleverly-named detection that doesn't contain any of our keywords won't classify correctly.
- **No server-side VT polling.** The browser polls the edge function in a 3-second loop for up to 15 attempts. If you close the tab mid-scan, the scan is orphaned — it'd keep running at VT but you'd never see the result. For long-running scans a background worker would be the right move.
- **The 3D shield is purely decorative.** It reacts to scan state but doesn't affect behaviour.
- **Scan history does not deduplicate.** Scanning the same URL 5 times in a row creates 5 rows.

---

If something here drifts out of date (schema changes, new tables, etc.), the source of truth is `supabase/migrations/` and the code itself — treat this README as an overview, not a spec.
