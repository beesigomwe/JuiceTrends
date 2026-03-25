/**
 * ai-generate.ts
 *
 * POST /api/ai/generate
 *
 * Accepts a topic, tone, and list of target platforms.
 * Uses the OpenAI-compatible API (gpt-4.1-mini) to generate:
 *   - A primary post body optimised for the shortest character limit among
 *     the selected platforms.
 *   - Platform-specific variants when the platforms have meaningfully
 *     different limits (e.g. Twitter 280 vs LinkedIn 3000).
 *   - Suggested hashtags.
 *
 * Response shape:
 * {
 *   content: string,          // primary content (fits tightest limit)
 *   hashtags: string,         // comma-separated hashtag suggestions
 *   variants: {               // per-platform variants (only when limits differ)
 *     [platform]: string
 *   }
 * }
 */

import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth";
import OpenAI from "openai";

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  twitter: 280,
  threads: 500,
  pinterest: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
  youtube: 5000,
};

const TONE_DESCRIPTIONS: Record<string, string> = {
  professional: "formal, authoritative, and polished",
  casual: "friendly, conversational, and approachable",
  humorous: "witty, light-hearted, and entertaining",
  promotional: "persuasive, benefit-focused, and action-oriented",
};

export function setupAiGenerate(app: Express): void {
  app.post("/api/ai/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      const {
        topic = "our brand",
        tone = "professional",
        platforms = [] as string[],
      } = req.body as { topic?: string; tone?: string; platforms?: string[] };

      const client = new OpenAI();

      const toneDesc = TONE_DESCRIPTIONS[tone] ?? TONE_DESCRIPTIONS.professional;

      // Determine the tightest character limit among selected platforms
      const limits = platforms
        .map((p) => PLATFORM_CHAR_LIMITS[p])
        .filter(Boolean) as number[];
      const tightestLimit = limits.length > 0 ? Math.min(...limits) : 2200;

      // Build the system prompt
      const systemPrompt = `You are a professional social media copywriter.
Write engaging, ${toneDesc} social media content.
Always respond with valid JSON matching the exact schema provided.
Do not include markdown code fences in your response.`;

      // Build the user prompt
      const platformList =
        platforms.length > 0 ? platforms.join(", ") : "general social media";

      const userPrompt = `Create social media content about: "${topic}"

Target platforms: ${platformList}
Tone: ${tone} (${toneDesc})
Primary content must be under ${tightestLimit} characters.

Return a JSON object with these exact keys:
{
  "content": "<primary post content, max ${tightestLimit} chars>",
  "hashtags": "<5-8 relevant hashtags separated by commas, without # prefix>",
  "variants": {
${platforms
  .filter((p) => PLATFORM_CHAR_LIMITS[p] && PLATFORM_CHAR_LIMITS[p] > tightestLimit)
  .map((p) => `    "${p}": "<optimised version for ${p}, max ${PLATFORM_CHAR_LIMITS[p]} chars>"`)
  .join(",\n")}
  }
}

Guidelines:
- Twitter/X: concise, punchy, use 1-2 hashtags inline
- LinkedIn: professional, add context and value, can be longer
- Instagram: engaging, emoji-friendly, mention "link in bio" if relevant
- Threads: conversational, like a tweet but slightly longer
- TikTok: energetic, trend-aware, hook in first line
- Pinterest: descriptive, keyword-rich for search
- YouTube: descriptive title-style, include call to action
- Facebook: friendly, shareable, can include a question`;

      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";

      // Strip any accidental markdown fences
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      let parsed: { content?: string; hashtags?: string; variants?: Record<string, string> };
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Fallback: return the raw text as content
        parsed = { content: raw, hashtags: "", variants: {} };
      }

      return res.json({
        content: parsed.content ?? "",
        hashtags: parsed.hashtags ?? "",
        variants: parsed.variants ?? {},
      });
    } catch (err: any) {
      console.error("[ai-generate] Error:", err.message);
      return res.status(500).json({ error: "AI generation failed", details: err.message });
    }
  });
}
