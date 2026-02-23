import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  date,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// pgvector custom type
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

// ─── Tables ────────────────────────────────────────────────────────────────

export const batteryProfiles = pgTable("battery_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  capacityKwh: real("capacity_kwh").notNull(),
  maxChargeKw: real("max_charge_kw").notNull(),
  maxDischargeKw: real("max_discharge_kw").notNull(),
  roundTripEfficiency: real("round_trip_efficiency").notNull().default(0.85),
  minSoc: real("min_soc").notNull().default(0.1),
  maxSoc: real("max_soc").notNull().default(0.95),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketPrices = pgTable(
  "market_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    node: text("node").notNull(),
    intervalStart: timestamp("interval_start", { withTimezone: true }).notNull(),
    pricePerMwh: real("price_per_mwh").notNull(),
    priceType: text("price_type").notNull(), // 'DAM' | 'RTM'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("market_prices_node_interval_type_idx").on(
      t.node,
      t.intervalStart,
      t.priceType
    ),
  ]
);

export const dispatchSchedules = pgTable("dispatch_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  batteryProfileId: uuid("battery_profile_id")
    .notNull()
    .references(() => batteryProfiles.id, { onDelete: "cascade" }),
  scheduleDate: date("schedule_date").notNull(),
  node: text("node").notNull(),
  hourlySchedule: jsonb("hourly_schedule").notNull().default([]),
  totalExpectedRevenue: real("total_expected_revenue"),
  recommendationText: text("recommendation_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const performanceLog = pgTable("performance_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  dispatchScheduleId: uuid("dispatch_schedule_id")
    .notNull()
    .references(() => dispatchSchedules.id, { onDelete: "cascade" }),
  batteryProfileId: uuid("battery_profile_id")
    .notNull()
    .references(() => batteryProfiles.id, { onDelete: "cascade" }),
  logDate: date("log_date").notNull(),
  recommendedRevenue: real("recommended_revenue"),
  actualRevenue: real("actual_revenue"),
  accuracyPct: real("accuracy_pct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    filename: text("filename").notNull(),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull().default(0),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_user_id_idx").on(t.userId)]
);

// ─── Relations ─────────────────────────────────────────────────────────────

export const batteryProfilesRelations = relations(batteryProfiles, ({ many }) => ({
  dispatchSchedules: many(dispatchSchedules),
  performanceLogs: many(performanceLog),
}));

export const dispatchSchedulesRelations = relations(dispatchSchedules, ({ one, many }) => ({
  batteryProfile: one(batteryProfiles, {
    fields: [dispatchSchedules.batteryProfileId],
    references: [batteryProfiles.id],
  }),
  performanceLogs: many(performanceLog),
}));

export const performanceLogRelations = relations(performanceLog, ({ one }) => ({
  dispatchSchedule: one(dispatchSchedules, {
    fields: [performanceLog.dispatchScheduleId],
    references: [dispatchSchedules.id],
  }),
  batteryProfile: one(batteryProfiles, {
    fields: [performanceLog.batteryProfileId],
    references: [batteryProfiles.id],
  }),
}));

// ─── Types ─────────────────────────────────────────────────────────────────

export type BatteryProfile = typeof batteryProfiles.$inferSelect;
export type NewBatteryProfile = typeof batteryProfiles.$inferInsert;

export type MarketPrice = typeof marketPrices.$inferSelect;
export type NewMarketPrice = typeof marketPrices.$inferInsert;

export type DispatchSchedule = typeof dispatchSchedules.$inferSelect;
export type NewDispatchSchedule = typeof dispatchSchedules.$inferInsert;

export type PerformanceLog = typeof performanceLog.$inferSelect;
export type NewPerformanceLog = typeof performanceLog.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
