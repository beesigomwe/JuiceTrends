/**
 * Ad Publisher Service
 *
 * Dispatches ad campaigns to platform-specific Ads APIs:
 *   - Facebook / Instagram  → Meta Marketing API v19
 *   - LinkedIn              → Campaign Manager API v202401
 *   - Twitter / X           → Ads API v12
 *
 * Each publisher function:
 *   1. Creates the campaign object on the platform
 *   2. Creates an ad set (targeting + budget)
 *   3. Creates the ad creative
 *   4. Creates the ad (links creative to ad set)
 *   5. Returns platform-assigned IDs for storage
 *
 * All functions are async and return a typed result so the caller can
 * persist the platformCampaignId back to the database.
 */

import type { AdCampaignWithSets, AdCreative, AdSet } from "@shared/schema";
import type { SocialAccount } from "@shared/schema";

export type AdPublishResult = {
  success: boolean;
  platformCampaignId?: string;
  platformAdSetId?: string;
  platformCreativeId?: string;
  platformAdId?: string;
  error?: string;
};

// ─── Facebook / Instagram (Meta Marketing API) ───────────────────────────────

async function publishToFacebook(
  campaign: AdCampaignWithSets,
  adSet: AdSet,
  creative: AdCreative,
  account: SocialAccount
): Promise<AdPublishResult> {
  const token = account.accessToken;
  // Use the dedicated adAccountId (act_XXXXXXX) stored during OAuth.
  // Fall back to platformUserId for legacy accounts that pre-date this field.
  const adAccountId = (account as any).adAccountId ?? account.platformUserId;
  const pageId = account.platformUserId; // The Facebook Page ID for the creative
  const baseUrl = `https://graph.facebook.com/v19.0/${adAccountId}`;

  try {
    // 1. Create campaign
    const campaignRes = await fetch(`${baseUrl}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaign.name,
        objective: mapFbObjective(campaign.objective),
        status: campaign.status === "active" ? "ACTIVE" : "PAUSED",
        special_ad_categories: [],
        access_token: token,
      }),
    });
    if (!campaignRes.ok) {
      const err = await campaignRes.json();
      return { success: false, error: `FB campaign create failed: ${JSON.stringify(err)}` };
    }
    const campaignJson = await campaignRes.json();
    const platformCampaignId = campaignJson.id as string;

    // 2. Create ad set
    const adSetRes = await fetch(`${baseUrl}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: adSet.name,
        campaign_id: platformCampaignId,
        daily_budget: adSet.dailyBudget || campaign.dailyBudget,
        billing_event: "IMPRESSIONS",
        optimization_goal: "REACH",
        bid_strategy: mapFbBidStrategy(adSet.bidStrategy ?? "lowest_cost"),
        targeting: buildFbTargeting(adSet),
        status: adSet.status === "active" ? "ACTIVE" : "PAUSED",
        access_token: token,
      }),
    });
    if (!adSetRes.ok) {
      const err = await adSetRes.json();
      return { success: false, platformCampaignId, error: `FB ad set create failed: ${JSON.stringify(err)}` };
    }
    const { id: platformAdSetId } = await adSetRes.json();

    // 3. Create ad creative
    const creativeRes = await fetch(`${baseUrl}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: creative.name,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            message: creative.bodyText ?? "",
            link: creative.destinationUrl ?? "https://example.com",
            name: creative.headline ?? "",
            call_to_action: { type: mapFbCta(creative.callToAction ?? "LEARN_MORE") },
            ...(creative.mediaUrl ? { picture: creative.mediaUrl } : {}),
          },
        },
        access_token: token,
      }),
    });
    if (!creativeRes.ok) {
      const err = await creativeRes.json();
      return { success: false, platformCampaignId, platformAdSetId, error: `FB creative create failed: ${JSON.stringify(err)}` };
    }
    const { id: platformCreativeId } = await creativeRes.json();

    // 4. Create ad
    const adRes = await fetch(`${baseUrl}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${campaign.name} — Ad`,
        adset_id: platformAdSetId,
        creative: { creative_id: platformCreativeId },
        status: "PAUSED",
        access_token: token,
      }),
    });
    if (!adRes.ok) {
      const err = await adRes.json();
      return { success: false, platformCampaignId, platformAdSetId, platformCreativeId, error: `FB ad create failed: ${JSON.stringify(err)}` };
    }
    const { id: platformAdId } = await adRes.json();

    return { success: true, platformCampaignId, platformAdSetId, platformCreativeId, platformAdId };
  } catch (err: any) {
    return { success: false, error: `Facebook publisher exception: ${err.message}` };
  }
}

function mapFbObjective(obj: string): string {
  const map: Record<string, string> = {
    awareness: "BRAND_AWARENESS",
    traffic: "LINK_CLICKS",
    engagement: "POST_ENGAGEMENT",
    leads: "LEAD_GENERATION",
    conversions: "CONVERSIONS",
    sales: "PRODUCT_CATALOG_SALES",
  };
  return map[obj] ?? "BRAND_AWARENESS";
}

function mapFbBidStrategy(strategy: string): string {
  const map: Record<string, string> = {
    lowest_cost: "LOWEST_COST_WITHOUT_CAP",
    cost_cap: "LOWEST_COST_WITH_BID_CAP",
    bid_cap: "LOWEST_COST_WITH_BID_CAP",
    target_cost: "TARGET_COST",
  };
  return map[strategy] ?? "LOWEST_COST_WITHOUT_CAP";
}

function mapFbCta(cta: string): string {
  const map: Record<string, string> = {
    "Learn More": "LEARN_MORE",
    "Shop Now": "SHOP_NOW",
    "Sign Up": "SIGN_UP",
    "Download": "DOWNLOAD",
    "Contact Us": "CONTACT_US",
    "Book Now": "BOOK_TRAVEL",
  };
  return map[cta] ?? "LEARN_MORE";
}

function buildFbTargeting(adSet: AdSet): Record<string, any> {
  const t = adSet.targeting ?? {};
  return {
    age_min: t.ageMin ?? 18,
    age_max: t.ageMax ?? 65,
    genders: t.genders?.map((g: string) => (g === "male" ? 1 : 2)),
    geo_locations: t.locations?.length
      ? { countries: t.locations }
      : { countries: ["US"] },
    interests: t.interests?.map((i: string) => ({ name: i })),
  };
}

// ─── LinkedIn Campaign Manager API ───────────────────────────────────────────

async function publishToLinkedIn(
  campaign: AdCampaignWithSets,
  adSet: AdSet,
  creative: AdCreative,
  account: SocialAccount
): Promise<AdPublishResult> {
  const token = account.accessToken;
  const adAccountId = account.platformUserId; // LinkedIn ad account URN
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  try {
    // 1. Create campaign group (maps to our "campaign")
    const cgRes = await fetch("https://api.linkedin.com/v2/adCampaignGroupsV2", {
      method: "POST",
      headers,
      body: JSON.stringify({
        account: `urn:li:sponsoredAccount:${adAccountId}`,
        name: campaign.name,
        status: campaign.status === "active" ? "ACTIVE" : "DRAFT",
        runSchedule: {
          start: campaign.startDate ? new Date(campaign.startDate).getTime() : Date.now(),
          ...(campaign.endDate ? { end: new Date(campaign.endDate).getTime() } : {}),
        },
      }),
    });
    if (!cgRes.ok) {
      const err = await cgRes.text();
      return { success: false, error: `LinkedIn campaign group failed: ${err}` };
    }
    const cgData = await cgRes.json() as { id?: string | number };
    const platformCampaignId = cgData.id?.toString();

    // 2. Create campaign (ad set level)
    const campRes = await fetch("https://api.linkedin.com/v2/adCampaignsV2", {
      method: "POST",
      headers,
      body: JSON.stringify({
        account: `urn:li:sponsoredAccount:${adAccountId}`,
        campaignGroup: `urn:li:sponsoredCampaignGroup:${platformCampaignId}`,
        name: adSet.name,
        type: "TEXT_AD",
        costType: "CPM",
        dailyBudget: { amount: String(((adSet.dailyBudget ?? 0) || (campaign.dailyBudget ?? 0)) / 100), currencyCode: campaign.currency ?? "USD" },
        targeting: buildLinkedInTargeting(adSet),
        status: adSet.status === "active" ? "ACTIVE" : "DRAFT",
        objectiveType: mapLinkedInObjective(campaign.objective),
      }),
    });
    if (!campRes.ok) {
      const err = await campRes.text();
      return { success: false, platformCampaignId, error: `LinkedIn campaign failed: ${err}` };
    }
    const campData = await campRes.json();
    const platformAdSetId = campData.id?.toString();

    // 3. Create creative
    const creativeRes = await fetch("https://api.linkedin.com/v2/adCreativesV2", {
      method: "POST",
      headers,
      body: JSON.stringify({
        campaign: `urn:li:sponsoredCampaign:${platformAdSetId}`,
        status: "ACTIVE",
        type: "TEXT_AD",
        variables: {
          data: {
            "com.linkedin.ads.TextAdCreativeVariables": {
              headline: creative.headline ?? campaign.name,
              description: creative.bodyText ?? "",
              destinationUrl: creative.destinationUrl ?? "https://example.com",
            },
          },
        },
      }),
    });
    if (!creativeRes.ok) {
      const err = await creativeRes.text();
      return { success: false, platformCampaignId, platformAdSetId, error: `LinkedIn creative failed: ${err}` };
    }
    const creativeData = await creativeRes.json();
    const platformCreativeId = creativeData.id?.toString();

    return { success: true, platformCampaignId, platformAdSetId, platformCreativeId };
  } catch (err: any) {
    return { success: false, error: `LinkedIn publisher exception: ${err.message}` };
  }
}

function mapLinkedInObjective(obj: string): string {
  const map: Record<string, string> = {
    awareness: "BRAND_AWARENESS",
    traffic: "WEBSITE_VISITS",
    engagement: "ENGAGEMENT",
    leads: "LEAD_GENERATION",
    conversions: "WEBSITE_CONVERSIONS",
    sales: "WEBSITE_CONVERSIONS",
  };
  return map[obj] ?? "BRAND_AWARENESS";
}

function buildLinkedInTargeting(adSet: AdSet): Record<string, any> {
  const t = adSet.targeting ?? {};
  return {
    includedTargetingFacets: {
      ...(t.locations?.length ? { locations: t.locations.map((l: string) => ({ country: l })) } : {}),
      ...(t.interests?.length ? { interests: t.interests.map((i: string) => ({ name: i })) } : {}),
    },
  };
}

// ─── Twitter / X Ads API ─────────────────────────────────────────────────────

async function publishToTwitter(
  campaign: AdCampaignWithSets,
  adSet: AdSet,
  creative: AdCreative,
  account: SocialAccount
): Promise<AdPublishResult> {
  const token = account.accessToken;
  const adAccountId = account.platformUserId;
  const baseUrl = `https://ads-api.twitter.com/12/accounts/${adAccountId}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. Create campaign
    const campaignRes = await fetch(`${baseUrl}/campaigns`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: campaign.name,
        funding_instrument_id: "", // must be set from account
        daily_budget_amount_local_micro: ((adSet.dailyBudget ?? 0) || (campaign.dailyBudget ?? 0)) * 10000,
        status: campaign.status === "active" ? "ACTIVE" : "PAUSED",
        start_time: campaign.startDate ? new Date(campaign.startDate).toISOString() : new Date().toISOString(),
        ...(campaign.endDate ? { end_time: new Date(campaign.endDate).toISOString() } : {}),
      }),
    });
    if (!campaignRes.ok) {
      const err = await campaignRes.text();
      return { success: false, error: `Twitter campaign failed: ${err}` };
    }
    const campaignData = await campaignRes.json();
    const platformCampaignId = campaignData.data?.id;

    // 2. Create line item (ad set)
    const lineItemRes = await fetch(`${baseUrl}/line_items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        campaign_id: platformCampaignId,
        name: adSet.name,
        product_type: "PROMOTED_TWEETS",
        placements: ["ALL_ON_TWITTER"],
        objective: mapTwitterObjective(campaign.objective),
        bid_type: "AUTO",
        status: adSet.status === "active" ? "ACTIVE" : "PAUSED",
      }),
    });
    if (!lineItemRes.ok) {
      const err = await lineItemRes.text();
      return { success: false, platformCampaignId, error: `Twitter line item failed: ${err}` };
    }
    const lineItemData = await lineItemRes.json();
    const platformAdSetId = lineItemData.data?.id;

    // 3. Create tweet as creative (promoted tweet)
    const tweetRes = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers,
      body: JSON.stringify({ text: creative.bodyText ?? creative.headline ?? campaign.name }),
    });
    if (!tweetRes.ok) {
      const err = await tweetRes.text();
      return { success: false, platformCampaignId, platformAdSetId, error: `Twitter tweet create failed: ${err}` };
    }
    const tweetData = await tweetRes.json();
    const platformCreativeId = tweetData.data?.id;

    // 4. Promote tweet via line item
    await fetch(`${baseUrl}/promoted_tweets`, {
      method: "POST",
      headers,
      body: JSON.stringify({ line_item_id: platformAdSetId, tweet_ids: [platformCreativeId] }),
    });

    return { success: true, platformCampaignId, platformAdSetId, platformCreativeId };
  } catch (err: any) {
    return { success: false, error: `Twitter publisher exception: ${err.message}` };
  }
}

function mapTwitterObjective(obj: string): string {
  const map: Record<string, string> = {
    awareness: "AWARENESS",
    traffic: "WEBSITE_CLICKS",
    engagement: "TWEET_ENGAGEMENTS",
    leads: "LEAD_GENERATION",
    conversions: "WEBSITE_CONVERSIONS",
    sales: "WEBSITE_CONVERSIONS",
  };
  return map[obj] ?? "AWARENESS";
}

// ─── Public dispatcher ────────────────────────────────────────────────────────

/**
 * Publish a campaign's first ad set + first creative to the target platform.
 * Returns a typed result with platform-assigned IDs.
 */
export async function publishAdCampaign(
  campaign: AdCampaignWithSets,
  account: SocialAccount
): Promise<AdPublishResult> {
  const adSet = campaign.adSets?.[0];
  const creative = adSet?.creatives?.[0];

  if (!adSet) return { success: false, error: "No ad sets found on campaign" };
  if (!creative) return { success: false, error: "No creatives found on first ad set" };
  if (!account.accessToken) return { success: false, error: "Account has no access token" };

  switch (campaign.platform) {
    case "facebook":
    case "instagram":
      return publishToFacebook(campaign, adSet, creative, account);
    case "linkedin":
      return publishToLinkedIn(campaign, adSet, creative, account);
    case "twitter":
      return publishToTwitter(campaign, adSet, creative, account);
    default:
      return { success: false, error: `Unsupported ad platform: ${campaign.platform}` };
  }
}
