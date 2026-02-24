import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketPrices } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

const MODAL_FORECAST_URL = process.env.MODAL_FORECAST_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const node: string = body.node ?? "HB_NORTH";
    const horizonHours: number = body.horizon_hours ?? 24;

    // Fetch recent prices from DB for this node
    const rows = await db
      .select({
        interval_start: marketPrices.intervalStart,
        price_per_mwh: marketPrices.pricePerMwh,
      })
      .from(marketPrices)
      .where(eq(marketPrices.node, node))
      .orderBy(desc(marketPrices.intervalStart))
      .limit(72); // last 3 days

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

    const modalRes = await fetch(MODAL_FORECAST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices, horizon_hours: horizonHours }),
    });

    if (!modalRes.ok) {
      const text = await modalRes.text();
      return NextResponse.json(
        { error: `Modal forecast failed: ${modalRes.status}`, detail: text },
        { status: 502 }
      );
    }

    const result = await modalRes.json();
    return NextResponse.json({ node, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
