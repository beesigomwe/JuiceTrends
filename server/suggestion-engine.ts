/**
 * suggestion-engine.ts
 *
 * The core AI-powered Post Suggestion Engine for JuiceTrends.
 *
 * Inspired by PocketTheatre's persona + thread continuation patterns, this engine:
 *   1. Analyses the user's last 30 published posts (content, platforms, engagement, timing)
 *   2. Identifies "hot threads" — posts with above-average engagement that warrant follow-up
 *   3. Computes best-time windows per platform from the user's own posting history
 *   4. Uses a persona-style system prompt to generate:
 *        a. Brand-new post ideas based on top-performing topics
 *        b. Follow-up thread continuations for hot posts
 *        c. Comment/reply suggestions for high-engagement posts
 *   5. Persists the suggestions to the suggested_posts table
 *   6. Returns the full run result including best-time windows
 */

import OpenAI from "openai";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";
import type {
  Post,
  SocialAccount,
  SuggestedPost,
  InsertSuggestedPost,
  BestTimeWindow,
  SuggestionRunResult,
  PlatformType,
} from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  twitter: 280,
  threads: 500,
  pinterest: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
  youtube: 5000,
};

// Minimum engagement to be considered a "hot thread" worthy of follow-up
const HOT_THREAD_MIN_ENGAGEMENT = 5;

// How many posts to analyse
const MAX_POSTS_TO_ANALYSE = 30;

// How many suggestions to generate per run
const TARGET_NEW_POSTS = 4;
const TARGET_FOLLOW_UPS = 3;
const TARGET_COMMENT_REPLIES = 2;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PostSummary {
  id: string;
  content: string;
  platforms: string[];
  publishedAt: string | null;
  engagement: number;
  reach: number;
  hashtags: string[];
  dayOfWeek: number | null;   // 0 = Sunday
  hour: number | null;         // 0-23 UTC
}

interface LlmSuggestion {
  type: "new_post" | "follow_up" | "comment_reply";
  sourcePostId?: string;
  content: string;
  platforms: string[];
  hashtags: string[];
  reasoning: string;
  suggestedTime: string;
  suggestedDayOfWeek: number;
  suggestedHour: number;
  confidenceScore: number;
  engagementPrediction: string;
}

interface LlmRunResponse {
  suggestions: LlmSuggestion[];
  bestTimes: Array<{
    platform: string;
    dayOfWeek: number;
    hour: number;
    label: string;
    avgEngagement: number;
    sampleSize: number;
  }>;
}

// ─── Helper: summarise posts for the prompt ───────────────────────────────────

function summarisePosts(posts: Post[]): PostSummary[] {
  return posts.map((p) => {
    const publishedAt = p.publishedAt ? new Date(p.publishedAt) : null;
    return {
      id: p.id,
      content: p.content.slice(0, 300), // truncate for token efficiency
      platforms: p.platforms as string[],
      publishedAt: publishedAt ? publishedAt.toISOString() : null,
      engagement: p.engagement ?? 0,
      reach: p.reach ?? 0,
      hashtags: p.hashtags ?? [],
      dayOfWeek: publishedAt ? publishedAt.getDay() : null,
      hour: publishedAt ? publishedAt.getUTCHours() : null,
    };
  });
}

// ─── Helper: compute best-time windows from post history ─────────────────────

function computeBestTimes(posts: PostSummary[]): BestTimeWindow[] {
  // Group posts by platform → day-of-week → hour bucket
  const buckets: Record<string, Record<string, { totalEngagement: number; count: number }>> = {};

  for (const post of posts) {
    if (post.dayOfWeek === null || post.hour === null) continue;
    const hourBucket = Math.floor(post.hour / 2) * 2; // 2-hour buckets
    const key = `${post.dayOfWeek}:${hourBucket}`;

    for (const platform of post.platforms) {
      if (!buckets[platform]) buckets[platform] = {};
      if (!buckets[platform][key]) buckets[platform][key] = { totalEngagement: 0, count: 0 };
      buckets[platform][key].totalEngagement += post.engagement;
      buckets[platform][key].count += 1;
    }
  }

  const windows: BestTimeWindow[] = [];

  for (const [platform, dayHourMap] of Object.entries(buckets)) {
    // Find the best bucket for this platform
    let bestKey = "";
    let bestAvg = -1;

    for (const [key, stats] of Object.entries(dayHourMap)) {
      const avg = stats.count > 0 ? stats.totalEngagement / stats.count : 0;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestKey = key;
      }
    }

    if (!bestKey) continue;

    const [dayStr, hourStr] = bestKey.split(":");
    const dayOfWeek = parseInt(dayStr, 10);
    const hour = parseInt(hourStr, 10);
    const stats = dayHourMap[bestKey];

    const ampm = hour < 12 ? "AM" : "PM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const label = `${DAY_NAMES[dayOfWeek]} ${displayHour}:00 ${ampm}`;

    windows.push({
      platform: platform as any as PlatformType,
      dayOfWeek,
      hour,
      label,
      avgEngagement: Math.round(bestAvg * 10) / 10,
      sampleSize: stats.count,
    });
  }

  return windows;
}

// ─── System prompt (PocketTheatre-style persona) ──────────────────────────────

function buildSystemPrompt(accounts: SocialAccount[]): string {
  const platformList = Array.from(new Set(accounts.map((a) => a.platform))).join(", ");
  const totalFollowers = accounts.reduce((sum, a) => sum + (a.followers ?? 0), 0);

  return `You are an expert social media strategist and content continuation engine for a creator with ${totalFollowers.toLocaleString()} total followers across: ${platformList || "multiple platforms"}.

Your role is to:
1. Analyse their recent post history and identify what content resonates most with their audience.
2. Generate fresh post ideas that build on their best-performing topics and voice.
3. Identify "hot threads" — posts with high engagement — and write compelling follow-up continuations that deepen the conversation.
4. Suggest comment/reply starters that the creator can use to re-engage with their audience on high-performing posts.
5. Recommend the best times to post based on when their content historically performs best.

Tone guidelines:
- Match the creator's existing voice and style as closely as possible from their post history.
- Follow-up posts should feel like a natural continuation of the original thread, not a repeat.
- Comment replies should be warm, conversational, and invite further engagement.
- New post ideas should be topically adjacent to what already works — not random.

Output rules:
- Return ONLY valid JSON. No markdown fences, no commentary before or after.
- Every suggestion must have a clear, specific reasoning that references the source post or pattern.
- Confidence scores: 85-95 for follow-ups on hot threads, 65-80 for new post ideas, 70-85 for comment replies.
- Engagement predictions: "High" (>100 expected engagements), "Medium" (20-100), "Low" (<20).`;
}

// ─── User prompt ──────────────────────────────────────────────────────────────

function buildUserPrompt(
  summaries: PostSummary[],
  hotThreads: PostSummary[],
  bestTimes: BestTimeWindow[],
  connectedPlatforms: string[],
): string {
  const topPosts = [...summaries]
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 10);

  const recentPosts = summaries.slice(0, 5);

  const hotThreadsSection = hotThreads.length > 0
    ? `\nHOT THREADS (high engagement — prime for follow-up):\n${hotThreads.map((p, i) =>
        `${i + 1}. [ID: ${p.id}] "${p.content}" — ${p.engagement} engagements on ${p.platforms.join(", ")} (posted ${p.publishedAt ?? "recently"})`
      ).join("\n")}`
    : "\nNo hot threads identified yet (not enough post history).";

  const bestTimesSection = bestTimes.length > 0
    ? `\nBEST POSTING TIMES (from historical performance):\n${bestTimes.map((t) =>
        `- ${t.platform}: ${t.label} (avg ${t.avgEngagement} engagements, ${t.sampleSize} posts sampled)`
      ).join("\n")}`
    : "\nNo best-time data yet — suggest general best practices per platform.";

  const platformCharLimits = connectedPlatforms
    .map((p) => `${p}: ${PLATFORM_CHAR_LIMITS[p] ?? 2200} chars`)
    .join(", ");

  return `Analyse this creator's post history and generate suggestions.

RECENT POSTS (last 5, most recent first):
${recentPosts.map((p, i) =>
  `${i + 1}. "${p.content}" — ${p.engagement} engagements on ${p.platforms.join(", ")}`
).join("\n")}

TOP PERFORMING POSTS (by engagement):
${topPosts.map((p, i) =>
  `${i + 1}. [ID: ${p.id}] "${p.content}" — ${p.engagement} engagements, ${p.reach} reach on ${p.platforms.join(", ")}`
).join("\n")}
${hotThreadsSection}
${bestTimesSection}

CONNECTED PLATFORMS: ${connectedPlatforms.join(", ") || "general"}
CHARACTER LIMITS: ${platformCharLimits}

Generate exactly ${TARGET_NEW_POSTS} new post ideas, ${TARGET_FOLLOW_UPS} follow-up thread continuations (use sourcePostId from hot threads), and ${TARGET_COMMENT_REPLIES} comment/reply suggestions.

Return a JSON object with this exact shape:
{
  "suggestions": [
    {
      "type": "new_post" | "follow_up" | "comment_reply",
      "sourcePostId": "<post id or null>",
      "content": "<the full post content>",
      "platforms": ["<platform>", ...],
      "hashtags": ["<tag without #>", ...],
      "reasoning": "<why this suggestion, referencing specific post patterns>",
      "suggestedTime": "<e.g. Tuesday 10:00 AM>",
      "suggestedDayOfWeek": <0-6>,
      "suggestedHour": <0-23>,
      "confidenceScore": <0-100>,
      "engagementPrediction": "High" | "Medium" | "Low"
    }
  ],
  "bestTimes": [
    {
      "platform": "<platform>",
      "dayOfWeek": <0-6>,
      "hour": <0-23>,
      "label": "<e.g. Tuesday 10:00 AM>",
      "avgEngagement": <number>,
      "sampleSize": <number>
    }
  ]
}

Important:
- follow_up suggestions MUST set sourcePostId to the ID of the post they continue.
- comment_reply suggestions should be short (1-3 sentences), engaging, and invite a response.
- new_post content should be under 280 characters unless the platform supports more.
- Do NOT repeat content from the existing posts verbatim.`;
}

// ─── Main engine function ─────────────────────────────────────────────────────

export async function runSuggestionEngine(
  userId: string,
  storage: IStorage,
): Promise<SuggestionRunResult> {
  const client = new OpenAI();

  // 1. Fetch the user's published posts (most recent first)
  const allPosts = await storage.getPosts(userId);
  const publishedPosts = allPosts
    .filter((p) => p.status === "published")
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, MAX_POSTS_TO_ANALYSE);

  // 2. Fetch connected accounts for platform context
  const accounts = await storage.getAccounts(userId);
  const connectedPlatforms = Array.from(new Set(accounts.map((a) => a.platform)));

  // 3. Summarise posts for the prompt
  const summaries = summarisePosts(publishedPosts);

  // 4. Compute best-time windows from history
  const computedBestTimes = computeBestTimes(summaries);

  // 5. Identify hot threads
  const avgEngagement =
    summaries.length > 0
      ? summaries.reduce((s, p) => s + p.engagement, 0) / summaries.length
      : 0;
  const hotThreads = summaries.filter(
    (p) => p.engagement >= Math.max(HOT_THREAD_MIN_ENGAGEMENT, avgEngagement * 1.5)
  ).slice(0, 5);

  // 6. Build prompts and call the LLM
  const systemPrompt = buildSystemPrompt(accounts);
  const userPrompt = buildUserPrompt(summaries, hotThreads, computedBestTimes, connectedPlatforms);

  let llmResponse: LlmRunResponse;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    llmResponse = JSON.parse(cleaned) as LlmRunResponse;
  } catch (err) {
    console.error("[suggestion-engine] LLM call failed:", err);
    // Return empty suggestions with computed best times
    llmResponse = { suggestions: [], bestTimes: [] };
  }

  // 7. Merge computed best times with any LLM-provided ones (prefer computed)
  const finalBestTimes: BestTimeWindow[] =
    computedBestTimes.length > 0
      ? computedBestTimes
      : (llmResponse.bestTimes ?? []).map((t) => ({
          platform: t.platform as PlatformType,
          dayOfWeek: t.dayOfWeek,
          hour: t.hour,
          label: t.label,
          avgEngagement: t.avgEngagement,
          sampleSize: t.sampleSize,
        }));

  // 8. Delete old pending suggestions for this user (keep accepted/scheduled/dismissed)
  await storage.deletePendingSuggestions(userId);

  // 9. Persist the new suggestions
  const savedSuggestions: SuggestedPost[] = [];

  for (const s of llmResponse.suggestions ?? []) {
    // Validate platforms
    const validPlatforms = (s.platforms ?? []).filter(
      (p) => (connectedPlatforms as string[]).includes(p) || connectedPlatforms.length === 0
    ) as PlatformType[];

    const insert: InsertSuggestedPost = {
      userId,
      type: (["new_post", "follow_up", "comment_reply"].includes(s.type) ? s.type : "new_post") as any,
      sourcePostId: s.sourcePostId ?? null,
      content: s.content ?? "",
      platforms: validPlatforms.length > 0 ? validPlatforms : (connectedPlatforms as PlatformType[]),
      hashtags: s.hashtags ?? [],
      reasoning: s.reasoning ?? null,
      suggestedTime: s.suggestedTime ?? null,
      suggestedDayOfWeek: typeof s.suggestedDayOfWeek === "number" ? s.suggestedDayOfWeek : null,
      suggestedHour: typeof s.suggestedHour === "number" ? s.suggestedHour : null,
      confidenceScore: typeof s.confidenceScore === "number" ? Math.min(100, Math.max(0, s.confidenceScore)) : 70,
      engagementPrediction: s.engagementPrediction ?? null,
      status: "pending",
      scheduledPostId: null,
    };

    try {
      const saved = await storage.createSuggestedPost(insert);
      savedSuggestions.push(saved);
    } catch (err) {
      console.error("[suggestion-engine] Failed to save suggestion:", err);
    }
  }

  return {
    suggestions: savedSuggestions,
    bestTimes: finalBestTimes,
    analysedPosts: publishedPosts.length,
    generatedAt: new Date().toISOString(),
  };
}
