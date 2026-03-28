import type { Express, Request, Response } from "express";
import crypto from "crypto";
import axios from "axios";
import { requireAuth } from "./auth";
import { storage } from "./storage";

const META_GRAPH_VERSION = "v21.0";

function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

function getAppUrl(): string {
  // Prefer explicitly set APP_URL / PUBLIC_URL, then fall back to the
  // Railway-injected RAILWAY_PUBLIC_DOMAIN (always present on Railway).
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "";
  return process.env.APP_URL || process.env.PUBLIC_URL || railwayDomain;
}

// ─── TWITTER / X ─────────────────────────────────────────────────────────────

export function setupTwitterOAuth(app: Express) {
  app.get("/api/auth/twitter", requireAuth, (req: Request, res: Response) => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    (req.session as unknown as Record<string, string>).codeVerifier = codeVerifier;
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.TWITTER_CLIENT_ID!,
      redirect_uri: `${getAppUrl()}/api/auth/twitter/callback`,
      scope: "tweet.read tweet.write users.read offline.access",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    res.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
  });

  app.get(
    "/api/auth/twitter/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=twitter");
        }

        const codeVerifier = (req.session as unknown as Record<string, string>).codeVerifier;
        if (!codeVerifier) {
          return res.redirect("/accounts?error=twitter");
        }
        delete (req.session as unknown as Record<string, string>).codeVerifier;

        const tokenRes = await axios.post(
          "https://api.twitter.com/2/oauth2/token",
          new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            redirect_uri: `${getAppUrl()}/api/auth/twitter/callback`,
            code_verifier: codeVerifier,
          }),
          {
            auth: {
              username: process.env.TWITTER_CLIENT_ID!,
              password: process.env.TWITTER_CLIENT_SECRET!,
            },
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const tokenExpiresAt =
          typeof expires_in === "number"
            ? new Date(Date.now() + expires_in * 1000)
            : undefined;

        const userRes = await axios.get("https://api.twitter.com/2/users/me", {
          headers: { Authorization: `Bearer ${access_token}` },
          params: {
            "user.fields": "name,username,profile_image_url,public_metrics",
          },
        });

        const twitterUser = userRes.data.data;
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=twitter");
        }

        await storage.createOrUpdateSocialAccount({
          userId,
          platform: "twitter",
          accountName: twitterUser.name,
          accountHandle: twitterUser.username,
          avatarUrl: twitterUser.profile_image_url,
          accessToken: access_token,
          platformUserId: twitterUser.id,
          refreshToken: refresh_token ?? null,
          tokenExpiresAt: tokenExpiresAt ?? null,
          isConnected: true,
          followers: twitterUser.public_metrics?.followers_count || 0,
          engagement: undefined,
        });

        res.redirect("/accounts?connected=twitter");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Twitter OAuth error:", error);
        res.redirect("/accounts?error=twitter");
      }
    },
  );
}

// ─── FACEBOOK ────────────────────────────────────────────────────────────────

export function setupFacebookOAuth(app: Express) {
  app.get("/api/auth/facebook", requireAuth, (req: Request, res: Response) => {
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: `${getAppUrl()}/api/auth/facebook/callback`,
      scope: "pages_manage_posts,pages_read_engagement,pages_show_list,ads_management,ads_read",
      state,
    });

    res.redirect(
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`,
    );
  });

  app.get(
    "/api/auth/facebook/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=facebook");
        }

        const tokenRes = await axios.get(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
          {
            params: {
              client_id: process.env.META_APP_ID,
              client_secret: process.env.META_APP_SECRET,
              redirect_uri: `${getAppUrl()}/api/auth/facebook/callback`,
              code,
            },
          },
        );

        const { access_token } = tokenRes.data;

        const pagesRes = await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`,
          {
            params: { access_token },
          },
        );

        const pages = pagesRes.data.data ?? [];
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=facebook");
        }

        if (pages.length === 0) {
          return res.redirect("/accounts?error=facebook_no_pages");
        }

        for (const page of pages) {
          let avatarUrl: string | null = null;
          let followers = 0;
          try {
            const picRes = await axios.get(
              `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}/picture`,
              {
                params: { redirect: false, access_token: page.access_token },
              },
            );
            avatarUrl = picRes.data?.data?.url ?? null;
          } catch {
            // ignore picture fetch failure
          }

          try {
            const pageRes = await axios.get(
              `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}`,
              {
                params: {
                  fields: "fan_count",
                  access_token: page.access_token,
                },
              },
            );
            followers = Number(pageRes.data?.fan_count ?? 0);
          } catch {
            // ignore follower fetch failure; will be refreshed later
          }

          // Fetch the user's ad accounts so we can store the first one
          // against this page for use by the Marketing API publisher.
          let adAccountId: string | null = null;
          try {
            const adAccountsRes = await axios.get(
              `https://graph.facebook.com/${META_GRAPH_VERSION}/me/adaccounts`,
              { params: { fields: "id,name,account_status", access_token } },
            );
            const adAccounts = adAccountsRes.data?.data ?? [];
            // Prefer the first active account (account_status === 1)
            const active = adAccounts.find((a: any) => a.account_status === 1) ?? adAccounts[0];
            if (active) {
              // The id returned is already in "act_XXXXXXX" format
              adAccountId = active.id as string;
            }
          } catch {
            // Non-fatal — user may not have an ad account yet
          }

          await storage.createOrUpdateSocialAccount({
            userId,
            platform: "facebook",
            accountName: page.name,
            accountHandle: page.id,
            avatarUrl,
            accessToken: page.access_token,
            platformUserId: page.id,
            refreshToken: null,
            isConnected: true,
            followers,
            engagement: undefined,
            adAccountId,
          });
        }

        res.redirect("/accounts?connected=facebook");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Facebook OAuth error:", error);
        res.redirect("/accounts?error=facebook");
      }
    },
  );
}

// ─── INSTAGRAM (Graph API via Facebook Login) ────────────────────────────────

export function setupInstagramOAuth(app: Express) {
  app.get("/api/auth/instagram", requireAuth, (req: Request, res: Response) => {
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: `${getAppUrl()}/api/auth/instagram/callback`,
      scope: "instagram_basic,instagram_content_publish,pages_show_list",
      response_type: "code",
      state,
    });

    res.redirect(
      `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`,
    );
  });

  app.get(
    "/api/auth/instagram/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=instagram");
        }

        const tokenRes = await axios.get(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
          {
            params: {
              client_id: process.env.META_APP_ID,
              client_secret: process.env.META_APP_SECRET,
              redirect_uri: `${getAppUrl()}/api/auth/instagram/callback`,
              code: code as string,
            },
          },
        );

        let { access_token } = tokenRes.data;

        const longLivedRes = await axios.get(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
          {
            params: {
              grant_type: "fb_exchange_token",
              client_id: process.env.META_APP_ID,
              client_secret: process.env.META_APP_SECRET,
              fb_exchange_token: access_token,
            },
          },
        );
        if (longLivedRes.data.access_token) {
          access_token = longLivedRes.data.access_token;
        }

        const pagesRes = await axios.get(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts`,
          {
            params: {
              fields: "access_token,name,instagram_business_account{id,username,profile_picture_url,followers_count}",
              access_token,
            },
          },
        );

        const pages = pagesRes.data.data ?? [];
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=instagram");
        }

        let connected = false;
        for (const page of pages) {
          const ig = page.instagram_business_account;
          if (!ig) continue;
          await storage.createOrUpdateSocialAccount({
            userId,
            platform: "instagram",
            accountName: ig.username || page.name,
            accountHandle: ig.username || ig.id,
            avatarUrl: ig.profile_picture_url ?? null,
            accessToken: page.access_token,
            platformUserId: ig.id,
            refreshToken: null,
            isConnected: true,
            followers: ig.followers_count || 0,
            engagement: undefined,
          });
          connected = true;
        }

        if (!connected) {
          return res.redirect("/accounts?error=instagram_no_account");
        }

        res.redirect("/accounts?connected=instagram");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Instagram OAuth error:", error);
        res.redirect("/accounts?error=instagram");
      }
    },
  );
}

// ─── LINKEDIN ────────────────────────────────────────────────────────────────

export function setupLinkedInOAuth(app: Express) {
  app.get("/api/auth/linkedin", requireAuth, (req: Request, res: Response) => {
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: `${getAppUrl()}/api/auth/linkedin/callback`,
      scope: "openid profile email w_member_social",
      state,
    });

    res.redirect(
      `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
    );
  });

  app.get(
    "/api/auth/linkedin/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=linkedin");
        }

        const tokenRes = await axios.post(
          "https://www.linkedin.com/oauth/v2/accessToken",
          new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            redirect_uri: `${getAppUrl()}/api/auth/linkedin/callback`,
            client_id: process.env.LINKEDIN_CLIENT_ID!,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const tokenExpiresAt =
          typeof expires_in === "number"
            ? new Date(Date.now() + expires_in * 1000)
            : undefined;

        const userRes = await axios.get(
          "https://api.linkedin.com/v2/userinfo",
          {
            headers: { Authorization: `Bearer ${access_token}` },
          },
        );

        const liUser = userRes.data;
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=linkedin");
        }

        await storage.createOrUpdateSocialAccount({
          userId,
          platform: "linkedin",
          accountName: liUser.name,
          accountHandle: liUser.sub,
          avatarUrl: liUser.picture,
          accessToken: access_token,
          platformUserId: liUser.sub,
          refreshToken: refresh_token ?? null,
          tokenExpiresAt: tokenExpiresAt ?? null,
          isConnected: true,
          followers: 0,
          engagement: undefined,
        });

        res.redirect("/accounts?connected=linkedin");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("LinkedIn OAuth error:", error);
        res.redirect("/accounts?error=linkedin");
      }
    },
  );
}

// ─── TIKTOK ──────────────────────────────────────────────────────────────────

export function setupTikTokOAuth(app: Express) {
  app.get("/api/auth/tiktok", requireAuth, (req: Request, res: Response) => {
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      response_type: "code",
      scope: "user.info.basic,user.info.profile,video.upload,video.publish",
      redirect_uri: `${getAppUrl()}/api/auth/tiktok/callback`,
      state,
    });

    res.redirect(
      `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`,
    );
  });

  app.get(
    "/api/auth/tiktok/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=tiktok");
        }

        const tokenRes = await axios.post(
          "https://open.tiktokapis.com/v2/oauth/token/",
          new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY!,
            client_secret: process.env.TIKTOK_CLIENT_SECRET!,
            code: code as string,
            grant_type: "authorization_code",
            redirect_uri: `${getAppUrl()}/api/auth/tiktok/callback`,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          },
        );

        const { access_token, refresh_token, open_id, expires_in } = tokenRes.data.data;
        const tokenExpiresAt =
          typeof expires_in === "number"
            ? new Date(Date.now() + expires_in * 1000)
            : undefined;

        const userRes = await axios.get(
          "https://open.tiktokapis.com/v2/user/info/",
          {
            headers: { Authorization: `Bearer ${access_token}` },
            params: {
              fields:
                "open_id,union_id,avatar_url,display_name,username,follower_count",
            },
          },
        );

        const tikUser = userRes.data.data.user;
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=tiktok");
        }

        const tiktokHandle = tikUser.username ?? tikUser.display_name ?? open_id;
        await storage.createOrUpdateSocialAccount({
          userId,
          platform: "tiktok",
          accountName: tikUser.display_name,
          accountHandle: tiktokHandle,
          avatarUrl: tikUser.avatar_url,
          accessToken: access_token,
          platformUserId: open_id,
          refreshToken: refresh_token ?? null,
          tokenExpiresAt: tokenExpiresAt ?? null,
          isConnected: true,
          followers: tikUser.follower_count || 0,
          engagement: undefined,
        });

        res.redirect("/accounts?connected=tiktok");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("TikTok OAuth error:", error);
        res.redirect("/accounts?error=tiktok");
      }
    },
  );
}

// ─── PINTEREST ───────────────────────────────────────────────────────────────

export function setupPinterestOAuth(app: Express) {
  app.get("/api/auth/pinterest", requireAuth, (req: Request, res: Response) => {
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      client_id: process.env.PINTEREST_APP_ID!,
      redirect_uri: `${getAppUrl()}/api/auth/pinterest/callback`,
      response_type: "code",
      scope: "user_accounts:read,boards:read,boards:write",
      state,
    });

    res.redirect(`https://www.pinterest.com/oauth/?${params.toString()}`);
  });

  app.get(
    "/api/auth/pinterest/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=pinterest");
        }

        const tokenRes = await axios.post(
          "https://api.pinterest.com/v5/oauth/token",
          new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            redirect_uri: `${getAppUrl()}/api/auth/pinterest/callback`,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(
                `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`
              ).toString("base64")}`,
            },
          },
        );

        const { access_token, refresh_token } = tokenRes.data;
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=pinterest");
        }

        const userRes = await axios.get("https://api.pinterest.com/v5/user_account", {
          headers: { Authorization: `Bearer ${access_token}` },
        });

        const profile = userRes.data;
        const username = profile.username ?? profile.business_id ?? profile.id ?? "pinterest";

        await storage.createOrUpdateSocialAccount({
          userId,
          platform: "pinterest",
          accountName: profile.username ?? profile.business_name ?? "Pinterest",
          accountHandle: username,
          avatarUrl: profile.profile_image ?? null,
          accessToken: access_token,
          platformUserId: profile.id ?? username,
          refreshToken: refresh_token ?? null,
          tokenExpiresAt: null,
          isConnected: true,
          followers: 0,
          engagement: undefined,
        });

        res.redirect("/accounts?connected=pinterest");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Pinterest OAuth error:", error);
        res.redirect("/accounts?error=pinterest");
      }
    },
  );
}

// ─── YOUTUBE (Google OAuth) ─────────────────────────────────────────────────

export function setupYouTubeOAuth(app: Express) {
  const YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
  ].join(" ");

  app.get("/api/auth/youtube", requireAuth, (req: Request, res: Response) => {
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${getAppUrl()}/api/auth/youtube/callback`,
      response_type: "code",
      scope: YOUTUBE_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get(
    "/api/auth/youtube/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=youtube");
        }

        const tokenRes = await axios.post(
          "https://oauth2.googleapis.com/token",
          new URLSearchParams({
            code: code as string,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: `${getAppUrl()}/api/auth/youtube/callback`,
            grant_type: "authorization_code",
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );

        const { access_token, refresh_token, expires_in } = tokenRes.data;
        const tokenExpiresAt =
          typeof expires_in === "number"
            ? new Date(Date.now() + expires_in * 1000)
            : null;

        const channelRes = await axios.get(
          "https://www.googleapis.com/youtube/v3/channels",
          {
            params: { part: "snippet,statistics", mine: "true" },
            headers: { Authorization: `Bearer ${access_token}` },
          },
        );

        const items = channelRes.data?.items ?? [];
        const channel = items[0];
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=youtube");
        }

        if (!channel) {
          return res.redirect("/accounts?error=youtube_no_channel");
        }

        const channelId = channel.id;
        const snippet = channel.snippet ?? {};
        const stats = channel.statistics ?? {};

        await storage.createOrUpdateSocialAccount({
          userId,
          platform: "youtube",
          accountName: snippet.title ?? "YouTube",
          accountHandle: snippet.customUrl ?? channelId,
          avatarUrl: snippet.thumbnails?.default?.url ?? null,
          accessToken: access_token,
          platformUserId: channelId,
          refreshToken: refresh_token ?? null,
          tokenExpiresAt,
          isConnected: true,
          followers: parseInt(stats.subscriberCount ?? "0", 10) || 0,
          engagement: undefined,
        });

        res.redirect("/accounts?connected=youtube");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("YouTube OAuth error:", error);
        res.redirect("/accounts?error=youtube");
      }
    },
  );
}

// ─── THREADS ─────────────────────────────────────────────────────────────────
// Threads uses its own OAuth flow via https://threads.net/oauth/authorize
// Scopes: threads_basic, threads_content_publish, threads_manage_replies
// Token exchange: https://graph.threads.net/oauth/access_token
// Long-lived tokens (60 days): GET /access_token?grant_type=th_exchange_token

export function setupThreadsOAuth(app: Express) {
  app.get("/api/auth/threads", requireAuth, (req: Request, res: Response) => {
    const state = crypto.randomBytes(24).toString("base64url");
    (req.session as unknown as Record<string, string>).oauthState = state;

    const params = new URLSearchParams({
      client_id: process.env.THREADS_APP_ID!,
      redirect_uri: `${getAppUrl()}/api/auth/threads/callback`,
      scope: "threads_basic,threads_content_publish,threads_manage_replies",
      response_type: "code",
      state,
    });

    res.redirect(`https://threads.net/oauth/authorize?${params.toString()}`);
  });

  app.get(
    "/api/auth/threads/callback",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { code, state } = req.query;
        const sessionState = (req.session as unknown as Record<string, string>).oauthState;
        if (!state || state !== sessionState) {
          return res.redirect("/accounts?error=invalid_state");
        }
        delete (req.session as unknown as Record<string, string>).oauthState;

        if (!code) {
          return res.redirect("/accounts?error=threads");
        }

        // Step 1: exchange code for short-lived token
        const tokenRes = await axios.post(
          "https://graph.threads.net/oauth/access_token",
          new URLSearchParams({
            client_id: process.env.THREADS_APP_ID!,
            client_secret: process.env.THREADS_APP_SECRET!,
            grant_type: "authorization_code",
            redirect_uri: `${getAppUrl()}/api/auth/threads/callback`,
            code: code as string,
          }),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
        );

        const { access_token: shortLivedToken, user_id: threadsUserId } = tokenRes.data;

        // Step 2: exchange for long-lived token (60 days)
        const longLivedRes = await axios.get(
          "https://graph.threads.net/access_token",
          {
            params: {
              grant_type: "th_exchange_token",
              client_secret: process.env.THREADS_APP_SECRET,
              access_token: shortLivedToken,
            },
          },
        );

        const {
          access_token: longLivedToken,
          expires_in,
        } = longLivedRes.data;

        const tokenExpiresAt =
          typeof expires_in === "number"
            ? new Date(Date.now() + expires_in * 1000)
            : null;

        // Step 3: fetch user profile
        const profileRes = await axios.get(
          `https://graph.threads.net/v1.0/${threadsUserId}`,
          {
            params: {
              fields: "id,username,name,threads_profile_picture_url,threads_biography,followers_count",
              access_token: longLivedToken,
            },
          },
        );

        const profile = profileRes.data;
        const userId = (req.user as any)?.id as string | undefined;

        if (!userId) {
          return res.redirect("/accounts?error=threads");
        }

        await storage.createOrUpdateSocialAccount({
          userId,
          platform: "threads",
          accountName: profile.name ?? profile.username ?? "Threads User",
          accountHandle: profile.username ?? threadsUserId,
          avatarUrl: profile.threads_profile_picture_url ?? null,
          accessToken: longLivedToken,
          platformUserId: String(threadsUserId),
          refreshToken: null,
          tokenExpiresAt,
          isConnected: true,
          followers: profile.followers_count ?? 0,
          engagement: undefined,
        });

        res.redirect("/accounts?connected=threads");
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Threads OAuth error:", error);
        res.redirect("/accounts?error=threads");
      }
    },
  );
}
