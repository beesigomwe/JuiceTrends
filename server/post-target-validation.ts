import type { PlatformType } from "@shared/schema";
import type { IStorage } from "./storage";

/**
 * When targetAccountIds is non-empty, ensures each id is the user's connected account,
 * there is exactly one account per selected platform, and optional brand membership.
 */
export async function validatePostTargetAccounts(
  storage: IStorage,
  userId: string,
  platforms: PlatformType[],
  targetAccountIds: string[] | null | undefined,
  brandId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!targetAccountIds?.length) {
    return { ok: true };
  }

  const uniqPlatforms = new Set(platforms);
  if (uniqPlatforms.size !== platforms.length) {
    return { ok: false, error: "Duplicate platforms are not allowed" };
  }

  if (targetAccountIds.length !== platforms.length) {
    return { ok: false, error: "targetAccountIds must include exactly one id per selected platform" };
  }

  const userAccounts = await storage.getAccounts(userId);
  const byId = new Map(userAccounts.map((a) => [a.id, a]));

  const selected = [];
  for (const id of targetAccountIds) {
    const acc = byId.get(id);
    if (!acc) {
      return { ok: false, error: "One or more target account ids are invalid" };
    }
    if (!acc.isConnected) {
      return { ok: false, error: `Account "${acc.accountName}" is not connected` };
    }
    selected.push(acc);
  }

  const countByPlatform = new Map<PlatformType, number>();
  for (const a of selected) {
    countByPlatform.set(a.platform, (countByPlatform.get(a.platform) ?? 0) + 1);
  }

  for (const p of platforms) {
    if (countByPlatform.get(p) !== 1) {
      return { ok: false, error: `Exactly one target account required for ${p}` };
    }
  }

  const selectedPlatforms = new Set(selected.map((a) => a.platform));
  if (selectedPlatforms.size !== uniqPlatforms.size || !Array.from(uniqPlatforms).every((p) => selectedPlatforms.has(p))) {
    return { ok: false, error: "Target accounts must match selected platforms" };
  }

  if (brandId) {
    const brand = await storage.getBrand(brandId);
    if (!brand || brand.userId !== userId) {
      return { ok: false, error: "Invalid brand" };
    }
    const allowed = new Set(brand.accounts.map((a) => a.id));
    for (const id of targetAccountIds) {
      if (!allowed.has(id)) {
        return { ok: false, error: "Every target account must belong to the selected brand" };
      }
    }
  }

  return { ok: true };
}
