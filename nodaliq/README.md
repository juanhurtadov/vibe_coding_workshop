# NodalIQ

**AI-powered battery dispatch intelligence for ERCOT operators.**

NodalIQ analyzes real nodal LMP prices, forecasts tomorrow's market, runs a dispatch optimizer, and delivers a plain-language recommendation every morning — before the peak. No quant team required.

Built as a portfolio SaaS during a vibe coding bootcamp (4-day deadline). Designed to be production-credible, not just demo-worthy.

---

## What it does

Battery owners in ERCOT face the same question every day: when do I charge, when do I discharge, and how much am I leaving on the table? Most solve this manually or with vendor-locked tools. NodalIQ automates the intelligence layer:

1. Pulls ERCOT day-ahead LMP prices (real API, real nodes)
2. Forecasts tomorrow's price curve with a trained Prophet model
3. Solves a linear program to find the optimal 24-hour dispatch schedule
4. Runs a parallel SAC reinforcement learning policy as an alternative strategy
5. Has a LangGraph agent synthesize everything into a plain-language recommendation card
6. Logs actual vs. recommended outcomes over time (P&L tracker)
7. Lets users chat with their uploaded tariff docs and market reports via RAG
8. Shows all four ERCOT hub nodes on an interactive price map

---

## Current state

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Foundation | ✅ Done | Next.js 16, Tailwind v4, Shadcn, landing page |
| 2 — Database | ✅ Done | Neon Postgres + pgvector schema, Drizzle ORM, health check |
| 3 — Auth | ✅ Done | Clerk sign-in/up, proxy middleware, protected dashboard shell with sidebar |
| 4 — ERCOT pipeline | ✅ Done | Full OAuth (B2C_1_PUBAPI-ROPC-FLOW), real DAM prices in Neon incl. negative HB_WEST prices, seed fallback |
| 5 — ML layer | ✅ Done | Prophet + LP + SAC RL deployed on Modal; `/api/forecast` and `/api/simulate` live |
| 6 — Agent | ✅ Done | LangGraph pipeline: fetch → forecast → LP + RL → GPT-4o synthesis → recommendation text |
| 7 — RAG | ✅ Done | PDF/CSV upload → chunk → ada-002 embed → pgvector → GPT-4o chat with source badges |
| 8 — Dashboard | ✅ Done | Dispatch chart (Recharts), recommendation card, P&L tracker, settings form, ERCOT node map (Mapbox) |
| 9 — Deploy | Pending | Vercel + Neon production |

---

## Tech stack and why we picked each piece

### Next.js 16 + App Router
Required by the bootcamp. Also the right call — App Router colocates API routes with frontend, Server Components reduce client bundle size, and Vercel deployment is zero-config. We use route groups `(auth)` and `(dashboard)` to isolate layout shells without affecting URL paths.

### Tailwind CSS v4
v4 moves all config into `app/globals.css` via `@theme inline { ... }` — no `tailwind.config.js`. CSS variables use `oklch()` color space. This is intentional: fewer config files, better DX. **Do not create a `tailwind.config.js`** — it will conflict.

### Shadcn/ui (new-york style)
Not a component library you install as a dep — Shadcn copies components into `components/ui/`. That means full ownership of the code. New-york style is tighter and more professional than the default style. Lucide icons are the bundled icon set.

### Neon (Postgres + pgvector)
Serverless Postgres with a native HTTP driver (`@neondatabase/serverless`) that works in Vercel Edge and serverless functions without connection pool overhead. pgvector on the same database means vector search for RAG without a separate service (no Pinecone account needed). Free tier is generous enough for the full app.

### Drizzle ORM
TypeScript-first ORM with a schema-as-code approach (`lib/schema.ts`). Lighter than Prisma (no Rust binary, faster cold starts), and the query builder is close enough to raw SQL that it's easy to reason about. `drizzle-kit` handles migrations.

### Clerk
Drop-in auth with pre-built UI components. Gives us multi-tenant user IDs (`user_id` on every table) without building auth from scratch. The `user_id` field is a Clerk user ID string, not a FK to a users table — keeps the schema simpler.

Auth flow uses `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`). `NEXT_PUBLIC_CLERK_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` must be set in `.env.local` so Clerk knows your custom sign-in page location.

### Modal
Python serverless platform for the ML/agent layer. Prophet, PuLP, and LangGraph all need Python — Modal lets us deploy Python functions as HTTPS endpoints called from Next.js API routes. Judges see a clean Next.js app on Vercel; the heavy computation happens on Modal. Free tier covers the bootcamp load.

Deploy with: `PYTHONUTF8=1 modal deploy ml/main.py` (the `PYTHONUTF8=1` flag avoids Windows charmap errors). The image build recompiles Prophet's Stan model from source because the PyPI wheel ships a manylinux binary that's incompatible with Modal's Debian containers.

### Prophet (forecaster)
Facebook's time-series model. Chosen because: fast to train (minutes on CPU), no GPU required, handles ERCOT's strong daily/weekly seasonality natively, and the output is interpretable. The forecast feeds directly into the LP optimizer.

### PuLP (LP optimizer)
Linear programming library for Python. Battery dispatch is a classic LP problem: maximize revenue subject to SOC constraints, power limits, and round-trip efficiency. LP gives the mathematically optimal schedule given the forecast — deterministic and fully explainable.

### SAC — Soft Actor-Critic (RL policy)
A learned dispatch policy trained offline on historical ERCOT price data. LP is optimal when the forecast is perfect; SAC is robust when it isn't — it learns a policy directly from realized market outcomes rather than relying on forecast accuracy. The performance tracker runs both strategies in parallel and logs their P&L.

- **State:** `(soc, price_now, forecast_t+1..t+6, hour_of_day, day_of_week)`
- **Action:** continuous `[-1, 1]` mapped to charge/discharge kW, clipped to hardware limits
- **Reward:** realized revenue per step; SOC bounds enforced via reward shaping
- **Training:** offline on historical ERCOT DAM prices; serialized to `ml/artifacts/sac_policy.pt`

### LangGraph (agent)
Orchestration framework for the daily briefing agent. The agent is a directed graph: fetch prices → run forecast → run optimizer → synthesize recommendation. LangGraph handles state passing between nodes and gives us retries and error handling at each step.

### OpenAI API
Used in two places: the LangGraph synthesis node (GPT-4o generates the recommendation text) and the RAG pipeline (`text-embedding-ada-002` creates 1536-dimension document embeddings stored in pgvector).

### Recharts
React-native charting library for the dispatch visualization. The dashboard shows a 24-bar dispatch chart (charge/discharge kW per hour) with a price forecast overlay line. Lightweight, TypeScript-first, works cleanly with React 19.

### Mapbox (react-map-gl)
Interactive map showing all four ERCOT hub nodes (HB_NORTH, HB_SOUTH, HB_WEST, HB_HOUSTON) on a dark-themed Texas map. Node pins are color-coded by latest LMP price (violet = negative, cyan = cheap, green = moderate, amber = elevated, red = spike). Clicking a pin switches the active node for the agent run. Requires `NEXT_PUBLIC_MAPBOX_TOKEN` (free tier).

---

## Getting started

```bash
# From nodaliq/
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # localhost:3000
```

### Required environment variables

```bash
# Database
DATABASE_URL=                        # Neon connection string (pooled)

# Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# ERCOT API (developer.ercot.com)
ERCOT_API_KEY=
ERCOT_USERNAME=
ERCOT_PASSWORD=

# Modal ML endpoints (from: PYTHONUTF8=1 modal deploy ml/main.py)
MODAL_FORECAST_URL=
MODAL_OPTIMIZE_URL=
MODAL_RL_URL=
MODAL_AGENT_URL=

# OpenAI (agent synthesis + RAG embeddings)
OPENAI_API_KEY=

# Mapbox (free tier — mapbox.com)
NEXT_PUBLIC_MAPBOX_TOKEN=
```

### Database

```bash
npm run db:push    # push schema to Neon (dev)
npm run db:studio  # open Drizzle Studio to inspect data
```

### ML layer (Modal)

```bash
# From repo root — requires Modal CLI installed and authenticated
PYTHONUTF8=1 modal deploy ml/main.py
```

Live endpoints after deploy:
| Function | URL |
|----------|-----|
| forecast | `https://juanhurtadov--nodaliq-ml-forecast.modal.run` |
| optimize | `https://juanhurtadov--nodaliq-ml-optimize.modal.run` |
| rl       | `https://juanhurtadov--nodaliq-ml-rl.modal.run` |
| agent    | `https://juanhurtadov--nodaliq-ml-agent.modal.run` |

---

## Project structure

```
nodaliq/
├── app/
│   ├── page.tsx                      # landing page
│   ├── layout.tsx                    # root layout + ClerkProvider
│   ├── globals.css                   # Tailwind v4 theme (no tailwind.config.js)
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/   # Clerk SignIn component
│   │   └── sign-up/[[...sign-up]]/   # Clerk SignUp component
│   ├── (dashboard)/
│   │   ├── layout.tsx                # sidebar shell + auth guard
│   │   ├── dashboard/page.tsx        # recommendation card + dispatch chart + node map
│   │   ├── chat/page.tsx             # RAG document chat
│   │   ├── performance/page.tsx      # P&L tracker + cumulative revenue chart
│   │   └── settings/page.tsx         # battery profile form
│   └── api/
│       ├── health/                   # DB connectivity check
│       ├── ingest/                   # fetch + store ERCOT DAM prices
│       ├── forecast/                 # call Modal Prophet forecaster
│       ├── simulate/                 # call Modal LP + RL in parallel
│       ├── agent/run/                # full LangGraph pipeline
│       ├── chat/                     # RAG query → GPT-4o answer
│       ├── upload/                   # PDF/CSV ingest → chunk → embed → store
│       ├── nodes/                    # latest LMP price per ERCOT hub node
│       ├── performance/              # dispatch schedules + performance logs
│       └── settings/                 # battery profile CRUD
├── components/
│   ├── NodeMap.tsx                   # Mapbox ERCOT hub node map
│   └── ui/                           # Shadcn components (owned, not a dep)
├── lib/
│   ├── db.ts                         # Neon + Drizzle client
│   ├── ercot.ts                      # ERCOT OAuth + DAM price fetcher
│   ├── rag.ts                        # embedText, chunkText, searchSimilarChunks
│   ├── schema.ts                     # Drizzle table definitions (5 tables)
│   └── utils.ts                      # cn() helper
├── proxy.ts                          # Clerk auth proxy (Next.js 16 middleware)
└── next.config.ts                    # serverExternalPackages: [pdf-parse]

ml/                                   # Python — deployed to Modal
├── main.py                           # Modal app (4 fastapi_endpoint functions)
├── forecaster.py                     # Prophet price forecast
├── optimizer.py                      # PuLP LP dispatch solver
├── rl_agent.py                       # SAC RL dispatch policy
├── agent.py                          # LangGraph pipeline
├── prophet_model.stan                # Stan source (extracted from sdist)
└── artifacts/
    └── sac_policy.pt                 # trained SAC weights
```

---

## Dashboard pages

### `/dashboard` — Command center
- **Run Agent** button triggers the full pipeline: ERCOT prices → Prophet forecast → LP optimizer + SAC RL → LangGraph synthesis
- Stat cards: expected revenue, best discharge hour, best charge hour
- AI recommendation card with plain-language GPT-4o output
- 24-hour dispatch bar chart (cyan bars = charge, emerald = discharge) with amber price forecast line overlay
- ERCOT hub node map (Mapbox dark theme) — pins colored by current LMP price, click to switch node

### `/chat` — Document RAG
- Upload PDFs, CSVs, or text files (ERCOT market reports, tariff documents, interconnect agreements)
- Files are chunked (500-word sliding window), embedded with `text-embedding-ada-002`, and stored in pgvector
- Ask questions in natural language → GPT-4o answers using retrieved context
- Source badges show filename + cosine similarity score for each retrieved chunk

### `/performance` — P&L tracker
- Cumulative revenue line chart: LP strategy vs flat baseline
- Schedule history table: date, node, LP expected revenue, forecast accuracy % (once actuals are logged)
- Summary cards: total LP revenue, avg forecast accuracy

### `/settings` — Battery profile
- Configure: name, capacity (kWh), max charge/discharge kW, round-trip efficiency, min/max SOC
- Select ERCOT hub node for price data
- Saved to `battery_profiles` table, passed to LP optimizer and RL agent on each run

---

## Competitive context

NodalIQ is in the software intelligence category alongside **Ascend Analytics (PowerVAL)** and **Stem Athena** — tools that help battery owners make better dispatch decisions. The differentiation is the agentic + conversational interface: a daily briefing agent that explains its reasoning in plain language, and a RAG chat layer over uploaded tariff documents. Neither Ascend nor Stem exposes this to end users.

The comparable real-world role is a Battery Optimization Lead (Tierra Climate style) — someone who builds forecasts and LP dispatch strategies manually every day. NodalIQ productizes that workflow.
