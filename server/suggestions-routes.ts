/**
 * suggestions-routes.ts
 *
 * REST API endpoints for the Post Suggestion Engine.
 *
 * POST   /api/suggestions/generate        — run the engine, generate fresh suggestions
 * GET    /api/suggestions                 — list suggestions for the current user
 * PATCH  /api/suggestions/:id             — update status (accept / dismiss)
 * POST   /api/suggestions/:id/schedule    — one-click schedule an accepted suggestion
 * DELETE /api/suggestions/:id             — delete a suggestion
 */

import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth";
import { storage } from "./storage";
import { runSuggestionEngine } from "./suggestion-engine";
import type { PlatformType } from "@shared/schema";

export function setupSuggestionsRoutes(app: Express): void {

  // ── POST /api/suggestions/generate ──────────────────────────────────────────
  // Triggers a full suggestion engine run for the authenticated user.
  // Deletes old pending suggestions and returns a fresh set.
  app.post("/api/suggestions/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await runSuggestionEngine(userId, storage);
      return res.json(result);
    } catch (err: any) {
      console.error("[suggestions] generate error:", err.message);
      return res.status(500).json({ error: "Suggestion engine failed", details: err.message });
    }
  });

  // ── GET /api/suggestions ─────────────────────────────────────────────────────
  // Returns all suggestions for the current user, optionally filtered by status.
  app.get("/api/suggestions", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const suggestions = await storage.getSuggestions(userId, status);
      return res.json(suggestions);
    } catch (err: any) {
      console.error("[suggestions] list error:", err.message);
      return res.status(500).json({ error: "Failed to fetch suggestions" });
    }
  });

  // ── PATCH /api/suggestions/:id ───────────────────────────────────────────────
  // Update a suggestion's status: "accepted" | "dismissed" | "pending"
  app.patch("/api/suggestions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const { status } = req.body as { status?: string };

      const validStatuses = ["pending", "accepted", "dismissed"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: "status must be one of: pending, accepted, dismissed" });
      }

      const updated = await storage.updateSuggestion(id, userId, { status: status as any });
      if (!updated) return res.status(404).json({ error: "Suggestion not found" });
      return res.json(updated);
    } catch (err: any) {
      console.error("[suggestions] patch error:", err.message);
      return res.status(500).json({ error: "Failed to update suggestion" });
    }
  });

  // ── POST /api/suggestions/:id/schedule ──────────────────────────────────────
  // One-click schedule: creates a real Post from the suggestion and marks it scheduled.
  app.post("/api/suggestions/:id/schedule", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const { scheduledAt } = req.body as { scheduledAt?: string };

      // Fetch the suggestion
      const suggestion = await storage.getSuggestion(id, userId);
      if (!suggestion) return res.status(404).json({ error: "Suggestion not found" });

      // Determine the scheduled time
      let scheduleDate: Date;
      if (scheduledAt) {
        scheduleDate = new Date(scheduledAt);
      } else if (
        suggestion.suggestedDayOfWeek !== null &&
        suggestion.suggestedHour !== null
      ) {
        // Compute the next occurrence of the suggested day/hour
        scheduleDate = nextOccurrenceOf(suggestion.suggestedDayOfWeek, suggestion.suggestedHour);
      } else {
        // Default: 24 hours from now
        scheduleDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      // Create the post
      const post = await storage.createPost({
        userId,
        content: suggestion.content,
        platforms: suggestion.platforms as PlatformType[],
        hashtags: suggestion.hashtags ?? [],
        status: "scheduled",
        scheduledAt: scheduleDate,
        mediaUrls: null,
        publishResults: null,
        platformMetadata: null,
        brandId: null,
      } as any);

      // Mark the suggestion as scheduled and link the post
      await storage.updateSuggestion(id, userId, {
        status: "scheduled",
        scheduledPostId: post.id,
      });

      return res.json({ post, scheduledAt: scheduleDate.toISOString() });
    } catch (err: any) {
      console.error("[suggestions] schedule error:", err.message);
      return res.status(500).json({ error: "Failed to schedule suggestion", details: err.message });
    }
  });

  // ── DELETE /api/suggestions/:id ──────────────────────────────────────────────
  app.delete("/api/suggestions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const deleted = await storage.deleteSuggestion(id, userId);
      if (!deleted) return res.status(404).json({ error: "Suggestion not found" });
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[suggestions] delete error:", err.message);
      return res.status(500).json({ error: "Failed to delete suggestion" });
    }
  });
}

// ─── Helper: next occurrence of a given day-of-week + hour ───────────────────

function nextOccurrenceOf(dayOfWeek: number, hour: number): Date {
  const now = new Date();
  const result = new Date(now);
  result.setUTCHours(hour, 0, 0, 0);

  const currentDay = now.getUTCDay();
  let daysUntil = (dayOfWeek - currentDay + 7) % 7;

  // If today is the right day but the hour has passed, push to next week
  if (daysUntil === 0 && now.getUTCHours() >= hour) {
    daysUntil = 7;
  }

  result.setUTCDate(result.getUTCDate() + daysUntil);
  return result;
}
