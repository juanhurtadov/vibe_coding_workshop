/**
 * POST /api/ingest
 *
 * Fetches ERCOT DAM LMP prices and stores them in market_prices.
 * Skips duplicates via the unique index on (node, interval_start, price_type).
 *
 * Body (all optional):
 *   nodes  — array of ERCOT node names (default: all four hubs)
 *   date   — YYYY-MM-DD (default: today UTC)
 *
 * Example:
 *   POST /api/ingest
 *   { "nodes": ["HB_NORTH", "HB_HOUSTON"], "date": "2026-02-23" }
 */

import { db } from "@/lib/db";
import { marketPrices } from "@/lib/schema";
import { fetchDamPrices, ERCOT_NODES, todayUtc } from "@/lib/ercot";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nodes: string[] = body.nodes ?? [...ERCOT_NODES];
    const date: string = body.date ?? todayUtc();

    // Validate nodes
    const invalid = nodes.filter((n) => !(ERCOT_NODES as readonly string[]).includes(n));
    if (invalid.length) {
      return Response.json(
        { error: `Unknown nodes: ${invalid.join(", ")}. Valid: ${ERCOT_NODES.join(", ")}` },
        { status: 400 }
      );
    }

    const { records, source } = await fetchDamPrices(nodes, date);

    if (records.length === 0) {
      return Response.json({ inserted: 0, skipped: 0, date, nodes, source });
    }

    // Upsert — on conflict (unique index) do nothing, so reruns are safe
    const result = await db
      .insert(marketPrices)
      .values(
        records.map((r) => ({
          node: r.node,
          intervalStart: r.intervalStart,
          pricePerMwh: r.pricePerMwh,
          priceType: r.priceType,
        }))
      )
      .onConflictDoNothing()
      .returning({ id: marketPrices.id });

    const inserted = result.length;
    const skipped = records.length - inserted;

    return Response.json({ inserted, skipped, date, nodes, source });
  } catch (err) {
    console.error("[ingest] error", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * GET /api/ingest?node=HB_NORTH&limit=48
 * Returns the most recent stored prices for a node.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const node = searchParams.get("node") ?? "HB_NORTH";
    const limit = Math.min(Number(searchParams.get("limit") ?? "24"), 200);

    const rows = await db
      .select({
        node: marketPrices.node,
        intervalStart: marketPrices.intervalStart,
        pricePerMwh: marketPrices.pricePerMwh,
        priceType: marketPrices.priceType,
      })
      .from(marketPrices)
      .where(sql`${marketPrices.node} = ${node}`)
      .orderBy(sql`${marketPrices.intervalStart} DESC`)
      .limit(limit);

    return Response.json({ node, count: rows.length, prices: rows });
  } catch (err) {
    console.error("[ingest GET] error", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
