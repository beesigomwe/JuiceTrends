import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  username: true,
  password: true,
  email: true,
  avatar: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "password">;

// Social platforms enum
export const platformTypes = ["facebook", "instagram", "twitter", "linkedin", "tiktok", "pinterest", "youtube"] as const;
export type PlatformType = typeof platformTypes[number];

// Social accounts connected by users
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    platform: text("platform").notNull().$type<PlatformType>(),
    accountName: text("account_name").notNull(),
    accountHandle: text("account_handle").notNull(),
    avatarUrl: text("avatar_url"),
    accessToken: text("access_token"),
    platformUserId: text("platform_user_id").notNull(),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    isConnected: boolean("is_connected").default(true),
    followers: integer("followers").default(0),
    engagement: text("engagement").default("0%"),
  },
  (t) => ({
    userPlatformUser: unique("social_accounts_user_platform_platform_user_key").on(
      t.userId,
      t.platform,
      t.platformUserId,
    ),
  }),
);

export const insertSocialAccountSchema = createInsertSchema(socialAccounts)
  .omit({ id: true })
  .refine((data) => platformTypes.includes(data.platform as PlatformType), {
    message: "platform must be one of: " + platformTypes.join(", "),
    path: ["platform"],
  });

export type InsertSocialAccount = z.infer<typeof insertSocialAccountSchema>;
export type SocialAccount = typeof socialAccounts.$inferSelect;

// Post status types
export const postStatuses = ["draft", "scheduled", "published", "failed"] as const;
export type PostStatus = typeof postStatuses[number];

// Posts table
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  mediaUrls: text("media_urls").array(),
  platforms: text("platforms").array().notNull().$type<PlatformType[]>(),
  status: text("status").notNull().$type<PostStatus>().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  hashtags: text("hashtags").array(),
  reach: integer("reach").default(0),
  impressions: integer("impressions").default(0),
  engagement: integer("engagement").default(0),
  clicks: integer("clicks").default(0),
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
  reach: true,
  impressions: true,
  engagement: true,
  clicks: true,
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// Analytics aggregates
export const analyticsData = pgTable("analytics_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  platform: text("platform").notNull().$type<PlatformType>(),
  date: timestamp("date").notNull(),
  reach: integer("reach").default(0),
  impressions: integer("impressions").default(0),
  engagement: integer("engagement").default(0),
  clicks: integer("clicks").default(0),
  followers: integer("followers").default(0),
  newFollowers: integer("new_followers").default(0),
});

export const insertAnalyticsSchema = createInsertSchema(analyticsData).omit({
  id: true,
});

export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type Analytics = typeof analyticsData.$inferSelect;

// Frontend types for UI
export type DashboardStats = {
  totalReach: number;
  reachChange: number;
  totalEngagement: number;
  engagementChange: number;
  scheduledPosts: number;
  postsChange: number;
  totalFollowers: number;
  followersChange: number;
};

export type ChartDataPoint = {
  date: string;
  reach: number;
  engagement: number;
  impressions: number;
};

export type CalendarPost = Post & {
  platformIcons: PlatformType[];
};
