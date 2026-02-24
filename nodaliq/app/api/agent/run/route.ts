import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketPrices, dispatchSchedules } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

const MODAL_FORECAST_URL = process.env.MODAL_FORECAST_URL!;
const MODAL_OPTIMIZE_URL = process.env.MODAL_OPTIMIZE_URL!;
const MODAL_RL_URL = process.env.MODAL_RL_URL!;
const MODAL_AGENT_URL = process.env.MODAL_AGENT_URL!;

const DEFAULT_BATTERY = {
  capacity_kwh: 1000,
  max_charge_kw: 250,
  max_discharge_kw: 250,
  round_trip_efficiency: 0.85,
  min_soc: 0.1,
  max_soc: 0.95,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const node: string = body.node ?? "HB_NORTH";
    const batteryProfileId: string | undefined = body.batteryProfileId;
    const battery = { ...DEFAULT_BATTERY, ...(body.battery ?? {}) };

    // 1. Fetch last 72 price rows from Neon for this node
    const rows = await db
      .select({
        interval_start: marketPrices.intervalStart,
        price_per_mwh: marketPrices.pricePerMwh,
      })
      .from(marketPrices)
      .where(eq(marketPrices.node, node))
      .orderBy(desc(marketPrices.intervalStart))
      .limit(72);

    if (rows.length < 2) {
      return NextResponse.json(
        { error: `Not enough price data for node ${node}. Run /api/ingest first.` },
        { status: 422 }
      );
    }

    // Sort oldest → newest for Prophet
    const prices = rows
      .slice()
      .reverse()
      .map((r) => ({
        interval_start: r.interval_start.toISOString(),
        price_per_mwh: r.price_per_mwh,
      }));

    // 2. Get Prophet 24h forecast
    const forecastRes = await fetch(MODAL_FORECAST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices, horizon_hours: 24 }),
    });

    if (!forecastRes.ok) {
      const text = await forecastRes.text();
      return NextResponse.json(
        { error: `Forecast failed: ${forecastRes.status}`, detail: text },
        { status: 502 }
      );
    }

    const forecastData = await forecastRes.json();
    const forecast: Array<{ ds: string; yhat: number; yhat_lower: number; yhat_upper: number }> =
      forecastData.forecast ?? [];
    const forecastPrices = forecast.map((f) => f.yhat);

    // 3. Run LP optimizer and RL agent in parallel
    const [lpRes, rlRes] = await Promise.all([
      fetch(MODAL_OPTIMIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forecast_prices: forecastPrices, battery }),
      }),
      fetch(MODAL_RL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forecast_prices: forecastPrices, battery }),
      }),
    ]);

    if (!lpRes.ok) {
      const text = await lpRes.text();
      return NextResponse.json(
        { error: `LP optimizer failed: ${lpRes.status}`, detail: text },
        { status: 502 }
      );
    }

    const lpSchedule = await lpRes.json();
    const rlSchedule = rlRes.ok ? await rlRes.json() : null;

    // 4. LangGraph agent — market analysis + GPT-4o recommendation
    const agentRes = await fetch(MODAL_AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forecast,
        lp_schedule: lpSchedule,
        rl_schedule: rlSchedule,
        battery,
        node,
      }),
    });

    if (!agentRes.ok) {
      const text = await agentRes.text();
      return NextResponse.json(
        { error: `Agent failed: ${agentRes.status}`, detail: text },
        { status: 502 }
      );
    }

    const agentData = await agentRes.json();

    // 5. Persist to dispatch_schedules if batteryProfileId provided
    let saved = null;
    if (batteryProfileId) {
      const chosenSchedule =
        agentData.selected_strategy === "rl" ? rlSchedule : lpSchedule;
      const [inserted] = await db
        .insert(dispatchSchedules)
        .values({
          batteryProfileId,
          scheduleDate: new Date().toISOString().slice(0, 10),
          node,
          hourlySchedule: chosenSchedule?.schedule ?? [],
          totalExpectedRevenue: chosenSchedule?.total_expected_revenue ?? null,
          recommendationText: agentData.recommendation_text ?? null,
        })
        .returning();
      saved = inserted;
    }

    return NextResponse.json({
      node,
      forecast,
      lp_schedule: lpSchedule,
      rl_schedule: rlSchedule,
      ...agentData,
      saved,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
