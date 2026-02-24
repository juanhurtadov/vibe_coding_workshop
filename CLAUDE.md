# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NodalIQ** — an AI-powered battery dispatch intelligence SaaS. The product analyzes ERCOT nodal LMP prices, runs an ML price forecast, solves an LP dispatch optimization, and delivers a plain-language daily recommendation via a LangGraph agent. Built for a vibe coding bootcamp with a 4-day deadline.

The repo is a monorepo:

- `nodaliq/` — the Next.js 16 app (primary working directory)
- `ml/` — Python ML layer deployed to Modal
- `environment.yml` — Conda env for Python/ML work (Modal, Prophet, PuLP, LangGraph)

## Commands

All commands run from `nodaliq/`:

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build (use this to verify before committing)
npm run lint     # ESLint check
npx tsc --noEmit # type-check without building (use when dev server is running)
```

To add a Shadcn component:

```bash
npx shadcn@latest add <component-name>
```

Modal ML layer (from repo root):

```bash
PYTHONUTF8=1 modal deploy ml/main.py
```

## Architecture

### Tech Stack

- **Framework**: Next.js 16.1.6, App Router, React 19, TypeScript (strict)
- **Styling**: Tailwind CSS v4 (CSS-based config in `app/globals.css` — no `tailwind.config.js`)
- **UI components**: Shadcn/ui (new-york style), Lucide icons
- **Charts**: Recharts
- **Map**: react-map-gl + Mapbox GL JS (`components/NodeMap.tsx`)
- **Import alias**: `@/` maps to `nodaliq/` root

### Tailwind v4 note

Config lives entirely in `app/globals.css` via `@theme inline { ... }` — not in a JS config file. CSS variables use `oklch()` color space.

### Next.js 16 proxy (middleware)

Next.js 16 renamed `middleware.ts` → `proxy.ts`. The Clerk auth proxy lives at `nodaliq/proxy.ts`. Do not create a `middleware.ts` — it will conflict.

### Route structure (App Router) — current state

```
app/
  page.tsx                        # public landing page ✅
  layout.tsx                      # root layout + ClerkProvider ✅
  globals.css                     # Tailwind v4 theme ✅
  (auth)/
    sign-in/[[...sign-in]]/       # Clerk SignIn ✅
    sign-up/[[...sign-up]]/       # Clerk SignUp ✅
  (dashboard)/
    layout.tsx                    # sidebar shell + auth guard ✅
    dashboard/page.tsx            # recommendation card + dispatch chart + node map ✅
    chat/page.tsx                 # RAG document chat ✅
    performance/page.tsx          # P&L tracker + revenue chart ✅
    settings/page.tsx             # battery profile form ✅
  api/
    health/route.ts               # DB connectivity check ✅
    ingest/route.ts               # fetch + store ERCOT DAM prices ✅
    forecast/route.ts             # call Modal Prophet forecaster ✅
    simulate/route.ts             # call Modal LP + RL in parallel ✅
    agent/run/route.ts            # full LangGraph pipeline ✅
    chat/route.ts                 # RAG query → GPT-4o ✅
    upload/route.ts               # PDF/CSV → chunk → embed → pgvector ✅
    nodes/route.ts                # latest LMP price per ERCOT hub node ✅
    performance/route.ts          # dispatch schedules + performance logs ✅
    settings/route.ts             # battery profile GET/POST ✅
```

### External services

| Service    | Purpose                                                                        | Status |
| ---------- | ------------------------------------------------------------------------------ | ------ |
| Neon       | Serverless Postgres + pgvector (DB + vector store)                             | ✅ Live |
| Clerk      | Auth                                                                           | ✅ Live |
| Modal      | Python serverless — hosts Prophet forecaster, PuLP optimizer, LangGraph agent | ✅ Live |
| OpenAI API | GPT-4o for agent synthesis; ada-002 for RAG embeddings                        | ✅ Live |
| ERCOT API  | Public day-ahead LMP price data (OAuth B2C_1_PUBAPI-ROPC-FLOW)                | ✅ Live |
| Mapbox     | ERCOT hub node map (dark-v11 style)                                            | ✅ Live |

### ML layer (`ml/` directory, deployed to Modal)

- `forecaster.py` — Prophet model trained on ERCOT historical prices
- `optimizer.py` — PuLP LP dispatch solver
- `rl_agent.py` — SAC (Soft Actor-Critic) policy trained offline on historical ERCOT price data
- `main.py` — Modal app with four `@modal.fastapi_endpoint` functions: `/forecast`, `/optimize`, `/rl`, `/agent`
- `prophet_model.stan` — Stan source extracted from the prophet sdist; bundled via `add_local_file`
- `agent.py` — LangGraph pipeline: fetch → forecast → optimize (LP + RL) → synthesize

#### Modal deployment

```bash
# From repo root (requires Modal CLI installed and authenticated)
PYTHONUTF8=1 modal deploy ml/main.py
```

**Live endpoints:**
| Function | URL |
|----------|-----|
| forecast | `https://juanhurtadov--nodaliq-ml-forecast.modal.run` |
| optimize | `https://juanhurtadov--nodaliq-ml-optimize.modal.run` |
| rl       | `https://juanhurtadov--nodaliq-ml-rl.modal.run` |
| agent    | `https://juanhurtadov--nodaliq-ml-agent.modal.run` |

**Modal image notes:**
- Must include `fastapi[standard]` explicitly (required since Modal 1.3.x for `@modal.fastapi_endpoint`)
- Use `PYTHONUTF8=1 modal deploy` on Windows to avoid charmap encoding errors
- Deploy from repo root, not `ml/` — the `ml/main.py` path is explicit

**Prophet wheel deployment gotcha (3 compounding issues, now fixed):**

The `prophet==1.1.6` PyPI wheel ships broken artifacts for Linux containers:
1. `prophet_model.bin` — pre-compiled manylinux binary, incompatible with Modal's Debian glibc
2. `cmdstan-2.33.1/` — bundled Windows CmdStan; `CmdStanPyBackend.__init__` calls `set_cmdstan_path()` on it and raises `ValueError: missing makefile`
3. `prophet_model.stan` — Stan source **not shipped** in the wheel at all (only in the sdist)

**Fix** (baked into `_compile_prophet` in `main.py`):
1. Extract `prophet_model.stan` from the sdist tarball locally → save to `ml/prophet_model.stan`
2. `add_local_file("prophet_model.stan", ".../prophet/stan_model/prophet_model.stan", copy=True)` mounts it before `run_function`
3. `_compile_prophet` removes the manylinux binary + the bundled Windows CmdStan, then compiles fresh with system CmdStan 2.38.0 via `cmdstanpy.CmdStanModel(stan_file=...)`, copies result to `prophet_model.bin`

To re-extract `prophet_model.stan` if needed:
```python
import tarfile
tf = tarfile.open("prophet-1.1.6.tar.gz")  # from: pip download prophet==1.1.6 --no-binary prophet
m = next(m for m in tf.getmembers() if m.name.endswith(".stan"))
open("ml/prophet_model.stan", "wb").write(tf.extractfile(m).read())
```

#### RL model design (SAC)
- **State:** `(soc, price_now, forecast_t+1..t+6, hour_of_day, day_of_week)`
- **Action:** continuous `[-1, 1]` scaled to max charge/discharge kW
- **Reward:** realized revenue per dispatch step; SOC/power limits enforced via action clipping + reward shaping
- **Artifact:** `ml/artifacts/sac_policy.pt` — serialized trained policy loaded at inference time

### Map component (`components/NodeMap.tsx`)

- `"use client"` component — must be dynamically imported with `ssr: false` to avoid mapbox-gl SSR errors
- Requires `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`; renders a placeholder if token is missing
- ERCOT hub node coordinates are hardcoded approximate lat/lng (HB_NORTH=Dallas, HB_SOUTH=San Antonio, HB_WEST=Midland, HB_HOUSTON=Houston)
- Node data (latest price) fetched from `GET /api/nodes` on mount
- Price color scale: violet (negative) → cyan (<$30) → green ($30–60) → amber ($60–100) → red (>$100)
- `onSelectNode` callback wired to dashboard node selector — clicking a pin changes the agent run target

### Design language

Dark theme (`bg-zinc-950`), cyan accent (`text-cyan-400`, `bg-cyan-500`). All new pages should follow this palette. Components come from `components/ui/` (Shadcn).

### Database Schema (Neon Postgres + pgvector)

Five tables. ORM: Drizzle. Driver: `@neondatabase/serverless`. Schema lives in `lib/schema.ts`.

**`battery_profiles`** — user's battery configuration
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | text | Clerk user ID (multi-tenant) |
| `name` | text | e.g. "Site A – Megapack" |
| `capacity_kwh` | real | total usable capacity |
| `max_charge_kw` | real | max charge rate |
| `max_discharge_kw` | real | max discharge rate |
| `round_trip_efficiency` | real | default 0.85 |
| `min_soc` | real | min state of charge, default 0.10 |
| `max_soc` | real | max state of charge, default 0.95 |
| `created_at` | timestamp | |

**`market_prices`** — ERCOT LMP data (multi-node)
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `node` | text | e.g. `"HB_NORTH"`, `"HB_WEST"` |
| `interval_start` | timestamp | |
| `price_per_mwh` | real | |
| `price_type` | text | `'DAM'` or `'RTM'` |
| `created_at` | timestamp | |

**`dispatch_schedules`** — LP optimizer output per day
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `battery_profile_id` | uuid FK | |
| `schedule_date` | date | |
| `node` | text | ERCOT node this run was computed against |
| `hourly_schedule` | jsonb | `[{hour, action, amount_kw, expected_revenue}]` |
| `total_expected_revenue` | real | |
| `recommendation_text` | text | LLM plain-language output |
| `created_at` | timestamp | |

**`performance_log`** — actual vs recommended outcomes
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `dispatch_schedule_id` | uuid FK | |
| `battery_profile_id` | uuid FK | |
| `log_date` | date | |
| `recommended_revenue` | real | agent projection |
| `actual_revenue` | real | filled in after day closes |
| `accuracy_pct` | real | actual / recommended |
| `created_at` | timestamp | |

**`documents`** — RAG source files, stored per chunk
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | text | |
| `filename` | text | |
| `content` | text | raw extracted text for this chunk |
| `chunk_index` | integer | chunk position within the source file |
| `embedding` | vector(1536) | pgvector, OpenAI `text-embedding-ada-002` |
| `created_at` | timestamp | |

### RAG pipeline (`lib/rag.ts`)

- `embedText(text)` — calls `text-embedding-ada-002`, trims to 8000 chars, returns `number[]`
- `chunkText(text, chunkSize=500, overlap=50)` — word-based sliding window, filters chunks < 20 chars
- `searchSimilarChunks(queryEmbedding, userId, limit=5)` — raw SQL with Drizzle `sql` tag using pgvector `<=>` cosine distance operator

### Known gotchas

- **`pdf-parse`** must be in `serverExternalPackages` in `next.config.ts` — otherwise Turbopack tries to bundle it and fails on its internal file reads
- **OpenAI client** must be instantiated inside handler functions (not at module level) — build-time page data collection runs without env vars
- **`pdf-parse` version** — pinned to `1.1.1` (v2.x has a completely different class-based API, incompatible with the simple `pdfParse(buffer)` interface)
- **`NodeMap`** must be dynamically imported with `ssr: false` — mapbox-gl accesses `window` and `navigator` at import time
- **`npx tsc --noEmit`** for type-checking when dev server is running (avoids the `EPERM` error from Next.js trying to clean `.next/` while the dev server holds file locks on Windows)
- **`selectDistinctOn`** in Drizzle requires the first `orderBy` column to match the `distinctOn` column — this is a Postgres requirement
- **Clerk redirect URLs** (`NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`) must be set in `.env.local` or Clerk sends users to the hosted sign-in page instead of `/sign-in`

## Build phases

1. ✅ Next.js foundation + landing page
2. ✅ Database schema (Neon) — 5 tables, pgvector, Drizzle ORM, health check route
3. ✅ Auth (Clerk) — ClerkProvider, proxy middleware, sign-in/up pages, protected dashboard shell with sidebar
4. ✅ ERCOT data pipeline — `lib/ercot.ts` full OAuth (B2C_1_PUBAPI-ROPC-FLOW), real DAM prices in Neon including negative prices (HB_WEST wind curtailment), seed fallback if API unavailable
5. ✅ ML layer (Modal) — Prophet forecaster + PuLP LP optimizer + SAC RL policy; `/api/forecast` and `/api/simulate` wired up
6. ✅ LangGraph agent — `/api/agent/run` full pipeline: prices → forecast → LP + RL → GPT-4o synthesis → recommendation text; persists to `dispatch_schedules`
7. ✅ RAG pipeline — `/api/upload` (POST multipart + GET list) and `/api/chat` (POST query); `lib/rag.ts` with embedText/chunkText/searchSimilarChunks
8. ✅ Frontend dashboard pages — `/dashboard` (dispatch chart + recommendation card + Mapbox node map), `/performance` (Recharts revenue chart + schedule table), `/settings` (battery profile form); `/api/nodes`, `/api/performance`, `/api/settings`
9. Vercel deployment
