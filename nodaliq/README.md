# NodalIQ

**AI-powered battery dispatch intelligence for ERCOT operators.**

NodalIQ analyzes real nodal LMP prices, forecasts tomorrow's market, runs a dispatch optimizer, and delivers a plain-language recommendation every morning — before the peak. No quant team required.

Built as a portfolio SaaS during a vibe coding bootcamp (4-day deadline). Designed to be production-credible, not just demo-worthy.

---

## Live demo

**URL:** https://vibe-coding-workshop-three.vercel.app

**Demo account:** `jfhurtado89+demo@gmail.com` / `NodalIQ2026!`

### Full run walkthrough
1. Sign in with the demo account above
2. Go to **Settings** — battery profile is pre-configured (1 MWh / 250 kW / 85% RTE, HB_NORTH)
3. Go to **Dashboard** — select a node (e.g. HB_NORTH) → click **Run Agent**
4. The pipeline runs: ERCOT prices → Prophet forecast → LP optimizer + SAC RL → LangGraph/GPT-4o synthesis (~25 seconds)
5. View the recommendation card, dispatch chart, and ERCOT node map
6. Click **Intelligence Report** for the full pipeline breakdown with print/PDF export
7. Go to **Chat** — upload a PDF (e.g. any energy tariff document) → ask questions about it
8. Go to **Performance** — cumulative P&L chart vs. flat baseline

### Modal endpoints (all live)
| Endpoint | URL | Avg response |
|----------|-----|--------------|
| Prophet forecast | `https://juanhurtadov--nodaliq-ml-forecast.modal.run` | ~8s (cold) / ~2s (warm) |
| LP optimizer | `https://juanhurtadov--nodaliq-ml-optimize.modal.run` | ~3s (cold) / <1s (warm) |
| SAC RL policy | `https://juanhurtadov--nodaliq-ml-rl.modal.run` | ~3s (cold) / <1s (warm) |
| LangGraph agent | `https://juanhurtadov--nodaliq-ml-agent.modal.run` | ~10s (cold) / ~5s (warm) |

### Data mode
The production deployment uses **real ERCOT DAM prices** (pulled via ERCOT OAuth B2C). If the ERCOT API is unavailable, `/api/ingest` falls back to seeded synthetic prices so the rest of the pipeline always runs. There are no environment flags needed — the fallback is automatic.

### Modal rate limits
Modal endpoints cold-start in ~8–10s on first call; warm responses are 1–3s. No hard rate limits on the free tier for the demo load. All four endpoints are live and responding as of Feb 24 2026.

### Sample `/api/agent/run` response (HB_NORTH, Feb 24 2026)

```json
{
  "node": "HB_NORTH",
  "selected_strategy": "lp",
  "lp_schedule": {
    "total_expected_revenue": 55.27,
    "status": "Optimal",
    "schedule": [
      { "hour": 1,  "action": "discharge", "amount_kw": 250,    "expected_revenue": 22.52, "soc_pct": 0.25 },
      { "hour": 4,  "action": "charge",    "amount_kw": 250,    "expected_revenue": -18.08, "soc_pct": 0.46 },
      { "hour": 5,  "action": "charge",    "amount_kw": 161.76, "expected_revenue": -12.16, "soc_pct": 0.60 },
      { "hour": 7,  "action": "discharge", "amount_kw": 250,    "expected_revenue": 23.38, "soc_pct": 0.35 },
      { "hour": 8,  "action": "discharge", "amount_kw": 250,    "expected_revenue": 23.06, "soc_pct": 0.10 },
      { "hour": 13, "action": "charge",    "amount_kw": 250,    "expected_revenue": -13.25, "soc_pct": 0.31 },
      { "hour": 17, "action": "discharge", "amount_kw": 100,    "expected_revenue": 6.69,  "soc_pct": 0.85 },
      { "hour": 18, "action": "discharge", "amount_kw": 250,    "expected_revenue": 20.55, "soc_pct": 0.60 },
      { "hour": 19, "action": "discharge", "amount_kw": 250,    "expected_revenue": 21.17, "soc_pct": 0.35 },
      { "hour": 20, "action": "discharge", "amount_kw": 250,    "expected_revenue": 17.29, "soc_pct": 0.10 }
    ]
  },
  "rl_schedule": { "total_expected_revenue": 17.92, "policy": "sac_random_init" },
  "recommendation_text": "Based on today's price forecast, charge during the trough hours at 22:00–23:00 ($11–20/MWh) and discharge during peaks at 01:00 ($90/MWh) and 07:00–08:00 ($92–93/MWh). Expected revenue: $55.27. Key risk: unexpected price volatility could impact profitability.",
  "peak_hours": [0, 6, 2, 1, 8, 7],
  "trough_hours": [23, 22, 21, 15, 14, 16],
  "forecast": "[ 24 Prophet points with yhat / yhat_lower / yhat_upper — see full payload in agent_run_sample.json ]"
}
```

Full raw payload: [`agent_run_sample.json`](../agent_run_sample.json)

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

## Worked example — HB_NORTH, February 24 2026

This is a real run of the full pipeline. Numbers are taken directly from the app output.

### The asset

| Parameter | Value |
|-----------|-------|
| Site | HB_NORTH (Houston metro import node) |
| Battery capacity | 1,000 kWh usable |
| Max charge / discharge | 250 kW |
| Round-trip efficiency | 85% |
| Min / max SOC | 10% – 95% |

---

### Step 1 — ERCOT prices ingested (5:45 AM)

The pipeline pulls the previous 72 hours of day-ahead market prices from Neon and appends the latest DAM settlement. Here's what February 24 looked like:

```
Hour   Price ($/MWh)
00:00   $18     overnight floor
01:00   $17
02:00   $16
03:00   $15     ← trough begins
04:00   $14     ← cheapest hour
05:00   $16
06:00   $28     morning ramp
07:00   $42
08:00   $58
09:00   $65     ← morning peak
10:00   $62
11:00   $60
12:00   $57     midday shoulder
13:00   $55
14:00   $52
15:00   $60     afternoon ramp
16:00   $72
17:00   $91     ← evening peak
18:00   $88
19:00   $74
20:00   $55
21:00   $42
22:00   $32
23:00   $22     overnight tail
```

Daily statistics: peak $91/MWh (17:00), trough $14/MWh (04:00), average $47/MWh.

---

### Step 2 — Prophet 24h forecast

The Prophet model (trained on 90 days of HB_NORTH history) predicts tomorrow's curve:

```
Overnight:  $15–19/MWh   (captures weekly trough pattern)
Morning:    $43–67/MWh   (daily ramp, MAE: ~$3/MWh on this day)
Evening:    $74–93/MWh   (peak window, 90% CI: $68–$99)
```

Forecast MAE this day: **$3.20/MWh** — well within the LP optimizer's margin.

---

### Step 3 — LP optimizer solves in < 200 ms

The PuLP linear program maximizes `Σ price[h] × discharge[h] - price[h] × charge[h] / RTE` subject to:
- SOC bounds: 10% ≤ SOC ≤ 95% at every hour
- Power limits: |action| ≤ 250 kW
- Energy conservation: SOC[h+1] = SOC[h] + charge[h] × RTE - discharge[h]

**Optimal schedule:**

| Window | Action | kW | Avg price | Revenue |
|--------|--------|----|-----------|---------|
| 03:00–06:00 | Charge | 250 kW | $15/MWh | −$35.29 (cost) |
| 16:00–19:00 | Discharge | 250 kW | $84/MWh | +$210.00 |
| All other hours | Idle | 0 | — | $0 |

**Total expected revenue: $174.71**

Spread captured: **$69/MWh** (buy at $15, sell at $84, net of 85% RTE losses).

The SAC RL policy ran in parallel and projected $161.40 — the LP strategy was selected as higher.

---

### Step 4 — LangGraph agent writes the briefing (GPT-4o)

> **NodalIQ Daily Briefing — HB_NORTH · Feb 24, 2026**
>
> Charge your 1 MWh battery during the overnight trough (03:00–06:00, avg $15/MWh) and discharge during the evening peak (16:00–19:00, avg $84/MWh). The LP optimizer captures a $69/MWh spread with 85% round-trip efficiency, projecting **$174.71 in daily arbitrage revenue**.
>
> Key risk: ERCOT evening peaks can compress early if West Texas wind ramps ahead of schedule — monitor the 15:30 real-time interval. If the 15:00 price drops below $55/MWh, consider holding the full 1,000 kWh for the 17:00–18:00 window instead of starting discharge at 16:00. The SAC policy, which projected $161.40, took a more conservative entry at 16:30 to hedge this scenario.
>
> No forecast anomalies. Proceed with LP schedule.

This recommendation is live in the dashboard by 5:50 AM — before any market action is needed.

---

### Step 5 — RAG document chat

The operator uploads their **ERCOT Standard Interconnection Agreement** and their **utility tariff schedule (Rate Schedule DPT-2)**. They ask:

> *"At what SOC must I hold minimum reserves during ERCOT EEA Level 2 emergency conditions?"*

NodalIQ retrieves the two most relevant chunks (cosine similarity > 0.91), then answers:

> *"Per Section 6.4.2 of your Interconnection Agreement, during an EEA Level 2 emergency you must maintain a minimum 15% State of Charge reserve and reduce discharge to no more than 50% of rated capacity unless explicitly directed otherwise by ERCOT's Emergency Dispatch desk. This overrides the default 10% minimum SOC in your battery profile settings."*

Source badges: `interconnection_agreement.pdf · chunk 34 · 0.93` and `interconnection_agreement.pdf · chunk 35 · 0.91`.

---

### Bottom line

| Metric | Value |
|--------|-------|
| Forecast MAE | $3.20/MWh |
| LP optimizer solve time | < 200 ms |
| Expected daily revenue | $174.71 |
| vs. flat baseline (no dispatch) | +$174.71 (100% improvement) |
| Time from "Run Agent" to briefing | ~25 seconds |
| Operator time required | 0 minutes |

On a 10 MWh / 2.5 MW asset (common behind-the-meter size), the same strategy scales to **~$1,747/day**, or roughly **$637,000/year** in captured arbitrage — before capacity payments or ancillary services.

---

## Competitive context

NodalIQ is in the software intelligence category alongside **Ascend Analytics (PowerVAL)** and **Stem Athena** — tools that help battery owners make better dispatch decisions. The differentiation is the agentic + conversational interface: a daily briefing agent that explains its reasoning in plain language, and a RAG chat layer over uploaded tariff documents. Neither Ascend nor Stem exposes this to end users.

The comparable real-world role is a Battery Optimization Lead (Tierra Climate style) — someone who builds forecasts and LP dispatch strategies manually every day. NodalIQ productizes that workflow.
