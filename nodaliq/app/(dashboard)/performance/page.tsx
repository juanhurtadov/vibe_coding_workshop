"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PerformanceRow {
  id: string;
  logDate: string;
  recommendedRevenue: number | null;
  actualRevenue: number | null;
  accuracyPct: number | null;
}

interface ScheduleRow {
  id: string;
  scheduleDate: string;
  totalExpectedRevenue: number | null;
  node: string;
}

function formatUsd(v: number | null) {
  if (v === null) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pctColor(pct: number | null) {
  if (pct === null) return "text-zinc-400";
  if (pct >= 90) return "text-emerald-400";
  if (pct >= 70) return "text-yellow-400";
  return "text-red-400";
}

export default function PerformancePage() {
  const [logs, setLogs] = useState<PerformanceRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/performance")
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs ?? []);
        setSchedules(d.schedules ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build cumulative chart data from schedules
  const chartData = schedules
    .slice()
    .reverse()
    .map((s, i, arr) => {
      const lpCumulative = arr
        .slice(0, i + 1)
        .reduce((sum, r) => sum + (r.totalExpectedRevenue ?? 0), 0);
      // Flat baseline: assume $0 daily (no dispatch)
      return {
        date: s.scheduleDate,
        LP: parseFloat(lpCumulative.toFixed(2)),
        Baseline: 0,
      };
    });

  const totalLp = schedules.reduce((s, r) => s + (r.totalExpectedRevenue ?? 0), 0);
  const avgAccuracy =
    logs.length > 0
      ? logs.reduce((s, r) => s + (r.accuracyPct ?? 0), 0) / logs.filter((r) => r.accuracyPct !== null).length
      : null;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Performance</h1>
        <p className="mt-1 text-sm text-zinc-400">
          LP optimizer revenue vs. baseline · last 30 schedules
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          Loading performance data…
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Total LP Revenue</p>
                  <p className="text-xl font-bold text-white">{formatUsd(totalLp)}</p>
                  <p className="text-xs text-zinc-500">{schedules.length} days</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-700/40">
                  <Minus className="h-5 w-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Flat Baseline</p>
                  <p className="text-xl font-bold text-white">$0</p>
                  <p className="text-xs text-zinc-500">no dispatch</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <TrendingDown className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Avg Forecast Accuracy</p>
                  <p className="text-xl font-bold text-white">
                    {avgAccuracy !== null ? `${avgAccuracy.toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-xs text-zinc-500">{logs.filter((l) => l.accuracyPct !== null).length} logged</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cumulative revenue chart */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Cumulative Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
                  No schedule data yet — run the agent from the Dashboard to generate schedules.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: "#3f3f46" }}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #3f3f46",
                        borderRadius: 8,
                        color: "#e4e4e7",
                        fontSize: 12,
                      }}
                      formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, undefined]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#71717a" }} />
                    <Line
                      type="monotone"
                      dataKey="LP"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Baseline"
                      stroke="#52525b"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Schedule table */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Schedule History</CardTitle>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">No schedules generated yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                        <th className="pb-3 pr-4 font-medium">Date</th>
                        <th className="pb-3 pr-4 font-medium">Node</th>
                        <th className="pb-3 pr-4 font-medium">LP Revenue</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {schedules.map((s) => {
                        const log = logs.find((l) => l.logDate === s.scheduleDate);
                        return (
                          <tr key={s.id} className="text-zinc-300">
                            <td className="py-3 pr-4 font-mono text-xs">{s.scheduleDate}</td>
                            <td className="py-3 pr-4">
                              <Badge
                                variant="outline"
                                className="border-zinc-700 text-xs text-zinc-400"
                              >
                                {s.node}
                              </Badge>
                            </td>
                            <td className="py-3 pr-4">{formatUsd(s.totalExpectedRevenue)}</td>
                            <td className="py-3">
                              {log?.accuracyPct !== undefined ? (
                                <span className={`font-medium ${pctColor(log.accuracyPct)}`}>
                                  {log.accuracyPct !== null
                                    ? `${log.accuracyPct.toFixed(1)}% accuracy`
                                    : "—"}
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-xs">awaiting actuals</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
