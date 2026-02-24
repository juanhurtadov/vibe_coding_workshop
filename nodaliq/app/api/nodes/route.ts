import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketPrices } from "@/lib/schema";
import { desc, inArray } from "drizzle-orm";

const NODES = ["HB_NORTH", "HB_SOUTH", "HB_WEST", "HB_HOUSTON"];

export async function GET() {
  // Fetch the latest price row for each hub node
  const rows = await db
    .select({
      node: marketPrices.node,
      pricePerMwh: marketPrices.pricePerMwh,
      intervalStart: marketPrices.intervalStart,
    })
    .from(marketPrices)
    .where(inArray(marketPrices.node, NODES))
    .orderBy(desc(marketPrices.intervalStart))
    .limit(20); // grab enough to find one per node

  // Pick the most recent row per node
  const latest: Record<string, { pricePerMwh: number; intervalStart: Date }> = {};
  for (const row of rows) {
    if (!latest[row.node]) {
      latest[row.node] = {
        pricePerMwh: row.pricePerMwh,
        intervalStart: row.intervalStart,
      };
    }
  }

  const result = NODES.map((node) => ({
    node,
    pricePerMwh: latest[node]?.pricePerMwh ?? null,
    intervalStart: latest[node]?.intervalStart ?? null,
  }));

  return NextResponse.json({ nodes: result });
}
