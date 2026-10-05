import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { community } from "./communities";

export const reportTarget = pgEnum("report_target", ["post", "message", "quiz"]);
export const reportReason = pgEnum("report_reason", ["spam", "harassment", "inappropriate", "misinformation", "other"]);
export const reportStatus = pgEnum("report_status", ["open", "removed", "dismissed"]);

export const report = pgTable(
  "report",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    communityId: text("community_id")
      .notNull()
      .references(() => community.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: reportTarget("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: reportReason("reason").notNull(),
    details: text("details").notNull().default(""),
    status: reportStatus("status").notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // One report per person per item.
    uniqueIndex("report_unique_idx").on(t.reporterId, t.targetType, t.targetId),
    index("report_queue_idx").on(t.communityId, t.status, t.createdAt),
  ],
);
