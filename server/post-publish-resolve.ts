import type { Post, SocialAccount, PlatformType } from "@shared/schema";

/**
 * Picks the social account used to publish to `platform` for this post.
 * When `post.targetAccountIds` is set, uses the id in that list matching the platform;
 * otherwise the first connected account for that platform (legacy).
 */
export function resolveAccountForPlatform(
  post: Post,
  platform: PlatformType,
  userAccounts: SocialAccount[],
): SocialAccount | undefined {
  const targets = post.targetAccountIds;
  if (targets?.length) {
    const idSet = new Set(targets);
    return userAccounts.find(
      (a) => idSet.has(a.id) && a.platform === platform && a.isConnected,
    );
  }
  return userAccounts.find((a) => a.platform === platform && a.isConnected);
}
