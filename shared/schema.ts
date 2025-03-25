import { pgTable, text, serial, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Table for tracking links
export const links = pgTable("links", {
  id: serial("id").primaryKey(),
  trackingId: text("tracking_id").notNull().unique(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  platform: text("platform").notNull(),
  created: timestamp("created").notNull().defaultNow(),
});

// Table for click data
export const clicks = pgTable("clicks", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  location: text("location"),
  metadata: json("metadata"),
});

// Zod schemas for validation
export const insertLinkSchema = createInsertSchema(links).pick({
  name: true,
  destination: true,
  platform: true,
  trackingId: true,
});

export const insertClickSchema = createInsertSchema(clicks).pick({
  linkId: true,
  ip: true,
  userAgent: true,
  referrer: true,
  location: true,
  metadata: true,
});

// Types
export type Link = typeof links.$inferSelect;
export type InsertLink = z.infer<typeof insertLinkSchema>;
export type Click = typeof clicks.$inferSelect;
export type InsertClick = z.infer<typeof insertClickSchema>;

// Simplified response type for link analytics
export type LinkWithAnalytics = Link & {
  clicks: number;
  dailyClicks: number[];
};
