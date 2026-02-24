import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batteryProfiles } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profiles = await db
    .select()
    .from(batteryProfiles)
    .where(eq(batteryProfiles.userId, userId))
    .limit(1);

  return NextResponse.json({ profile: profiles[0] ?? null });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const existing = await db
    .select({ id: batteryProfiles.id })
    .from(batteryProfiles)
    .where(eq(batteryProfiles.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(batteryProfiles)
      .set({
        name: body.name,
        capacityKwh: body.capacityKwh,
        maxChargeKw: body.maxChargeKw,
        maxDischargeKw: body.maxDischargeKw,
        roundTripEfficiency: body.roundTripEfficiency,
        minSoc: body.minSoc,
        maxSoc: body.maxSoc,
      })
      .where(eq(batteryProfiles.userId, userId))
      .returning();
    return NextResponse.json({ profile: updated });
  }

  const [created] = await db
    .insert(batteryProfiles)
    .values({
      userId,
      name: body.name,
      capacityKwh: body.capacityKwh,
      maxChargeKw: body.maxChargeKw,
      maxDischargeKw: body.maxDischargeKw,
      roundTripEfficiency: body.roundTripEfficiency ?? 0.85,
      minSoc: body.minSoc ?? 0.1,
      maxSoc: body.maxSoc ?? 0.95,
    })
    .returning();

  return NextResponse.json({ profile: created });
}
