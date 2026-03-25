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

// Social platforms enum — includes Threads
export const platformTypes = ["facebook", "instagram", "twitter", "linkedin", "tiktok", "pinterest", "youtube", "threads"] as const;
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

// Per-platform publish result stored in publishResults JSONB column
export type PlatformPublishResult = {
  success: boolean;
  platformPostId?: string;
  error?: string;
};

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
  // Per-platform publish outcomes (§3.1)
  publishResults: jsonb("publish_results").$type<Record<string, PlatformPublishResult>>(),
  // Platform-specific metadata: YouTube title/description, Pinterest boardId, etc. (§3.1)
  platformMetadata: jsonb("platform_metadata").$type<Record<string, Record<string, string>>>(),
  // Optional brand this post belongs to
  brandId: varchar("brand_id"),
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
  reach: true,
  impressions: true,
  engagement: true,
  clicks: true,
  // brandId is optional and set separately
}).extend({
  brandId: z.string().optional().nullable(),
});

export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// Media table (§3.1)
export const media = pgTable("media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMediaSchema = createInsertSchema(media).omit({ id: true, createdAt: true });
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof media.$inferSelect;

// postMedia join table (§3.1)
export const postMedia = pgTable("post_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  mediaId: varchar("media_id").notNull(),
  position: integer("position").default(0),
});

export const insertPostMediaSchema = createInsertSchema(postMedia).omit({ id: true });
export type InsertPostMedia = z.infer<typeof insertPostMediaSchema>;
export type PostMedia = typeof postMedia.$inferSelect;

// ─── Brands ──────────────────────────────────────────────────────────────────
// A brand is a named group of social accounts belonging to one user.
// When composing a post, the user picks a brand and the drawer auto-selects
// the brand's platforms and routes publishing to those specific accounts.
export const brands = pgTable("brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"),   // accent colour for the brand chip
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBrandSchema = createInsertSchema(brands).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

// brandAccounts — which social accounts belong to each brand
export const brandAccounts = pgTable(
  "brand_accounts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    brandId: varchar("brand_id").notNull(),
    accountId: varchar("account_id").notNull(),
  },
  (t) => ({
    brandAccountUniq: unique("brand_accounts_brand_account_key").on(t.brandId, t.accountId),
  }),
);

export const insertBrandAccountSchema = createInsertSchema(brandAccounts).omit({ id: true });
export type InsertBrandAccount = z.infer<typeof insertBrandAccountSchema>;
export type BrandAccount = typeof brandAccounts.$inferSelect;

// Convenience type returned by the API — brand with its member accounts
export type BrandWithAccounts = Brand & { accounts: SocialAccount[] };

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

// ─── Suggestion Engine ────────────────────────────────────────────────────────
// Stores AI-generated post suggestions, follow-up threads, and best-time advice.

export const suggestionTypes = ["new_post", "follow_up", "comment_reply"] as const;
export type SuggestionType = typeof suggestionTypes[number];

export const suggestionStatuses = ["pending", "accepted", "dismissed", "scheduled"] as const;
export type SuggestionStatus = typeof suggestionStatuses[number];

export const suggestedPosts = pgTable("suggested_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  // Type of suggestion
  type: text("type").notNull().$type<SuggestionType>().default("new_post"),
  // The source post this suggestion continues (null for brand-new post ideas)
  sourcePostId: varchar("source_post_id"),
  // AI-generated content
  content: text("content").notNull(),
  // Platform targets
  platforms: text("platforms").array().notNull().$type<PlatformType[]>(),
  // Suggested hashtags
  hashtags: text("hashtags").array(),
  // AI reasoning / why this post is suggested
  reasoning: text("reasoning"),
  // Best time to post (ISO string, e.g. "Tuesday 10:00 AM")
  suggestedTime: text("suggested_time"),
  // Day-of-week + hour recommendation (0-6, 0-23)
  suggestedDayOfWeek: integer("suggested_day_of_week"),
  suggestedHour: integer("suggested_hour"),
  // Confidence score 0-100
  confidenceScore: integer("confidence_score").default(70),
  // Engagement prediction label
  engagementPrediction: text("engagement_prediction"),
  // Status lifecycle
  status: text("status").notNull().$type<SuggestionStatus>().default("pending"),
  // If scheduled, the resulting post id
  scheduledPostId: varchar("scheduled_post_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSuggestedPostSchema = createInsertSchema(suggestedPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSuggestedPost = z.infer<typeof insertSuggestedPostSchema>;
export type SuggestedPost = typeof suggestedPosts.$inferSelect;

// Best-time window returned by the engine (not persisted, computed on the fly)
export type BestTimeWindow = {
  platform: PlatformType;
  dayOfWeek: number;        // 0 = Sunday
  hour: number;             // 0-23
  label: string;            // e.g. "Tuesday 10:00 AM"
  avgEngagement: number;
  sampleSize: number;
};

// Full suggestion run result returned by POST /api/suggestions/generate
export type SuggestionRunResult = {
  suggestions: SuggestedPost[];
  bestTimes: BestTimeWindow[];
  analysedPosts: number;
  generatedAt: string;
};
