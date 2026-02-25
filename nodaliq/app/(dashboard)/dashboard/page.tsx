"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const NodeMap = dynamic(() => import("@/components/NodeMap"), { ssr: false });
const IntelligenceReport = dynamic(() => import("@/components/IntelligenceReport"), { ssr: false });
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Zap, TrendingUp, Clock, DollarSign } from "lucide-react";

interface HourlySlot {
  hour: number;
  action: "charge" | "discharge" | "idle";
  amount_kw: number;
  expected_revenue: number;
}

interface ForecastPoint {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

interface AgentResult {
  node: string;
  recommendation_text: string;
  selected_strategy: string;
  peak_hours: number[];
  trough_hours: number[];
  lp_schedule: { schedule: HourlySlot[]; total_expected_revenue: number };
  rl_schedule: { schedule: HourlySlot[]; total_expected_revenue: number } | null;
  forecast: ForecastPoint[];
}

const NODES = ["HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_HOUSTON"];

function formatUsd(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STORAGE_KEY = "nodaliq_last_result";

export default function DashboardPage() {
  const [node, setNode] = useState("HB_NORTH");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Restore last result from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AgentResult;
        setResult(parsed);
        setNode(parsed.node ?? "HB_NORTH");
      }
    } catch {}
  }, []);

  async function runAgent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Agent run failed");
        return;
      }
      const data = await res.json();
      setResult(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  // Build chart data: merge LP schedule + forecast by hour
  const chartData = result
    ? Array.from({ length: 24 }, (_, h) => {
        const slot = result.lp_schedule?.schedule?.find((s) => s.hour === h);
        const fp = result.forecast?.[h];
        const amount =
          slot?.action === "discharge"
            ? slot.amount_kw
            : slot?.action === "charge"
            ? -slot.amount_kw
            : 0;
        return {
          hour: `${String(h).padStart(2, "0")}:00`,
          amount,
          price: fp?.yhat ?? null,
          action: slot?.action ?? "idle",
        };
      })
    : [];

  // Key stats
  const lpRevenue = result?.lp_schedule?.total_expected_revenue ?? 0;
  const rlRevenue = result?.rl_schedule?.total_expected_revenue ?? null;
  const schedule = result?.lp_schedule?.schedule ?? [];
  const bestDischarge = schedule
    .filter((s) => s.action === "discharge")
    .sort((a, b) => b.expected_revenue - a.expected_revenue)[0];
  const bestCharge = schedule
    .filter((s) => s.action === "charge")
    .sort((a, b) => a.expected_revenue - b.expected_revenue)[0];

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            AI-powered dispatch recommendation for today
            {result && (
              <span className="ml-2 text-zinc-600">
                · last run {new Date(result.forecast?.[0]?.ds ?? "").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={node}
            onChange={(e) => setNode(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {NODES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {result && (
            <Button
              variant="outline"
              onClick={() => setReportOpen(true)}
              className="border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white bg-transparent"
            >
              <FileText className="mr-2 h-4 w-4" />
              Intelligence Report
            </Button>
          )}
          <Button
            onClick={runAgent}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            {loading ? "Running agent…" : "Run Agent"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!result && !loading && (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-zinc-500">
          Click "Run Agent" to generate today's dispatch recommendation
        </div>
      )}

      {loading && (
        <div className="flex h-64 items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          Running forecast → LP optimizer → LangGraph agent…
        </div>
      )}

      {result && reportOpen && (
        <IntelligenceReport
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          data={result}
        />
      )}

      {result && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                  <DollarSign className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Expected Revenue (LP)</p>
                  <p className="text-xl font-bold text-white">{formatUsd(lpRevenue)}</p>
                  {rlRevenue !== null && (
                    <p className="text-xs text-zinc-500">RL: {formatUsd(rlRevenue)}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Best Discharge</p>
                  <p className="text-xl font-bold text-white">
                    {bestDischarge ? `${String(bestDischarge.hour).padStart(2, "0")}:00` : "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {bestDischarge ? `${bestDischarge.amount_kw} kW` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Best Charge</p>
                  <p className="text-xl font-bold text-white">
                    {bestCharge ? `${String(bestCharge.hour).padStart(2, "0")}:00` : "—"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {bestCharge ? `${bestCharge.amount_kw} kW` : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendation card */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Zap className="h-4 w-4 text-cyan-400" />
                AI Recommendation
                <Badge className="ml-1 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  {node}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                {result.recommendation_text ?? "No recommendation text returned."}
              </p>
            </CardContent>
          </Card>

          {/* Dispatch chart */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">
                24-Hour Dispatch Schedule
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  bars = kW (+ discharge / − charge) · line = forecast price $/MWh
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#3f3f46" }}
                    interval={2}
                  />
                  <YAxis
                    yAxisId="kw"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: "kW", position: "insideLeft", fill: "#52525b", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="price"
                    orientation="right"
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: "$/MWh", position: "insideRight", fill: "#52525b", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: 8,
                      color: "#e4e4e7",
                      fontSize: 12,
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => {
                      if (value === undefined) return ["—", name ?? ""];
                      return (name ?? "") === "price"
                        ? [`$${value.toFixed(2)}/MWh`, "Forecast Price"]
                        : [`${Math.abs(value)} kW ${value >= 0 ? "discharge" : "charge"}`, "Dispatch"];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#71717a" }}
                    formatter={(v) => (v === "amount" ? "Dispatch (kW)" : "Forecast Price")}
                  />
                  <ReferenceLine yAxisId="kw" y={0} stroke="#3f3f46" />
                  <Bar
                    yAxisId="kw"
                    dataKey="amount"
                    radius={[3, 3, 0, 0]}
                    fill="#06b6d4"
                    label={false}
                    // Color bars: positive = emerald (discharge), negative = cyan (charge)
                    style={{ cursor: "default" }}
                  />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="price"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={2}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ERCOT node map */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">
                ERCOT Hub Nodes
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  click a node to switch · color = latest LMP price
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-1">
              <div className="h-72 px-2 pb-2">
                <NodeMap selectedNode={node} onSelectNode={setNode} />
              </div>
              <div className="flex flex-wrap gap-3 px-5 pb-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" /> Negative (curtailment)</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400" /> &lt; $30</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> $30–60</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" /> $60–100</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> &gt; $100</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
