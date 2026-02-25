# NodalIQ — Hackathon Submission

## Product Name
NodalIQ

## One-Line Description
AI-powered battery dispatch intelligence that analyzes real ERCOT nodal prices, forecasts tomorrow's market, and delivers a plain-language dispatch recommendation before 6 AM — every morning.

## Team Members
| Name | Email |
|------|-------|
| Juan Hurtado | jfhurtado89@gmail.com |

## Live Deployment URL
https://vibe-coding-workshop-three.vercel.app

## Demo Account
Email: `jfhurtado89+demo@gmail.com`
Password: `NodalIQ2026!`

### Full walkthrough
1. Sign in with the demo account above
2. **Settings** — battery profile is pre-configured (1 MWh / 250 kW / 85% RTE, HB_NORTH)
3. **Dashboard** — select a node → click **Run Agent** (~25 seconds end-to-end)
4. View recommendation card, dispatch chart, and ERCOT node map
5. Click **Intelligence Report** for the full pipeline breakdown with print/PDF
6. **Chat** — a battery dispatch document is already uploaded; ask questions about it
7. **Performance** — cumulative P&L chart vs. flat baseline

### Modal endpoints (all live)
| Endpoint | URL |
|----------|-----|
| Prophet forecast | `https://juanhurtadov--nodaliq-ml-forecast.modal.run` |
| LP optimizer | `https://juanhurtadov--nodaliq-ml-optimize.modal.run` |
| SAC RL policy | `https://juanhurtadov--nodaliq-ml-rl.modal.run` |
| LangGraph agent | `https://juanhurtadov--nodaliq-ml-agent.modal.run` |

Production uses real ERCOT DAM prices with a seed fallback if the API is unavailable.

## GitHub Repository
https://github.com/juanhurtadov/vibe_coding_workshop

## Problem Statement
Battery owners in ERCOT manually decide when to charge and discharge every day, leaving significant arbitrage revenue on the table. Most operators either rely on flat schedules or expensive vendor-locked tools with no transparency into the underlying logic. There is no affordable, automated platform that combines real nodal market data, ML price forecasting, and plain-language recommendations in one place — accessible without a quant team.

## Solution
NodalIQ pulls real ERCOT day-ahead LMP prices via the public API, runs a Prophet time-series forecast and a PuLP linear program optimizer to find the mathematically optimal 24-hour dispatch schedule, then has a LangGraph agent synthesize everything into a GPT-4o written briefing — delivered to the operator's dashboard before the morning peak. A parallel SAC reinforcement learning policy provides a robustness check against forecast uncertainty. Operators also get a RAG chat layer to query their own uploaded tariff documents and interconnection agreements, plus an interactive Intelligence Report with a full pipeline breakdown including dispatch chart, hourly economics table, ERCOT node map, and LP vs. RL strategy comparison.

## Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Shadcn/ui, Recharts, Mapbox
- **Backend:** Next.js API Routes, Neon Serverless Postgres, pgvector, Drizzle ORM
- **Auth:** Clerk
- **ML / Agent layer:** Modal (Python serverless) — Prophet forecaster, PuLP LP optimizer, SAC RL policy, LangGraph agent
- **AI:** OpenAI GPT-4o (recommendation synthesis), text-embedding-ada-002 (RAG embeddings)
- **Data:** ERCOT public DAM API (real nodal LMP prices)
- **Deploy:** Vercel
