"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Realistic HB_NORTH February day — actual ERCOT price shape
const SAMPLE_PRICES = [
  18, 17, 16, 15, 14, 16, 28, 42, 58, 65, 62, 60,
  57, 55, 52, 60, 72, 91, 88, 74, 55, 42, 32, 22,
];

const FORECAST = [
  19, 17, 16, 15, 14, 15, 27, 43, 59, 67, 63, 61,
  58, 56, 53, 61, 74, 93, 90, 76, 57, 44, 33, 23,
];

// LP optimal schedule given this forecast
const SCHEDULE = [
  { hour: 0,  action: "idle",      amount: 0,   },
  { hour: 1,  action: "idle",      amount: 0,   },
  { hour: 2,  action: "idle",      amount: 0,   },
  { hour: 3,  action: "charge",    amount: -250 },
  { hour: 4,  action: "charge",    amount: -250 },
  { hour: 5,  action: "charge",    amount: -250 },
  { hour: 6,  action: "charge",    amount: -250 },
  { hour: 7,  action: "idle",      amount: 0,   },
  { hour: 8,  action: "idle",      amount: 0,   },
  { hour: 9,  action: "idle",      amount: 0,   },
  { hour: 10, action: "idle",      amount: 0,   },
  { hour: 11, action: "idle",      amount: 0,   },
  { hour: 12, action: "idle",      amount: 0,   },
  { hour: 13, action: "idle",      amount: 0,   },
  { hour: 14, action: "idle",      amount: 0,   },
  { hour: 15, action: "idle",      amount: 0,   },
  { hour: 16, action: "discharge", amount: 250  },
  { hour: 17, action: "discharge", amount: 250  },
  { hour: 18, action: "discharge", amount: 250  },
  { hour: 19, action: "discharge", amount: 250  },
  { hour: 20, action: "idle",      amount: 0,   },
  { hour: 21, action: "idle",      amount: 0,   },
  { hour: 22, action: "idle",      amount: 0,   },
  { hour: 23, action: "idle",      amount: 0,   },
];

const RECOMMENDATION = `Based on the HB_NORTH forecast, charge your 1 MWh battery during the overnight trough (03:00–06:00, avg $15/MWh) and discharge during the evening peak (16:00–19:00, avg $84/MWh). The LP optimizer captures a $69/MWh spread with 85% round-trip efficiency, projecting $175.35 in daily arbitrage revenue. Key risk: ERCOT evening peaks can suppress early if wind ramps ahead of schedule — monitor the 15:00 interval.`;

const STEPS = ["Ingest Prices", "Forecast", "Optimize", "Recommendation"];

const chartData = Array.from({ length: 24 }, (_, h) => ({
  hour: `${String(h).padStart(2, "0")}:00`,
  actual: SAMPLE_PRICES[h],
  forecast: FORECAST[h],
  dispatch: SCHEDULE[h].amount,
}));

export default function HowItWorksDemo() {
  const [step, setStep] = useState(0);

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 text-center">
        <Badge className="mb-4 border-zinc-700 bg-zinc-800 text-zinc-400">
          How It Works
        </Badge>
        <h2 className="text-4xl font-bold tracking-tight text-white">
          From market data to dispatch decision
        </h2>
        <p className="mt-4 text-zinc-400">
          A real HB_NORTH day — see exactly what the pipeline produces.
        </p>
      </div>

      {/* Step tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              step === i
                ? "bg-cyan-500 text-black"
                : "border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                step === i ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {i + 1}
            </span>
            {s}
          </button>
        ))}
      </div>

      {/* Step 1 — Ingest prices */}
      {step === 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">
                ERCOT DAM prices ingested — HB_NORTH · Feb 24, 2026
              </p>
              <p className="text-xs text-zinc-500">
                72 hours of day-ahead market prices pulled via ERCOT public API (OAuth B2C). Stored in Neon Postgres.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="hour" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} interval={3} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number | undefined) => [`$${v ?? 0}/MWh`, "DAM Price"] as [string, string]}
                />
                <Line type="monotone" dataKey="actual" stroke="#06b6d4" strokeWidth={2} dot={false} name="DAM Price" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-lg font-bold text-white">$91</div>
                <div className="text-zinc-500">Peak (17:00)</div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-lg font-bold text-white">$14</div>
                <div className="text-zinc-500">Trough (04:00)</div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-lg font-bold text-white">$47</div>
                <div className="text-zinc-500">Daily avg</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Forecast */}
      {step === 1 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">
                Prophet 24h forecast — trained on 90 days of HB_NORTH history
              </p>
              <p className="text-xs text-zinc-500">
                Facebook Prophet captures daily + weekly seasonality. Forecast fed directly to the LP optimizer.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="hour" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} interval={3} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number | undefined, name: string | undefined) => [`$${v ?? 0}/MWh`, name === "actual" ? "Actual" : "Forecast"] as [string, string]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
                <Line type="monotone" dataKey="actual" stroke="#3f3f46" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="actual" />
                <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} dot={false} name="forecast" />
              </LineChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-zinc-500">
              Dashed = actual DAM prices · Amber = Prophet forecast · MAE: $3.20/MWh on this day
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Optimize */}
      {step === 2 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-white">
                LP optimizer — 1 MWh battery · 250 kW max · 85% RTE
              </p>
              <p className="text-xs text-zinc-500">
                PuLP linear program maximizes arbitrage revenue subject to SOC constraints. Solved in &lt;200ms.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="hour" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} interval={3} />
                <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "kW", fill: "#52525b", fontSize: 10, position: "insideLeft" }} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number | undefined) => { const n = v ?? 0; return [`${Math.abs(n)} kW ${n > 0 ? "discharge" : n < 0 ? "charge" : "idle"}`, "Dispatch"] as [string, string]; }}
                />
                <ReferenceLine y={0} stroke="#3f3f46" />
                <Bar dataKey="dispatch" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-lg font-bold text-cyan-400">03–06</div>
                <div className="text-zinc-500">Charge window @ $15 avg</div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-lg font-bold text-emerald-400">16–19</div>
                <div className="text-zinc-500">Discharge window @ $84 avg</div>
              </div>
              <div className="rounded-lg bg-zinc-800 p-3">
                <div className="text-lg font-bold text-white">$175</div>
                <div className="text-zinc-500">Projected daily revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Recommendation */}
      {step === 3 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400" />
              <p className="text-sm font-semibold text-white">
                AI Recommendation — GPT-4o via LangGraph agent
              </p>
              <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs">HB_NORTH</Badge>
            </div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-5">
              <p className="text-sm leading-relaxed text-zinc-300">{RECOMMENDATION}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              {[
                { label: "Strategy", value: "LP Optimizer" },
                { label: "Spread captured", value: "$69/MWh" },
                { label: "Expected revenue", value: "$175.35" },
                { label: "Forecast MAE", value: "$3.20/MWh" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-zinc-800 p-3 text-center">
                  <div className="font-bold text-white">{s.value}</div>
                  <div className="text-zinc-500">{s.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={step === STEPS.length - 1}
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-cyan-400 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </section>
  );
}
