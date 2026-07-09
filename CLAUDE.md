# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Konsilys** (konsilys.fr) — a SaaS platform for ESNs (IT consulting firms): staffing, missions & margin, planning, absences with N+1 approval, recruitment and CRM. Multi-tenant, one isolated space per company.

## Stack & how it runs

- **Frontend:** plain HTML/CSS/**vanilla JavaScript — no framework, no build step, no npm, no bundler.** The Supabase JS client is loaded from a CDN `<script>`. To run locally, just open the HTML files in a browser (or `file://`).
- **Backend:** Supabase — PostgreSQL + auto-generated REST API + Auth (JWT) + Row Level Security. **Prod project id: `rwmstlesxnglpblrurqj`** (livemode).
- **Server-side logic:** Supabase **Edge Functions** in **TypeScript / Deno** (`supabase/functions/`).
- **Payments:** Stripe (livemode). **Hosting:** Vercel (front) + Supabase (data, in Europe).

Routes (`vercel.json`): `/`→`index.html` (landing + subscription tunnel), `/login`→`esn_login.html`, `/app`→`esn_manager_cgi.html` (the product), `/cgu`→`cgu.html`.

## Build / test / lint

No build step, no linter, no CI. There **is** a lightweight E2E suite:
- **E2E (Playwright, no npm)** — `node tests/e2e.cjs` loads the pages in `file://` with a stubbed Supabase CDN (runs offline) and checks landing/login/app-demo boot, navigation on every tab, and key features (forecast, BU/Practice margin). Non-zero exit on regression. Run it after any change to the front. See `tests/README.md`.
- **JS syntax check** — validate the `js/*.js` modules: `for f in js/*.js; do node --check "$f"; done` (or, for inline `<script>` blocks in `index.html`/`esn_login.html`):
  `node -e 'const fs=require("fs"),vm=require("vm");const h=fs.readFileSync("index.html","utf8");let m,re=/<script\b[^>]*>([\s\S]*?)<\/script>/gi;while((m=re.exec(h)))try{new vm.Script(m[1])}catch(e){console.log(e.message)}'`
- **Visual/behaviour check** — render with headless Chromium via Playwright (`/opt/node22/bin/node`, chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`). Take screenshots at 390px to check mobile. **LibreOffice/soffice is broken in this env** — don't use it; for PDFs, render HTML with Chromium `page.pdf()`.

## Frontend architecture (the important part)

`esn_manager_cgi.html` is the product app (a hand-rolled SPA). Its JavaScript is **split into ordered classic scripts under `js/`** (loaded via `<script src>` after the Supabase CDN, no build step). They share one global scope — **order matters**, and everything is `var`/`function` (no top-level `const`/`let`, which would not cross files). Modules by concern:
  `01-core` (Supabase client, date/fiscal utils, KPI engine, global state `S`, constants) · `02-recommendations` · `03-sidebar` (nav) · `04-dashboard` · `05-missions-planning` · `06-kpis` (KPIs + forecast/BU-Practice) · `07-leaves` · `08-access-admin` (Gestion des accès + audit log view) · `09-business` (CRM) · `10-help-tutorials` · `11-directeurs-modal` · `12-recrutement` · `13-render-events` (`render()` + `bind()` + dispatchers) · `14-data-boot` (`loadSB()`, `initApp()`, imports, approvals — ends with the `initApp()` bootstrap call).
- Global mutable state object **`S`** (in `js/01-core.js`). A single **`render()`** (`js/13-render-events.js`) rebuilds the view from `S`; call `render()` after mutating state.
- **Event delegation via `data-act` attributes** — buttons carry `data-act="..."` / `data-id="..."`, and one central click dispatcher (a long `if/else if` chain in `js/13-render-events.js`) routes them. To add a UI action, add the button with `data-act` AND a branch in that dispatcher.
- **`sb`** = Supabase client; **`SB_CID`** = the logged-in user's `company_id` (set after auth). **`loadSB()`** loads company data after login.
- Data reads go straight through the Supabase REST client (protected by RLS). Sensitive writes go to Edge Functions, never from the client.

`index.html` is a separate landing page + **subscription tunnel** (`#abonnement`) with its own inline JS: `CFG` state, `renderCfg()`, `subscribe()`. It also holds the mobile tab bar and the owner-licence chooser.

`esn_login.html` handles login and password-set for provisioned accounts (it captures the auth link type — invite vs recovery — before cleaning the URL).

## Core business invariants (do not break these)

- **Account creation happens ONLY through payment.** A company is usable only when `companies.active = true`. The app gates unusable companies behind `showPaywall()` (see `loadSB`, the `companies.select('active,...')` check). Never grant access without a paid subscription.
- **Roles** (6): `super_admin`, `admin`, `gestionnaire`, `sales` (labelled "Business Manager"), `recruteur`, `utilisateur`. `handle_new_user` reads `role` from signup metadata.
- **Multi-tenant isolation** is enforced by RLS using the `my_company_id()` SQL helper. Any new table with company data needs RLS scoped to `company_id = my_company_id()` — never `USING (true)`.
- **Cancellation:** the webhook sets `active=false` + `canceled_at=now()` (access blocked, data kept 1 year). `claim_subscription()` only *activates* — it never deactivates and never activates without a paid subscription row (inserted only by the webhook).
- **Provisioning:** on payment, `stripe-webhook` creates member accounts (`inviteUserByEmail`), a `consultants` fiche, and sets the buyer as N+1 (`pending_seats.invited_by_id`). Failed seats go to status `error` and can be re-run via the `retry-seats` function (admin button in Gestion des accès).

## Edge Functions & deployment

Functions in `supabase/functions/`:
- `stripe-webhook` — activates companies, records subscriptions, provisions seats, cuts access on cancel. **⚠️ MUST be deployed with `verify_jwt=false`** (Stripe sends no JWT; it verifies the Stripe signature instead). Deploying with the default `verify_jwt=true` silently breaks all payments.
- `seats-checkout` — builds the Stripe Checkout session; validates prices against an allowlist; first signup requires an owner licence (Admin **or** Super Admin, `OWNER_PRICES`).
- `billing-portal` — opens the Stripe Customer Portal (auto-creates the portal config if missing).
- `retry-seats` — re-runs provisioning for pending/errored seats (admin only).
- `create-checkout` — legacy, superseded by `seats-checkout`.
- `extract-cv` — reads a candidate's PDF CV (from `candidate-files` storage) and asks the Anthropic API to extract structured work experiences (forced tool-use schema), returned to the app to pre-fill the candidate's "Expériences" (for the CV Entreprise). **Requires the `ANTHROPIC_API_KEY` secret** (optional `CV_MODEL`). ⚠ Sends CV content to Anthropic (outside the EU) — RGPD arbitrage needed before enabling. `verify_jwt=true`.

**Deploys go through the Supabase MCP tools**, not a CLI: `deploy_edge_function` for functions (pass `verify_jwt` explicitly), `apply_migration` for DDL, `execute_sql` for data. The `supabase/migrations/*.sql` files are a record of migrations already applied to prod via MCP — there is no local Supabase/migration runner here.

Stripe price IDs are hardcoded and must stay consistent across three places: `index.html` (`PLANS`/`MODULES`), `seats-checkout` (`ALLOWED`/`OWNER_PRICES`), and `stripe-webhook` (`PRICE_MAP`). Each role has a monthly and an annual price (annual = 10× monthly, i.e. 2 months free).

## Git & deploy flow

- Production deploys from the **`main`** branch (Vercel). Work happens on a feature branch; **changes are NOT live on konsilys.fr until merged to `main`** (Edge Functions & DB migrations, however, are deployed directly to prod via MCP and take effect immediately, independent of git).
- The GitHub squash-merge commit will show as "Unverified" — this is expected and not something to fix.
