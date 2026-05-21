import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Stores the mapping between Supabase user IDs and Stripe customer/subscription IDs.
// This lives in Replit PostgreSQL alongside the stripe-replit-sync stripe schema.
export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  user_id:                text("user_id").notNull().unique(), // Supabase auth.users.id
  stripe_customer_id:     text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  subscription_status:    text("subscription_status"),       // active, canceled, past_due, etc.
  plan_type:              text("plan_type"),                  // e.g. monthly, yearly
  created_at:             timestamp("created_at").defaultNow().notNull(),
  updated_at:             timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptionsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;
