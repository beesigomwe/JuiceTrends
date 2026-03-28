import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  // Nullable to support OAuth-only users who have no password
  password: text("password"),
  email: text("email").notNull().unique(),
  avatar: text("avatar"),
  // Facebook SSO: stores the Facebook user ID for OAuth login
  facebookId: text("facebook_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  username: true,
  password: true,
  email: true,
  avatar: true,
  facebookId: true,
}).partial({ password: true, facebookId: true });

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
  // Explicit social_account ids to publish to (one per platform in platforms); null = legacy first-match
  targetAccountIds: text("target_account_ids").array(),
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
  targetAccountIds: z.array(z.string()).optional().nullable(),
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

// ─── Ad Management ───────────────────────────────────────────────────────────

export const adCampaignObjectives = ["awareness", "traffic", "engagement", "leads", "conversions", "sales"] as const;
export type AdCampaignObjective = typeof adCampaignObjectives[number];

export const adCampaignStatuses = ["draft", "active", "paused", "completed", "archived"] as const;
export type AdCampaignStatus = typeof adCampaignStatuses[number];

export const adPlatforms = ["facebook", "instagram", "linkedin", "twitter"] as const;
export type AdPlatform = typeof adPlatforms[number];

export const adFormats = ["image", "video", "carousel", "story", "text"] as const;
export type AdFormat = typeof adFormats[number];

export const adBidStrategies = ["lowest_cost", "cost_cap", "bid_cap", "target_cost"] as const;
export type AdBidStrategy = typeof adBidStrategies[number];

// Ad Campaigns — top-level container
export const adCampaigns = pgTable("ad_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  brandId: varchar("brand_id"),
  name: text("name").notNull(),
  objective: text("objective").notNull().$type<AdCampaignObjective>().default("awareness"),
  platform: text("platform").notNull().$type<AdPlatform>(),
  status: text("status").notNull().$type<AdCampaignStatus>().default("draft"),
  totalBudget: integer("total_budget").default(0),       // in cents
  dailyBudget: integer("daily_budget").default(0),       // in cents
  currency: text("currency").default("USD"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  platformCampaignId: text("platform_campaign_id"),      // ID returned by the ad platform
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdCampaignSchema = createInsertSchema(adCampaigns).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  brandId: z.string().optional().nullable(),
  platformCampaignId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;
export type AdCampaign = typeof adCampaigns.$inferSelect;

// Ad Sets — audience + budget + schedule within a campaign
export const adSets = pgTable("ad_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().$type<AdCampaignStatus>().default("draft"),
  // Audience targeting (stored as JSONB for flexibility)
  targeting: jsonb("targeting").$type<{
    ageMin?: number;
    ageMax?: number;
    genders?: string[];
    locations?: string[];
    interests?: string[];
    languages?: string[];
    customAudiences?: string[];
  }>(),
  placement: text("placement"),                          // e.g. "feed", "stories", "reels"
  bidStrategy: text("bid_strategy").$type<AdBidStrategy>().default("lowest_cost"),
  bidAmount: integer("bid_amount").default(0),           // in cents
  dailyBudget: integer("daily_budget").default(0),       // overrides campaign if set
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  platformAdSetId: text("platform_ad_set_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdSetSchema = createInsertSchema(adSets).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  platformAdSetId: z.string().optional().nullable(),
  placement: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
export type InsertAdSet = z.infer<typeof insertAdSetSchema>;
export type AdSet = typeof adSets.$inferSelect;

// Ad Creatives — the actual ad content
export const adCreatives = pgTable("ad_creatives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adSetId: varchar("ad_set_id").notNull(),
  campaignId: varchar("campaign_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  format: text("format").notNull().$type<AdFormat>().default("image"),
  headline: text("headline"),
  bodyText: text("body_text"),
  callToAction: text("call_to_action"),                  // e.g. "Learn More", "Shop Now"
  destinationUrl: text("destination_url"),
  mediaUrl: text("media_url"),
  mediaUrls: text("media_urls").array(),                 // for carousel
  status: text("status").notNull().$type<AdCampaignStatus>().default("draft"),
  platformCreativeId: text("platform_creative_id"),
  previewUrl: text("preview_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAdCreativeSchema = createInsertSchema(adCreatives).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  headline: z.string().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  callToAction: z.string().optional().nullable(),
  destinationUrl: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
  platformCreativeId: z.string().optional().nullable(),
  previewUrl: z.string().optional().nullable(),
});
export type InsertAdCreative = z.infer<typeof insertAdCreativeSchema>;
export type AdCreative = typeof adCreatives.$inferSelect;

// Ad Metrics — daily performance snapshots per campaign
export const adMetrics = pgTable("ad_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  adSetId: varchar("ad_set_id"),
  userId: varchar("user_id").notNull(),
  date: timestamp("date").notNull(),
  spend: integer("spend").default(0),                    // in cents
  impressions: integer("impressions").default(0),
  reach: integer("reach").default(0),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  // Computed fields stored for quick reads
  ctr: text("ctr").default("0"),                         // click-through rate as string e.g. "2.34"
  cpm: text("cpm").default("0"),                         // cost per mille
  cpc: text("cpc").default("0"),                         // cost per click
  roas: text("roas").default("0"),                       // return on ad spend
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdMetricSchema = createInsertSchema(adMetrics).omit({
  id: true, createdAt: true,
}).extend({
  adSetId: z.string().optional().nullable(),
});
export type InsertAdMetric = z.infer<typeof insertAdMetricSchema>;
export type AdMetric = typeof adMetrics.$inferSelect;

// Convenience types for the API
export type AdCampaignWithSets = AdCampaign & {
  adSets: (AdSet & { creatives: AdCreative[] })[];
  metrics?: AdMetricSummary;
};

export type AdMetricSummary = {
  totalSpend: number;       // cents
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: string;
  avgCpm: string;
  avgCpc: string;
  avgRoas: string;
};

// ─── Best-time window returned by the engine (not persisted, computed on the fly)
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

// ─── Newsletter Feature ───────────────────────────────────────────────────────

// Subscriber status
export const subscriberStatuses = ["active", "unsubscribed"] as const;
export type SubscriberStatus = typeof subscriberStatuses[number];

// Newsletter campaign status
export const newsletterStatuses = ["draft", "scheduled", "sent"] as const;
export type NewsletterStatus = typeof newsletterStatuses[number];

// Newsletter Subscribers — people who have opted in to receive newsletters
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),          // the JuiceTrends user who owns this list
  email: text("email").notNull(),
  name: text("name"),
  status: text("status").notNull().$type<SubscriberStatus>().default("active"),
  tags: text("tags").array(),
  source: text("source").default("manual"),      // e.g. "manual", "import", "form"
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
},
(t) => ({
  userEmailUnique: unique("newsletter_subscribers_user_email_key").on(t.userId, t.email),
}));

export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({
  id: true,
  subscribedAt: true,
  unsubscribedAt: true,
}).extend({
  name: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.enum(subscriberStatuses).optional(),
});
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

// Newsletter Campaigns — email campaigns composed and sent by users
export const newsletters = pgTable("newsletters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  status: text("status").notNull().$type<NewsletterStatus>().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  recipientCount: integer("recipient_count").default(0),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  tags: text("tags").array(),                    // filter subscribers by tag when sending
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNewsletterSchema = createInsertSchema(newsletters).omit({
  id: true,
  sentAt: true,
  recipientCount: true,
  openCount: true,
  clickCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  previewText: z.string().optional().nullable(),
  bodyText: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  status: z.enum(newsletterStatuses).optional(),
});
export type InsertNewsletter = z.infer<typeof insertNewsletterSchema>;
export type Newsletter = typeof newsletters.$inferSelect;
