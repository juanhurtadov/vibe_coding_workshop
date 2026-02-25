"use client";

import dynamic from "next/dynamic";
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
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Zap, TrendingUp, Clock, DollarSign, MapPin } from "lucide-react";

const NodeMap = dynamic(() => import("@/components/NodeMap"), { ssr: false });

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

interface ReportData {
  node: string;
  forecast: ForecastPoint[];
  lp_schedule: { schedule: HourlySlot[]; total_expected_revenue: number };
  rl_schedule: { schedule: HourlySlot[]; total_expected_revenue: number } | null;
  recommendation_text: string;
  selected_strategy: string;
  peak_hours: number[];
  trough_hours: number[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ReportData;
}

function fmt(v: number) {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function IntelligenceReport({ open, onClose, data }: Props) {
  const schedule = data.lp_schedule?.schedule ?? [];
  const forecast = data.forecast ?? [];

  const chartData = Array.from({ length: 24 }, (_, h) => {
    const slot = schedule.find((s) => s.hour === h);
    const fp = forecast[h];
    const amount =
      slot?.action === "discharge" ? slot.amount_kw :
      slot?.action === "charge" ? -slot.amount_kw : 0;
    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      amount,
      price: fp?.yhat ?? null,
      lower: fp?.yhat_lower ?? null,
      upper: fp?.yhat_upper ?? null,
    };
  });

  const chargeSlots = schedule.filter((s) => s.action === "charge");
  const dischargeSlots = schedule.filter((s) => s.action === "discharge");
  const avgChargePrice = chargeSlots.length
    ? forecast.filter((_, i) => chargeSlots.some((s) => s.hour === i)).reduce((a, f) => a + f.yhat, 0) / chargeSlots.length
    : 0;
  const avgDischargePrice = dischargeSlots.length
    ? forecast.filter((_, i) => dischargeSlots.some((s) => s.hour === i)).reduce((a, f) => a + f.yhat, 0) / dischargeSlots.length
    : 0;
  const spread = avgDischargePrice - avgChargePrice;
  const totalRevenue = data.lp_schedule?.total_expected_revenue ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-zinc-800 bg-zinc-950 text-white print:max-h-none print:overflow-visible">
        <DialogHeader className="flex-row items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Zap className="h-5 w-5 text-cyan-400" />
              NodalIQ Intelligence Report
            </DialogTitle>
            <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
              <MapPin className="h-3.5 w-3.5" />
              {data.node}
              <span>·</span>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs">
                {data.selected_strategy?.toUpperCase()} strategy
              </Badge>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 text-zinc-400 hover:text-white print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print / PDF
          </Button>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: <DollarSign className="h-4 w-4 text-cyan-400" />, label: "Expected Revenue", value: fmt(totalRevenue), bg: "bg-cyan-500/10" },
              { icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, label: "Price Spread", value: `$${spread.toFixed(2)}/MWh`, bg: "bg-emerald-500/10" },
              { icon: <Clock className="h-4 w-4 text-amber-400" />, label: "Avg Charge Price", value: `$${avgChargePrice.toFixed(2)}/MWh`, bg: "bg-amber-500/10" },
              { icon: <Clock className="h-4 w-4 text-rose-400" />, label: "Avg Discharge Price", value: `$${avgDischargePrice.toFixed(2)}/MWh`, bg: "bg-rose-500/10" },
            ].map((k) => (
              <div key={k.label} className={`flex items-center gap-3 rounded-lg ${k.bg} p-3`}>
                {k.icon}
                <div>
                  <div className="text-xs text-zinc-500">{k.label}</div>
                  <div className="text-sm font-bold text-white">{k.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* AI Recommendation */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">AI Recommendation</h3>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-sm leading-relaxed text-zinc-300">{data.recommendation_text}</p>
            </div>
          </div>

          {/* Dispatch chart */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              24-Hour Dispatch Schedule — LP Optimizer
            </h3>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="hour" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} interval={2} />
                  <YAxis yAxisId="kw" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="price" orientation="right" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number | undefined, name: string | undefined) => {
                      const n = v ?? 0;
                      return name === "price"
                        ? [`$${n.toFixed(2)}/MWh`, "Forecast"] as [string, string]
                        : [`${Math.abs(n)} kW ${n > 0 ? "↑discharge" : n < 0 ? "↓charge" : "idle"}`, "Dispatch"] as [string, string];
                    }}
                  />
                  <ReferenceLine yAxisId="kw" y={0} stroke="#3f3f46" />
                  <Bar yAxisId="kw" dataKey="amount" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="price" type="monotone" dataKey="price" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hourly breakdown table */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Hourly Economics</h3>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-xs">
                <thead className="border-b border-zinc-800 bg-zinc-900">
                  <tr className="text-left text-zinc-500">
                    <th className="px-3 py-2 font-medium">Hour</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Forecast Price</th>
                    <th className="px-3 py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 bg-zinc-950">
                  {schedule
                    .filter((s) => s.action !== "idle")
                    .map((s) => {
                      const fp = forecast[s.hour]?.yhat ?? 0;
                      return (
                        <tr key={s.hour} className="text-zinc-300">
                          <td className="px-3 py-2 font-mono">{String(s.hour).padStart(2, "0")}:00</td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              s.action === "discharge" ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"
                            }`}>
                              {s.action}
                            </span>
                          </td>
                          <td className="px-3 py-2">{s.amount_kw.toFixed(0)} kW</td>
                          <td className="px-3 py-2">${fp.toFixed(2)}/MWh</td>
                          <td className={`px-3 py-2 font-medium ${s.expected_revenue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {s.expected_revenue >= 0 ? "+" : ""}{fmt(s.expected_revenue)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot className="border-t border-zinc-700 bg-zinc-900">
                  <tr className="font-semibold text-white">
                    <td className="px-3 py-2" colSpan={4}>Total Expected Revenue</td>
                    <td className="px-3 py-2 text-emerald-400">{fmt(totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ERCOT node map */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">ERCOT Hub Node Map</h3>
            <div className="h-56 overflow-hidden rounded-lg border border-zinc-800">
              <NodeMap selectedNode={data.node} onSelectNode={() => {}} />
            </div>
            <p className="mt-1.5 text-xs text-zinc-600">
              Pin color = latest LMP · violet=negative · cyan=&lt;$30 · green=$30–60 · amber=$60–100 · red=&gt;$100
            </p>
          </div>

          {/* Strategy comparison */}
          {data.rl_schedule && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Strategy Comparison</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "LP Optimizer", value: data.lp_schedule?.total_expected_revenue ?? 0, selected: data.selected_strategy === "lp" },
                  { label: "SAC RL Policy", value: data.rl_schedule?.total_expected_revenue ?? 0, selected: data.selected_strategy === "rl" },
                ].map((s) => (
                  <div key={s.label} className={`rounded-lg border p-4 ${s.selected ? "border-cyan-500/50 bg-cyan-500/5" : "border-zinc-800 bg-zinc-900"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">{s.label}</span>
                      {s.selected && <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs">Selected</Badge>}
                    </div>
                    <div className="mt-1 text-2xl font-bold text-white">{fmt(s.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-zinc-700 print:text-zinc-400">
            Generated by NodalIQ · {new Date().toISOString()} · Data source: ERCOT DAM
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
