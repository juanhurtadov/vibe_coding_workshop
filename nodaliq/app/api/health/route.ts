import { db } from "@/lib/db";
import { batteryProfiles } from "@/lib/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // lightweight connectivity check — just count rows, no full scan
    const result = await db.select({ count: sql<number>`count(*)` }).from(batteryProfiles);
    return Response.json({
      status: "ok",
      database: "connected",
      battery_profiles_count: Number(result[0].count),
    });
  } catch (err) {
    console.error("[health] db error", err);
    return Response.json(
      { status: "error", database: "unreachable", error: String(err) },
      { status: 500 }
    );
  }
}
