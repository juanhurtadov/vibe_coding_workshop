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
4. Has an LLM agent synthesize that into a plain-language recommendation card
5. Logs actual vs. recommended outcomes over time (P&L tracker)
6. Lets users chat with their uploaded tariff docs and bills via RAG

---

## Current state

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Foundation | ✅ Done | Next.js 16, Tailwind v4, Shadcn, landing page |
| 2 — Database | ✅ Done | Neon Postgres + pgvector schema, Drizzle ORM, health check |
| 3 — Auth | ✅ Done | Clerk sign-in/up, proxy middleware, protected dashboard shell with sidebar |
| 4 — ERCOT pipeline | ✅ Done | Full OAuth (B2C_1_PUBAPI-ROPC-FLOW), real DAM prices in Neon incl. negative HB_WEST prices, seed fallback |
| 5 — ML layer | ✅ Done | Prophet + LP + SAC RL deployed on Modal; `/api/forecast` and `/api/simulate` live |
| 6 — Agent | Pending | LangGraph pipeline → daily recommendation |
| 7 — RAG | Pending | Document upload + pgvector chat |
| 8 — Dashboard | Pending | Dispatch chart, recommendation card, P&L tracker |
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

### Clerk (Phase 3)
Drop-in auth with pre-built UI components. Gives us multi-tenant user IDs (`user_id` on every table) without building auth from scratch. The `user_id` field is a Clerk user ID string, not a FK to a users table — keeps the schema simpler.

### Modal (Phase 5)
Python serverless platform for the ML/agent layer. Prophet, PuLP, and LangGraph all need Python — Modal lets us deploy Python functions as HTTPS endpoints called from Next.js API routes. Judges see a clean Next.js app on Vercel; the heavy computation happens on Modal. Free tier covers the bootcamp load.

Deploy with: `cd ml && PYTHONUTF8=1 modal deploy main.py` (the `ml/` working directory is required so `add_local_python_source` finds the sibling modules). The image build recompiles Prophet's Stan model from source because the PyPI wheel ships a manylinux binary that's incompatible with Modal's Debian containers.

### Prophet (forecaster)
Facebook's time-series model. Chosen because: fast to train (minutes, not hours on CPU), no GPU required, handles ERCOT's strong daily/weekly seasonality natively, and the output is interpretable (you can show the trend + seasonality components). The forecast feeds directly into the LP optimizer.

### PuLP (LP optimizer)
Linear programming library for Python. Battery dispatch is a classic LP problem: maximize revenue subject to SOC constraints, power limits, and round-trip efficiency. LP gives the mathematically optimal schedule given the forecast — deterministic and fully explainable. We run it on each battery profile's specs against the forecasted price curve.

### SAC — Soft Actor-Critic (RL policy)
A learned dispatch policy trained offline on historical ERCOT price data. LP is optimal when the forecast is perfect; SAC is robust when it isn't — it learns a policy directly from realized market outcomes rather than relying on forecast accuracy. The performance tracker runs both strategies in parallel and logs their P&L, letting the system (and the user) see which approach wins over time.

- **State:** `(soc, price_now, forecast_t+1..t+6, hour_of_day, day_of_week)`
- **Action:** continuous `[-1, 1]` mapped to charge/discharge kW, clipped to hardware limits
- **Reward:** realized revenue per step; SOC bounds enforced via reward shaping
- **Training:** offline on historical ERCOT DAM prices; serialized to `ml/artifacts/sac_policy.pt`
- **Inference:** Modal endpoint loads the policy and returns a 24-hour action sequence alongside the LP schedule

The performance tracker then shows three strategies side-by-side: flat baseline, LP + Prophet, and SAC policy — making the comparison explicit and honest.

### LangGraph (agent)
Orchestration framework for the daily briefing agent. The agent is a directed graph: fetch prices → run forecast → run optimizer → synthesize recommendation. LangGraph handles state passing between nodes and gives us retries and error handling at each step. The synthesis node calls the OpenAI API to turn optimizer output into a plain-language card.

### OpenAI API
Used in two places: the LangGraph synthesis node (GPT-4o generates the recommendation text) and the RAG pipeline (`text-embedding-ada-002` creates document embeddings). ada-002 produces 1536-dimension vectors, which matches the `vector(1536)` column in the `documents` table.

---

## Getting started

```bash
# From nodaliq/
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # localhost:3000
```

### Required environment variables

```
DATABASE_URL=                        # Neon connection string (pooled)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ERCOT_API_KEY=                       # developer.ercot.com subscription key
ERCOT_USERNAME=                      # developer.ercot.com login
ERCOT_PASSWORD=
MODAL_FORECAST_URL=                  # from: modal deploy ml/main.py
MODAL_OPTIMIZE_URL=
MODAL_RL_URL=
OPENAI_API_KEY=                      # for agent synthesis + RAG embeddings (Phase 6+)
```

### Database

```bash
npm run db:push    # push schema to Neon (dev)
npm run db:studio  # open Drizzle Studio to inspect data
```

---

## Project structure

```
nodaliq/
├── app/
│   ├── page.tsx                  # landing page
│   ├── layout.tsx                # root layout + metadata
│   ├── (auth)/                   # Clerk auth pages
│   ├── (dashboard)/              # protected app shell
│   └── api/
│       ├── health/               # DB connectivity check
│       ├── ingest/               # fetch + store ERCOT DAM prices
│       ├── forecast/             # call Modal Prophet forecaster
│       └── simulate/             # call Modal LP + RL in parallel
├── components/
│   └── ui/                       # Shadcn components (owned, not a dep)
├── lib/
│   ├── db.ts                     # Neon + Drizzle client
│   ├── ercot.ts                  # ERCOT OAuth + DAM price fetcher
│   ├── schema.ts                 # Drizzle table definitions
│   └── utils.ts                  # cn() helper
ml/                               # Python — deployed to Modal
├── main.py                       # Modal app (3 fastapi_endpoint functions)
├── forecaster.py                 # Prophet price forecast
├── optimizer.py                  # PuLP LP dispatch solver
├── rl_agent.py                   # SAC RL dispatch policy
├── prophet_model.stan            # Stan source bundled from sdist (not in PyPI wheel)
└── artifacts/
    └── sac_policy.pt             # trained weights (run train_sac.py to generate)
```

---

## Competitive context

NodalIQ is in the software intelligence category alongside **Ascend Analytics (PowerVAL)** and **Stem Athena** — tools that help battery owners make better dispatch decisions. The differentiation is the agentic + conversational interface: a daily briefing agent that explains its reasoning in plain language, and a RAG chat layer over uploaded tariff documents. Neither Ascend nor Stem exposes this to end users.

The comparable real-world role is a Battery Optimization Lead (Tierra Climate style) — someone who builds forecasts and LP dispatch strategies manually every day. NodalIQ productizes that workflow.
