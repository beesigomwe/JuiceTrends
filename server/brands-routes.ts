/**
 * Brands API routes
 *
 * GET    /api/brands                     – list all brands for the current user (with accounts)
 * GET    /api/brands/:id                 – get a single brand with its accounts
 * POST   /api/brands                     – create a brand
 * PATCH  /api/brands/:id                 – update a brand
 * DELETE /api/brands/:id                 – delete a brand (and its account memberships)
 * POST   /api/brands/:id/accounts        – add a social account to a brand  { accountId }
 * DELETE /api/brands/:id/accounts/:accountId – remove a social account from a brand
 */

import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { insertBrandSchema } from "@shared/schema";

export function setupBrandsRoutes(app: Express) {
  // List brands for the authenticated user
  app.get("/api/brands", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const result = await storage.getBrands(userId);
      res.json(result);
    } catch (err) {
      console.error("[brands] GET /api/brands error:", err);
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  // Get a single brand
  app.get("/api/brands/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const brand = await storage.getBrand(req.params.id);
      if (!brand) return res.status(404).json({ error: "Brand not found" });
      res.json(brand);
    } catch (err) {
      console.error("[brands] GET /api/brands/:id error:", err);
      res.status(500).json({ error: "Failed to fetch brand" });
    }
  });

  // Create a brand
  app.post("/api/brands", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = insertBrandSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid brand data", details: parsed.error.errors });
      }

      const brand = await storage.createBrand(parsed.data);
      res.status(201).json(brand);
    } catch (err) {
      console.error("[brands] POST /api/brands error:", err);
      res.status(500).json({ error: "Failed to create brand" });
    }
  });

  // Update a brand
  app.patch("/api/brands/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getBrand(req.params.id);
      if (!existing) return res.status(404).json({ error: "Brand not found" });

      const userId = (req.user as any)?.id;
      if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      const partial = insertBrandSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ error: "Invalid brand data", details: partial.error.errors });
      }

      const updated = await storage.updateBrand(req.params.id, partial.data);
      res.json(updated);
    } catch (err) {
      console.error("[brands] PATCH /api/brands/:id error:", err);
      res.status(500).json({ error: "Failed to update brand" });
    }
  });

  // Delete a brand
  app.delete("/api/brands/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getBrand(req.params.id);
      if (!existing) return res.status(404).json({ error: "Brand not found" });

      const userId = (req.user as any)?.id;
      if (existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      await storage.deleteBrand(req.params.id);
      res.status(204).send();
    } catch (err) {
      console.error("[brands] DELETE /api/brands/:id error:", err);
      res.status(500).json({ error: "Failed to delete brand" });
    }
  });

  // Add a social account to a brand
  app.post("/api/brands/:id/accounts", requireAuth, async (req: Request, res: Response) => {
    try {
      const { accountId } = req.body as { accountId?: string };
      if (!accountId) return res.status(400).json({ error: "accountId is required" });

      const brand = await storage.getBrand(req.params.id);
      if (!brand) return res.status(404).json({ error: "Brand not found" });

      const userId = (req.user as any)?.id;
      if (brand.userId !== userId) return res.status(403).json({ error: "Forbidden" });

      const ba = await storage.addAccountToBrand(req.params.id, accountId);
      res.status(201).json(ba);
    } catch (err) {
      console.error("[brands] POST /api/brands/:id/accounts error:", err);
      res.status(500).json({ error: "Failed to add account to brand" });
    }
  });

  // Remove a social account from a brand
  app.delete(
    "/api/brands/:id/accounts/:accountId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const brand = await storage.getBrand(req.params.id);
        if (!brand) return res.status(404).json({ error: "Brand not found" });

        const userId = (req.user as any)?.id;
        if (brand.userId !== userId) return res.status(403).json({ error: "Forbidden" });

        await storage.removeAccountFromBrand(req.params.id, req.params.accountId);
        res.status(204).send();
      } catch (err) {
        console.error("[brands] DELETE /api/brands/:id/accounts/:accountId error:", err);
        res.status(500).json({ error: "Failed to remove account from brand" });
      }
    }
  );
}
