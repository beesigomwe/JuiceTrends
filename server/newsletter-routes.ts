import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import {
  insertNewsletterSubscriberSchema,
  insertNewsletterSchema,
} from "@shared/schema";
import { z } from "zod";

export function setupNewsletterRoutes(app: Express) {
  // ─── Subscribers ────────────────────────────────────────────────────────────

  // List all subscribers for the authenticated user
  app.get("/api/newsletter/subscribers", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const subscribers = await storage.getNewsletterSubscribers(userId);
      res.json(subscribers);
    } catch (err) {
      console.error("[newsletter] GET /api/newsletter/subscribers error:", err);
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });

  // Add a subscriber
  app.post("/api/newsletter/subscribers", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const parsed = insertNewsletterSubscriberSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid subscriber data", details: parsed.error.errors });
      }
      const subscriber = await storage.createNewsletterSubscriber(parsed.data);
      res.status(201).json(subscriber);
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(409).json({ error: "This email is already subscribed" });
      }
      console.error("[newsletter] POST /api/newsletter/subscribers error:", err);
      res.status(500).json({ error: "Failed to add subscriber" });
    }
  });

  // Update a subscriber (e.g. change status, name, tags)
  app.patch("/api/newsletter/subscribers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const existing = await storage.getNewsletterSubscriber(req.params.id, userId);
      if (!existing) return res.status(404).json({ error: "Subscriber not found" });
      const partial = insertNewsletterSubscriberSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ error: "Invalid data", details: partial.error.errors });
      }
      const updated = await storage.updateNewsletterSubscriber(req.params.id, userId, partial.data);
      res.json(updated);
    } catch (err) {
      console.error("[newsletter] PATCH /api/newsletter/subscribers/:id error:", err);
      res.status(500).json({ error: "Failed to update subscriber" });
    }
  });

  // Delete a subscriber
  app.delete("/api/newsletter/subscribers/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const existing = await storage.getNewsletterSubscriber(req.params.id, userId);
      if (!existing) return res.status(404).json({ error: "Subscriber not found" });
      await storage.deleteNewsletterSubscriber(req.params.id, userId);
      res.status(204).send();
    } catch (err) {
      console.error("[newsletter] DELETE /api/newsletter/subscribers/:id error:", err);
      res.status(500).json({ error: "Failed to delete subscriber" });
    }
  });

  // Bulk import subscribers via CSV-style JSON array
  app.post("/api/newsletter/subscribers/import", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const bodySchema = z.object({
        subscribers: z.array(z.object({
          email: z.string().email(),
          name: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })).min(1),
      });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid import data", details: parsed.error.errors });
      }
      const results = await storage.bulkImportNewsletterSubscribers(
        userId,
        parsed.data.subscribers.map((s) => ({ ...s, userId, source: "import" })),
      );
      res.status(201).json({ imported: results.imported, skipped: results.skipped });
    } catch (err) {
      console.error("[newsletter] POST /api/newsletter/subscribers/import error:", err);
      res.status(500).json({ error: "Failed to import subscribers" });
    }
  });

  // ─── Campaigns ──────────────────────────────────────────────────────────────

  // List all newsletters/campaigns
  app.get("/api/newsletter/campaigns", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const campaigns = await storage.getNewsletters(userId);
      res.json(campaigns);
    } catch (err) {
      console.error("[newsletter] GET /api/newsletter/campaigns error:", err);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Get a single campaign
  app.get("/api/newsletter/campaigns/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const campaign = await storage.getNewsletter(req.params.id, userId);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      res.json(campaign);
    } catch (err) {
      console.error("[newsletter] GET /api/newsletter/campaigns/:id error:", err);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  // Create a newsletter campaign (draft)
  app.post("/api/newsletter/campaigns", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const parsed = insertNewsletterSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid campaign data", details: parsed.error.errors });
      }
      const campaign = await storage.createNewsletter(parsed.data);
      res.status(201).json(campaign);
    } catch (err) {
      console.error("[newsletter] POST /api/newsletter/campaigns error:", err);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  // Update a campaign
  app.patch("/api/newsletter/campaigns/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const existing = await storage.getNewsletter(req.params.id, userId);
      if (!existing) return res.status(404).json({ error: "Campaign not found" });
      if (existing.status === "sent") {
        return res.status(400).json({ error: "Cannot edit a campaign that has already been sent" });
      }
      const partial = insertNewsletterSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ error: "Invalid data", details: partial.error.errors });
      }
      const updated = await storage.updateNewsletter(req.params.id, userId, partial.data);
      res.json(updated);
    } catch (err) {
      console.error("[newsletter] PATCH /api/newsletter/campaigns/:id error:", err);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  // Delete a campaign
  app.delete("/api/newsletter/campaigns/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const existing = await storage.getNewsletter(req.params.id, userId);
      if (!existing) return res.status(404).json({ error: "Campaign not found" });
      await storage.deleteNewsletter(req.params.id, userId);
      res.status(204).send();
    } catch (err) {
      console.error("[newsletter] DELETE /api/newsletter/campaigns/:id error:", err);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // "Send" a campaign — marks it as sent and records recipient count
  app.post("/api/newsletter/campaigns/:id/send", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const existing = await storage.getNewsletter(req.params.id, userId);
      if (!existing) return res.status(404).json({ error: "Campaign not found" });
      if (existing.status === "sent") {
        return res.status(400).json({ error: "Campaign has already been sent" });
      }
      // Count active subscribers (optionally filtered by campaign tags)
      const allSubscribers = await storage.getNewsletterSubscribers(userId);
      const active = allSubscribers.filter((s) => s.status === "active");
      const recipientCount = active.length;
      const sent = await storage.sendNewsletter(req.params.id, userId, recipientCount);
      res.json(sent);
    } catch (err) {
      console.error("[newsletter] POST /api/newsletter/campaigns/:id/send error:", err);
      res.status(500).json({ error: "Failed to send campaign" });
    }
  });

  // Newsletter stats summary
  app.get("/api/newsletter/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const [subscribers, campaigns] = await Promise.all([
        storage.getNewsletterSubscribers(userId),
        storage.getNewsletters(userId),
      ]);
      const active = subscribers.filter((s) => s.status === "active").length;
      const unsubscribed = subscribers.filter((s) => s.status === "unsubscribed").length;
      const sent = campaigns.filter((c) => c.status === "sent");
      const totalSent = sent.length;
      const totalRecipients = sent.reduce((sum, c) => sum + (c.recipientCount ?? 0), 0);
      const totalOpens = sent.reduce((sum, c) => sum + (c.openCount ?? 0), 0);
      const avgOpenRate = totalRecipients > 0
        ? ((totalOpens / totalRecipients) * 100).toFixed(1)
        : "0.0";
      res.json({
        totalSubscribers: subscribers.length,
        activeSubscribers: active,
        unsubscribedCount: unsubscribed,
        totalCampaignsSent: totalSent,
        avgOpenRate,
      });
    } catch (err) {
      console.error("[newsletter] GET /api/newsletter/stats error:", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });
}
