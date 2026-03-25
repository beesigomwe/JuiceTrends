import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, insertSocialAccountSchema, type PlatformType } from "@shared/schema";
import { hashPassword, requireAuth, setupAuth } from "./auth";
import { fetchAccountStats } from "./account-stats";
import { publishPostToPlatform, type PublishResult } from "./publisher";
import { setupMediaUpload } from "./media-upload";
import { setupAiGenerate } from "./ai-generate";
import { setupBrandsRoutes } from "./brands-routes";
import { setupSuggestionsRoutes } from "./suggestions-routes";
import passport from "passport";
import {
  setupFacebookOAuth,
  setupInstagramOAuth,
  setupLinkedInOAuth,
  setupPinterestOAuth,
  setupTikTokOAuth,
  setupTwitterOAuth,
  setupYouTubeOAuth,
  setupThreadsOAuth,
} from "./oauth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  setupAuth(app);
  setupMediaUpload(app);
  setupAiGenerate(app);
  setupBrandsRoutes(app);
  setupSuggestionsRoutes(app);

  // Health check endpoint for Railway
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Social platform OAuth flows
  setupTwitterOAuth(app);
  setupFacebookOAuth(app);
  setupInstagramOAuth(app);
  setupLinkedInOAuth(app);
  setupTikTokOAuth(app);
  setupPinterestOAuth(app);
  setupYouTubeOAuth(app);
  setupThreadsOAuth(app);

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password } = req.body as {
        name?: string;
        email?: string;
        password?: string;
      };

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const hashed = await hashPassword(password);
      const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

      const user = await storage.createUser({
        name,
        email,
        username,
        password: hashed,
        avatar: null,
      });

      const { password: _password, ...safeUser } = user;

      req.login(safeUser as any, (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed after signup" });
        }
        return res.status(201).json(safeUser);
      });
    } catch (error) {
      return res.status(500).json({ error: "Signup failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      return res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.json(req.user);
    }
    return res.status(401).json({ error: "Not authenticated" });
  });

  app.get("/api/dashboard/stats", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/chart", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const chartData = await storage.getChartData(userId);
      res.json(chartData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chart data" });
    }
  });

  app.get("/api/posts", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const posts = await storage.getPosts(userId);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.get("/api/posts/recent", requireAuth, async (req: Request, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const userId = (req.user as any)?.id as string | undefined;
      const posts = await storage.getRecentPosts(userId, limit);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent posts" });
    }
  });

  app.get("/api/posts/:id", requireAuth, async (req: Request, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch post" });
    }
  });

  app.post("/api/posts", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const validatedData = insertPostSchema.parse({
        ...req.body,
        userId,
      });
      const post = await storage.createPost(validatedData);
      res.status(201).json(post);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid post data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.patch("/api/posts/:id", requireAuth, async (req: Request, res) => {
    try {
      const existingPost = await storage.getPost(req.params.id);
      if (!existingPost) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      const partialSchema = insertPostSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      const post = await storage.updatePost(req.params.id, validatedData as any);
      res.json(post);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid post data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update post" });
    }
  });

  app.delete("/api/posts/:id", requireAuth, async (req: Request, res) => {
    try {
      const deleted = await storage.deletePost(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Post not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  app.get("/api/accounts", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const accounts = await storage.getAccounts(userId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/:id", requireAuth, async (req: Request, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account" });
    }
  });

  app.post("/api/accounts", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const validatedData = insertSocialAccountSchema.parse({
        ...req.body,
        userId,
      });
      const account = await storage.createAccount(validatedData);
      res.status(201).json(account);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid account data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.post("/api/accounts/:id/refresh", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const account = await storage.getAccount(req.params.id);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }
      if (account.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      try {
        const { followers, engagement } = await fetchAccountStats(account);
        const updated = await storage.updateAccount(req.params.id, {
          followers,
          engagement,
          isConnected: true,
        });
        return res.json(updated);
      } catch {
        await storage.updateAccount(req.params.id, { isConnected: false });
        return res.status(502).json({
          error: "Failed to fetch account stats; connection may be revoked.",
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh account" });
    }
  });

  app.delete("/api/accounts/:id", requireAuth, async (req: Request, res) => {
    try {
      const deleted = await storage.deleteAccount(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // §1.4 — Publish Now: immediately publish a draft or scheduled post
  app.post("/api/posts/:id/publish", requireAuth, async (req: Request, res) => {
    try {
      const userId = (req.user as any)?.id as string | undefined;
      const post = await storage.getPost(req.params.id);
      if (!post) return res.status(404).json({ error: "Post not found" });
      if (post.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      if (post.status === "published") {
        return res.status(409).json({ error: "Post is already published" });
      }

      const userAccounts = await storage.getAccounts(userId);
      const platforms = (post.platforms ?? []) as PlatformType[];
      const results: Record<string, PublishResult> = {};

      for (const platform of platforms) {
        const account = userAccounts.find(
          (a) => a.platform === platform && a.isConnected
        );
        if (!account) {
          results[platform] = {
            success: false,
            error: `No connected ${platform} account found.`,
          };
          continue;
        }
        results[platform] = await publishPostToPlatform(post, account);
      }

      const anySuccess = Object.values(results).some((r) => r.success);
      const allFailed = Object.values(results).every((r) => !r.success);
      const now = new Date();

      const updated = await storage.updatePost(post.id, {
        status: allFailed ? "failed" : "published",
        ...(anySuccess ? { publishedAt: now } : {}),
        publishResults: results,
      } as any);

      return res.json({ post: updated, results });
    } catch (error) {
      res.status(500).json({ error: "Failed to publish post" });
    }
  });

  return httpServer;
}
