/**
 * Ad Management Routes
 * Provides full CRUD for ad campaigns, ad sets, ad creatives, and metrics.
 *
 * Routes:
 *   GET    /api/ads/campaigns                          - list all campaigns
 *   POST   /api/ads/campaigns                          - create campaign
 *   GET    /api/ads/campaigns/:id                      - get single campaign with sets + creatives
 *   PATCH  /api/ads/campaigns/:id                      - update campaign
 *   DELETE /api/ads/campaigns/:id                      - delete campaign (cascades)
 *   PATCH  /api/ads/campaigns/:id/status               - change status (active/paused/archived)
 *
 *   GET    /api/ads/campaigns/:campaignId/sets         - list ad sets
 *   POST   /api/ads/campaigns/:campaignId/sets         - create ad set
 *   GET    /api/ads/campaigns/:campaignId/sets/:id     - get ad set
 *   PATCH  /api/ads/campaigns/:campaignId/sets/:id     - update ad set
 *   DELETE /api/ads/campaigns/:campaignId/sets/:id     - delete ad set
 *
 *   GET    /api/ads/sets/:adSetId/creatives            - list creatives for an ad set
 *   POST   /api/ads/sets/:adSetId/creatives            - create creative
 *   PATCH  /api/ads/sets/:adSetId/creatives/:id        - update creative
 *   DELETE /api/ads/sets/:adSetId/creatives/:id        - delete creative
 *
 *   GET    /api/ads/campaigns/:campaignId/metrics      - get daily metrics
 *   GET    /api/ads/campaigns/:campaignId/metrics/summary - get aggregated summary
 *   POST   /api/ads/campaigns/:campaignId/metrics      - record a metrics snapshot
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import {
  insertAdCampaignSchema,
  insertAdSetSchema,
  insertAdCreativeSchema,
  insertAdMetricSchema,
  adCampaignStatuses,
} from "@shared/schema";

function requireAuth(req: Request, res: Response): string | null {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return (req.user as any).id as string;
}

export function setupAdsRoutes(app: Express): void {

  // ─── Campaigns ────────────────────────────────────────────────────────────

  app.get("/api/ads/campaigns", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const campaigns = await storage.getAdCampaigns(userId);
      res.json(campaigns);
    } catch (err) {
      console.error("[ads] getAdCampaigns error", err);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.post("/api/ads/campaigns", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertAdCampaignSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid campaign data", details: parsed.error.flatten() });
    }
    try {
      const campaign = await storage.createAdCampaign(parsed.data);
      res.status(201).json(campaign);
    } catch (err) {
      console.error("[ads] createAdCampaign error", err);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.get("/api/ads/campaigns/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const campaign = await storage.getAdCampaign(req.params.id, userId);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      res.json(campaign);
    } catch (err) {
      console.error("[ads] getAdCampaign error", err);
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  app.patch("/api/ads/campaigns/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertAdCampaignSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
    }
    try {
      const updated = await storage.updateAdCampaign(req.params.id, userId, parsed.data);
      if (!updated) return res.status(404).json({ error: "Campaign not found" });
      res.json(updated);
    } catch (err) {
      console.error("[ads] updateAdCampaign error", err);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  app.patch("/api/ads/campaigns/:id/status", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { status } = req.body;
    if (!adCampaignStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${adCampaignStatuses.join(", ")}` });
    }
    try {
      const updated = await storage.updateAdCampaign(req.params.id, userId, { status });
      if (!updated) return res.status(404).json({ error: "Campaign not found" });
      res.json(updated);
    } catch (err) {
      console.error("[ads] updateCampaignStatus error", err);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.delete("/api/ads/campaigns/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const deleted = await storage.deleteAdCampaign(req.params.id, userId);
      if (!deleted) return res.status(404).json({ error: "Campaign not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[ads] deleteAdCampaign error", err);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // ─── Ad Sets ──────────────────────────────────────────────────────────────

  app.get("/api/ads/campaigns/:campaignId/sets", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const sets = await storage.getAdSets(req.params.campaignId, userId);
      res.json(sets);
    } catch (err) {
      console.error("[ads] getAdSets error", err);
      res.status(500).json({ error: "Failed to fetch ad sets" });
    }
  });

  app.post("/api/ads/campaigns/:campaignId/sets", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertAdSetSchema.safeParse({ ...req.body, userId, campaignId: req.params.campaignId });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid ad set data", details: parsed.error.flatten() });
    }
    try {
      const adSet = await storage.createAdSet(parsed.data);
      res.status(201).json(adSet);
    } catch (err) {
      console.error("[ads] createAdSet error", err);
      res.status(500).json({ error: "Failed to create ad set" });
    }
  });

  app.get("/api/ads/campaigns/:campaignId/sets/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const adSet = await storage.getAdSet(req.params.id, userId);
      if (!adSet) return res.status(404).json({ error: "Ad set not found" });
      res.json(adSet);
    } catch (err) {
      console.error("[ads] getAdSet error", err);
      res.status(500).json({ error: "Failed to fetch ad set" });
    }
  });

  app.patch("/api/ads/campaigns/:campaignId/sets/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertAdSetSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
    }
    try {
      const updated = await storage.updateAdSet(req.params.id, userId, parsed.data);
      if (!updated) return res.status(404).json({ error: "Ad set not found" });
      res.json(updated);
    } catch (err) {
      console.error("[ads] updateAdSet error", err);
      res.status(500).json({ error: "Failed to update ad set" });
    }
  });

  app.delete("/api/ads/campaigns/:campaignId/sets/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const deleted = await storage.deleteAdSet(req.params.id, userId);
      if (!deleted) return res.status(404).json({ error: "Ad set not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[ads] deleteAdSet error", err);
      res.status(500).json({ error: "Failed to delete ad set" });
    }
  });

  // ─── Ad Creatives ─────────────────────────────────────────────────────────

  app.get("/api/ads/sets/:adSetId/creatives", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const creatives = await storage.getAdCreatives(req.params.adSetId, userId);
      res.json(creatives);
    } catch (err) {
      console.error("[ads] getAdCreatives error", err);
      res.status(500).json({ error: "Failed to fetch creatives" });
    }
  });

  app.post("/api/ads/sets/:adSetId/creatives", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    // campaignId must be supplied in body
    const parsed = insertAdCreativeSchema.safeParse({
      ...req.body,
      userId,
      adSetId: req.params.adSetId,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid creative data", details: parsed.error.flatten() });
    }
    try {
      const creative = await storage.createAdCreative(parsed.data);
      res.status(201).json(creative);
    } catch (err) {
      console.error("[ads] createAdCreative error", err);
      res.status(500).json({ error: "Failed to create creative" });
    }
  });

  app.patch("/api/ads/sets/:adSetId/creatives/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertAdCreativeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid update data", details: parsed.error.flatten() });
    }
    try {
      const updated = await storage.updateAdCreative(req.params.id, userId, parsed.data);
      if (!updated) return res.status(404).json({ error: "Creative not found" });
      res.json(updated);
    } catch (err) {
      console.error("[ads] updateAdCreative error", err);
      res.status(500).json({ error: "Failed to update creative" });
    }
  });

  app.delete("/api/ads/sets/:adSetId/creatives/:id", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const deleted = await storage.deleteAdCreative(req.params.id, userId);
      if (!deleted) return res.status(404).json({ error: "Creative not found" });
      res.json({ success: true });
    } catch (err) {
      console.error("[ads] deleteAdCreative error", err);
      res.status(500).json({ error: "Failed to delete creative" });
    }
  });

  // ─── Metrics ──────────────────────────────────────────────────────────────

  app.get("/api/ads/campaigns/:campaignId/metrics", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const metrics = await storage.getAdMetrics(req.params.campaignId, userId);
      res.json(metrics);
    } catch (err) {
      console.error("[ads] getAdMetrics error", err);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/ads/campaigns/:campaignId/metrics/summary", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const summary = await storage.getAdMetricSummary(req.params.campaignId, userId);
      res.json(summary);
    } catch (err) {
      console.error("[ads] getAdMetricSummary error", err);
      res.status(500).json({ error: "Failed to fetch metric summary" });
    }
  });

  // ─── Publish campaign to ad platform ─────────────────────────────────────

  app.post("/api/ads/campaigns/:id/publish", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    try {
      const campaign = await storage.getAdCampaign(req.params.id, userId);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });

      // Find the connected account for this platform
      const accounts = await storage.getAccounts(userId);
      const account = accounts.find(
        (a) => a.platform === campaign.platform && a.isConnected
      );
      if (!account) {
        return res.status(400).json({
          error: `No connected ${campaign.platform} account found. Connect one in Accounts first.`,
        });
      }

      const { publishAdCampaign } = await import("./ad-publisher");
      const result = await publishAdCampaign(campaign, account);

      if (result.success) {
        // Persist platform IDs back to the campaign
        await storage.updateAdCampaign(req.params.id, userId, {
          platformCampaignId: result.platformCampaignId,
          status: "active",
        });
      }

      res.json(result);
    } catch (err) {
      console.error("[ads] publishAdCampaign error", err);
      res.status(500).json({ error: "Failed to publish campaign" });
    }
  });

  app.post("/api/ads/campaigns/:campaignId/metrics", async (req: Request, res: Response) => {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const parsed = insertAdMetricSchema.safeParse({
      ...req.body,
      userId,
      campaignId: req.params.campaignId,
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid metric data", details: parsed.error.flatten() });
    }
    try {
      const metric = await storage.createAdMetric(parsed.data);
      res.status(201).json(metric);
    } catch (err) {
      console.error("[ads] createAdMetric error", err);
      res.status(500).json({ error: "Failed to record metric" });
    }
  });
}
