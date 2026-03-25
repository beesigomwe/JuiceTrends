import axios from "axios";
import type { SocialAccount } from "@shared/schema";
import type { IStorage } from "./storage";

const REFRESH_WINDOW_DAYS = 7;

function isExpiringSoon(account: SocialAccount): boolean {
  if (!account.tokenExpiresAt) return false;
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + REFRESH_WINDOW_DAYS);
  return new Date(account.tokenExpiresAt) <= windowEnd;
}

export async function refreshTwitterToken(
  account: SocialAccount,
  storage: IStorage
): Promise<boolean> {
  if (!account.refreshToken) return false;
  try {
    const res = await axios.post(
      "https://api.twitter.com/2/oauth2/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
      }),
      {
        auth: {
          username: process.env.TWITTER_CLIENT_ID!,
          password: process.env.TWITTER_CLIENT_SECRET!,
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    const { access_token, refresh_token, expires_in } = res.data;
    const tokenExpiresAt =
      typeof expires_in === "number"
        ? new Date(Date.now() + expires_in * 1000)
        : null;
    await storage.updateAccount(account.id, {
      accessToken: access_token,
      refreshToken: refresh_token ?? account.refreshToken,
      tokenExpiresAt,
      isConnected: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function refreshLinkedInToken(
  account: SocialAccount,
  storage: IStorage
): Promise<boolean> {
  if (!account.refreshToken) return false;
  try {
    const res = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const { access_token, refresh_token, expires_in } = res.data;
    const tokenExpiresAt =
      typeof expires_in === "number"
        ? new Date(Date.now() + expires_in * 1000)
        : null;
    await storage.updateAccount(account.id, {
      accessToken: access_token,
      refreshToken: refresh_token ?? account.refreshToken,
      tokenExpiresAt,
      isConnected: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function refreshTikTokToken(
  account: SocialAccount,
  storage: IStorage
): Promise<boolean> {
  if (!account.refreshToken) return false;
  try {
    const res = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const data = res.data?.data;
    if (!data?.access_token) return false;
    const { access_token, refresh_token, expires_in } = data;
    const tokenExpiresAt =
      typeof expires_in === "number"
        ? new Date(Date.now() + expires_in * 1000)
        : null;
    await storage.updateAccount(account.id, {
      accessToken: access_token,
      refreshToken: refresh_token ?? account.refreshToken,
      tokenExpiresAt,
      isConnected: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function refreshThreadsToken(
  account: SocialAccount,
  storage: IStorage
): Promise<boolean> {
  if (!account.accessToken) return false;
  try {
    // Threads uses the th_refresh_token grant to refresh long-lived tokens
    const res = await axios.get(
      "https://graph.threads.net/refresh_access_token",
      {
        params: {
          grant_type: "th_refresh_token",
          access_token: account.accessToken,
        },
      }
    );
    const { access_token, expires_in } = res.data;
    const tokenExpiresAt =
      typeof expires_in === "number"
        ? new Date(Date.now() + expires_in * 1000)
        : null;
    await storage.updateAccount(account.id, {
      accessToken: access_token,
      tokenExpiresAt,
      isConnected: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function runTokenRefresh(storage: IStorage): Promise<void> {
  const accounts = await storage.getAccounts();
  for (const account of accounts) {
    if (!account.isConnected) continue;
    if (!isExpiringSoon(account)) continue;

    let ok = false;
    switch (account.platform) {
      case "twitter":
        ok = await refreshTwitterToken(account, storage);
        break;
      case "linkedin":
        ok = await refreshLinkedInToken(account, storage);
        break;
      case "tiktok":
        ok = await refreshTikTokToken(account, storage);
        break;
      case "threads":
        ok = await refreshThreadsToken(account, storage);
        break;
      case "facebook":
      case "instagram":
        // Page tokens from long-lived user token are non-expiring; no refresh needed
        continue;
      default:
        continue;
    }

    if (!ok) {
      await storage.updateAccount(account.id, { isConnected: false });
    }
  }
}
