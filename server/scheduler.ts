/**
 * scheduler.ts
 *
 * Background job that runs every 60 seconds and publishes any posts whose
 * scheduledAt timestamp has passed and whose status is still "scheduled".
 *
 * For each due post it:
 *  1. Looks up the user's connected accounts for each platform in the post.
 *  2. Calls the publisher for each platform.
 *  3. Stores per-platform results in posts.publishResults.
 *  4. Sets overall status:
 *       - "published"  if at least one platform succeeded
 *       - "failed"     if every platform failed
 *  5. Sets publishedAt to now when at least one platform succeeded.
 *
 * Wire into server/index.ts alongside runTokenRefresh.
 */

import type { IStorage } from "./storage";
import { publishPostToPlatform, type PublishResult } from "./publisher";
import { resolveAccountForPlatform } from "./post-publish-resolve";
import type { PlatformType } from "@shared/schema";

export async function runScheduler(storage: IStorage): Promise<void> {
  const now = new Date();

  // Fetch all posts across all users (no userId filter)
  const allPosts = await storage.getPosts();

  const duePosts = allPosts.filter(
    (p) =>
      p.status === "scheduled" &&
      p.scheduledAt != null &&
      new Date(p.scheduledAt) <= now
  );

  if (duePosts.length === 0) return;

  for (const post of duePosts) {
    const results: Record<string, PublishResult> = {};
    const platforms = (post.platforms ?? []) as PlatformType[];

    // Fetch connected accounts for the post's user
    const userAccounts = await storage.getAccounts(post.userId);

    for (const platform of platforms) {
      const account = resolveAccountForPlatform(post, platform, userAccounts);

      if (!account) {
        results[platform] = {
          success: false,
          error: post.targetAccountIds?.length
            ? `No matching connected ${platform} account in this post's targets.`
            : `No connected ${platform} account found for this user.`,
        };
        continue;
      }

      const result = await publishPostToPlatform(post, account);
      results[platform] = result;
    }

    const anySuccess = Object.values(results).some((r) => r.success);
    const allFailed = Object.values(results).every((r) => !r.success);

    await storage.updatePost(post.id, {
      status: allFailed ? "failed" : "published",
      // publishedAt and publishResults are not part of InsertPost, so we cast
      ...(anySuccess ? { publishedAt: now } : {}),
      publishResults: results,
    } as any);
  }
}

/**
 * Start the scheduler interval.  Call once from server/index.ts after the
 * HTTP server is listening.
 *
 * @param storage  The storage implementation to use.
 * @param intervalMs  How often to check for due posts (default: 60 seconds).
 * @returns  The interval handle so callers can clear it if needed.
 */
export function startScheduler(
  storage: IStorage,
  intervalMs = 60_000
): ReturnType<typeof setInterval> {
  // Run once immediately on startup, then on the interval
  runScheduler(storage).catch((err: Error) => {
    console.error(`[scheduler] Initial run failed: ${err.message}`);
  });

  return setInterval(() => {
    runScheduler(storage).catch((err: Error) => {
      console.error(`[scheduler] Run failed: ${err.message}`);
    });
  }, intervalMs);
}
