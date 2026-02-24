import { NextRequest, NextResponse } from "next/server";

const MODAL_FORECAST_URL = process.env.MODAL_FORECAST_URL!;
const MODAL_OPTIMIZE_URL = process.env.MODAL_OPTIMIZE_URL!;
const MODAL_RL_URL = process.env.MODAL_RL_URL!;

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
    const forecastPrices: number[] | undefined = body.forecast_prices;
    const battery = { ...DEFAULT_BATTERY, ...(body.battery ?? {}) };

    if (!forecastPrices || forecastPrices.length === 0) {
      return NextResponse.json(
        { error: "forecast_prices array is required" },
        { status: 422 }
      );
    }

    // Run LP optimizer and RL agent in parallel
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
    if (!rlRes.ok) {
      const text = await rlRes.text();
      return NextResponse.json(
        { error: `RL agent failed: ${rlRes.status}`, detail: text },
        { status: 502 }
      );
    }

    const [lp, rl] = await Promise.all([lpRes.json(), rlRes.json()]);

    return NextResponse.json({
      lp_schedule: lp,
      rl_schedule: rl,
      forecast_prices: forecastPrices,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
