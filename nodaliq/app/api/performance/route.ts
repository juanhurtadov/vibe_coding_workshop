import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { performanceLog, dispatchSchedules, batteryProfiles } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the user's battery profile
  const profiles = await db
    .select({ id: batteryProfiles.id })
    .from(batteryProfiles)
    .where(eq(batteryProfiles.userId, userId))
    .limit(1);

  if (profiles.length === 0) {
    return NextResponse.json({ logs: [], schedules: [] });
  }

  const batteryProfileId = profiles[0].id;

  const [logs, schedules] = await Promise.all([
    db
      .select()
      .from(performanceLog)
      .where(eq(performanceLog.batteryProfileId, batteryProfileId))
      .orderBy(desc(performanceLog.logDate))
      .limit(30),
    db
      .select()
      .from(dispatchSchedules)
      .where(eq(dispatchSchedules.batteryProfileId, batteryProfileId))
      .orderBy(desc(dispatchSchedules.scheduleDate))
      .limit(30),
  ]);

  return NextResponse.json({ logs, schedules });
}
