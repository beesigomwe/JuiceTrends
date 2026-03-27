import { eq, desc, and } from "drizzle-orm";
import {
  users,
  posts,
  socialAccounts,
  brands,
  brandAccounts,
  suggestedPosts,
  adCampaigns,
  adSets,
  adCreatives,
  adMetrics,
  newsletterSubscribers,
  newsletters,
  type User,
  type InsertUser,
  type Post,
  type InsertPost,
  type SocialAccount,
  type InsertSocialAccount,
  type Brand,
  type InsertBrand,
  type BrandAccount,
  type BrandWithAccounts,
  type DashboardStats,
  type ChartDataPoint,
  type SuggestedPost,
  type InsertSuggestedPost,
  type AdCampaign,
  type InsertAdCampaign,
  type AdSet,
  type InsertAdSet,
  type AdCreative,
  type InsertAdCreative,
  type AdMetric,
  type InsertAdMetric,
  type AdCampaignWithSets,
  type AdMetricSummary,
  type NewsletterSubscriber,
  type InsertNewsletterSubscriber,
  type Newsletter,
  type InsertNewsletter,
} from "@shared/schema";
import type { IStorage } from "./storage";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { encrypt, decrypt } from "./crypto";

function encryptAccountTokens(account: InsertSocialAccount): InsertSocialAccount {
  return {
    ...account,
    accessToken: account.accessToken ? encrypt(account.accessToken) : account.accessToken,
    refreshToken: account.refreshToken ? encrypt(account.refreshToken) : account.refreshToken,
  };
}

function decryptAccount(account: SocialAccount): SocialAccount {
  return {
    ...account,
    accessToken: account.accessToken ? decrypt(account.accessToken) : account.accessToken,
    refreshToken: account.refreshToken ? decrypt(account.refreshToken) : account.refreshToken,
  };
}

export class DbStorage implements IStorage {
  constructor(private db: NodePgDatabase) {}

  async getUser(id: string): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0] as User | undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] as User | undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const rows = await this.db.insert(users).values(insertUser).returning();
    const user = rows[0];
    if (!user) throw new Error("Insert user failed");
    return user as User;
  }

  async getPosts(userId?: string): Promise<Post[]> {
    if (userId) {
      const rows = await this.db
        .select()
        .from(posts)
        .where(eq(posts.userId, userId))
        .orderBy(desc(posts.scheduledAt), desc(posts.createdAt));
      return rows as Post[];
    }
    const rows = await this.db
      .select()
      .from(posts)
      .orderBy(desc(posts.scheduledAt), desc(posts.createdAt));
    return rows as Post[];
  }

  async getPost(id: string): Promise<Post | undefined> {
    const rows = await this.db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return rows[0] as Post | undefined;
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const rows = await this.db.insert(posts).values(insertPost as typeof posts.$inferInsert).returning();
    const post = rows[0];
    if (!post) throw new Error("Insert post failed");
    return post as Post;
  }

  async updatePost(id: string, updates: Partial<InsertPost> & { publishedAt?: Date | null; publishResults?: Record<string, any>; platformMetadata?: Record<string, any> }): Promise<Post | undefined> {
    const rows = await this.db.update(posts).set(updates as Partial<typeof posts.$inferInsert>).where(eq(posts.id, id)).returning();
    return rows[0] as Post | undefined;
  }

  async deletePost(id: string): Promise<boolean> {
    const result = await this.db.delete(posts).where(eq(posts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getRecentPosts(userId?: string, limit: number = 10): Promise<Post[]> {
    const all = await this.getPosts(userId);
    return all.slice(0, limit);
  }

  async getAccounts(userId?: string): Promise<SocialAccount[]> {
    let rows: SocialAccount[];
    if (userId) {
      rows = (await this.db.select().from(socialAccounts).where(eq(socialAccounts.userId, userId))) as SocialAccount[];
    } else {
      rows = (await this.db.select().from(socialAccounts)) as SocialAccount[];
    }
    return rows.map(decryptAccount);
  }

  async getAccount(id: string): Promise<SocialAccount | undefined> {
    const rows = await this.db.select().from(socialAccounts).where(eq(socialAccounts.id, id)).limit(1);
    const account = rows[0] as SocialAccount | undefined;
    return account ? decryptAccount(account) : undefined;
  }

  async createAccount(insertAccount: InsertSocialAccount): Promise<SocialAccount> {
    const encrypted = encryptAccountTokens(insertAccount);
    const rows = await this.db
      .insert(socialAccounts)
      .values(encrypted as typeof socialAccounts.$inferInsert)
      .returning();
    const account = rows[0];
    if (!account) throw new Error("Insert account failed");
    return decryptAccount(account as SocialAccount);
  }

  async updateAccount(id: string, updates: Partial<InsertSocialAccount>): Promise<SocialAccount | undefined> {
    const toSet = { ...updates } as Partial<typeof socialAccounts.$inferInsert>;
    if (updates.accessToken !== undefined) toSet.accessToken = encrypt(updates.accessToken) ?? updates.accessToken;
    if (updates.refreshToken !== undefined) toSet.refreshToken = encrypt(updates.refreshToken) ?? updates.refreshToken;
    const rows = await this.db.update(socialAccounts).set(toSet).where(eq(socialAccounts.id, id)).returning();
    const account = rows[0];
    return account ? decryptAccount(account as SocialAccount) : undefined;
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await this.db.delete(socialAccounts).where(eq(socialAccounts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createOrUpdateSocialAccount(insertAccount: InsertSocialAccount): Promise<SocialAccount> {
    const existing = await this.db
      .select()
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, insertAccount.userId))
      .limit(100);
    const match = (existing as SocialAccount[]).find(
      (a) => a.platform === insertAccount.platform && a.platformUserId === insertAccount.platformUserId
    );
    if (match) {
      const updated = await this.updateAccount(match.id, {
        accountName: insertAccount.accountName,
        accountHandle: insertAccount.accountHandle,
        avatarUrl: insertAccount.avatarUrl,
        accessToken: insertAccount.accessToken,
        refreshToken: insertAccount.refreshToken,
        tokenExpiresAt: insertAccount.tokenExpiresAt,
        isConnected: insertAccount.isConnected,
        followers: insertAccount.followers,
        engagement: insertAccount.engagement,
      });
      return updated!;
    }
    return this.createAccount(insertAccount);
  }

  async getDashboardStats(userId?: string): Promise<DashboardStats> {
    const postsList = await this.getPosts(userId);
    const accounts = await this.getAccounts(userId);
    const publishedPosts = postsList.filter((p) => p.status === "published");
    const scheduledPosts = postsList.filter((p) => p.status === "scheduled");
    const totalReach = publishedPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
    const totalEngagement = publishedPosts.reduce((sum, p) => sum + (p.engagement || 0), 0);
    const totalFollowers = accounts.reduce((sum, a) => sum + (a.followers || 0), 0);
    return {
      totalReach,
      reachChange: 12,
      totalEngagement,
      engagementChange: 8,
      scheduledPosts: scheduledPosts.length,
      postsChange: 15,
      totalFollowers,
      followersChange: 5,
    };
  }

  async getChartData(userId?: string): Promise<ChartDataPoint[]> {
    const now = new Date();
    const data: ChartDataPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        reach: Math.floor(Math.random() * 5000) + 8000,
        engagement: Math.floor(Math.random() * 500) + 400,
        impressions: Math.floor(Math.random() * 8000) + 12000,
      });
    }
    return data;
  }

  // ─── Brands ────────────────────────────────────────────────────────────────

  private async resolveBrandAccounts(brandId: string): Promise<SocialAccount[]> {
    const bas = await this.db
      .select()
      .from(brandAccounts)
      .where(eq(brandAccounts.brandId, brandId));
    if (bas.length === 0) return [];
    const accountRows = await Promise.all(
      bas.map((ba) =>
        this.db.select().from(socialAccounts).where(eq(socialAccounts.id, ba.accountId)).limit(1)
      )
    );
    return accountRows
      .flat()
      .filter((a): a is SocialAccount => a !== undefined)
      .map(decryptAccount);
  }

  async getBrands(userId: string): Promise<BrandWithAccounts[]> {
    const rows = await this.db
      .select()
      .from(brands)
      .where(eq(brands.userId, userId))
      .orderBy(desc(brands.createdAt));
    return Promise.all(
      (rows as Brand[]).map(async (b) => ({ ...b, accounts: await this.resolveBrandAccounts(b.id) }))
    );
  }

  async getBrand(id: string): Promise<BrandWithAccounts | undefined> {
    const rows = await this.db.select().from(brands).where(eq(brands.id, id)).limit(1);
    const brand = rows[0] as Brand | undefined;
    if (!brand) return undefined;
    return { ...brand, accounts: await this.resolveBrandAccounts(id) };
  }

  async createBrand(insertBrand: InsertBrand): Promise<Brand> {
    const rows = await this.db
      .insert(brands)
      .values(insertBrand as typeof brands.$inferInsert)
      .returning();
    const brand = rows[0];
    if (!brand) throw new Error("Insert brand failed");
    return brand as Brand;
  }

  async updateBrand(id: string, updates: Partial<InsertBrand>): Promise<Brand | undefined> {
    const rows = await this.db
      .update(brands)
      .set({ ...updates, updatedAt: new Date() } as Partial<typeof brands.$inferInsert>)
      .where(eq(brands.id, id))
      .returning();
    return rows[0] as Brand | undefined;
  }

  async deleteBrand(id: string): Promise<boolean> {
    // cascade: remove brand_accounts first
    await this.db.delete(brandAccounts).where(eq(brandAccounts.brandId, id));
    const result = await this.db.delete(brands).where(eq(brands.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async addAccountToBrand(brandId: string, accountId: string): Promise<BrandAccount> {
    // upsert via ON CONFLICT DO NOTHING then re-fetch
    await this.db
      .insert(brandAccounts)
      .values({ brandId, accountId } as typeof brandAccounts.$inferInsert)
      .onConflictDoNothing();
    const rows = await this.db
      .select()
      .from(brandAccounts)
      .where(eq(brandAccounts.brandId, brandId))
      .limit(100);
    const match = (rows as BrandAccount[]).find((ba) => ba.accountId === accountId);
    if (!match) throw new Error("addAccountToBrand: could not find inserted row");
    return match;
  }

  async removeAccountFromBrand(brandId: string, accountId: string): Promise<boolean> {
    const result = await this.db
      .delete(brandAccounts)
      .where(eq(brandAccounts.brandId, brandId));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Suggestion Engine ──────────────────────────────────────────────────────

  async getSuggestions(userId: string, status?: string): Promise<SuggestedPost[]> {
    const rows = await this.db
      .select()
      .from(suggestedPosts)
      .where(eq(suggestedPosts.userId, userId))
      .orderBy(desc(suggestedPosts.createdAt));
    return status ? rows.filter((r) => r.status === status) : rows;
  }

  async getSuggestion(id: string, userId: string): Promise<SuggestedPost | undefined> {
    const rows = await this.db
      .select()
      .from(suggestedPosts)
      .where(and(eq(suggestedPosts.id, id), eq(suggestedPosts.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async createSuggestedPost(suggestion: InsertSuggestedPost): Promise<SuggestedPost> {
    const rows = await this.db
      .insert(suggestedPosts)
      .values(suggestion as any)
      .returning();
    if (!rows[0]) throw new Error("createSuggestedPost: no row returned");
    return rows[0];
  }

  async updateSuggestion(
    id: string,
    userId: string,
    update: Partial<Pick<SuggestedPost, 'status' | 'scheduledPostId'>>
  ): Promise<SuggestedPost | undefined> {
    const rows = await this.db
      .update(suggestedPosts)
      .set({ ...update, updatedAt: new Date() })
      .where(and(eq(suggestedPosts.id, id), eq(suggestedPosts.userId, userId)))
      .returning();
    return rows[0];
  }

  async deleteSuggestion(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(suggestedPosts)
      .where(and(eq(suggestedPosts.id, id), eq(suggestedPosts.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async deletePendingSuggestions(userId: string): Promise<void> {
    await this.db
      .delete(suggestedPosts)
      .where(and(eq(suggestedPosts.userId, userId), eq(suggestedPosts.status, 'pending')));
  }

  // ── Ad Management ──────────────────────────────────────────────────────

  private computeMetricSummary(rows: AdMetric[]): AdMetricSummary {
    const totalSpend = rows.reduce((a, m) => a + (m.spend ?? 0), 0);
    const totalImpressions = rows.reduce((a, m) => a + (m.impressions ?? 0), 0);
    const totalClicks = rows.reduce((a, m) => a + (m.clicks ?? 0), 0);
    const totalConversions = rows.reduce((a, m) => a + (m.conversions ?? 0), 0);
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";
    const avgCpm = totalImpressions > 0 ? ((totalSpend / totalImpressions) * 10).toFixed(2) : "0";
    const avgCpc = totalClicks > 0 ? (totalSpend / totalClicks / 100).toFixed(2) : "0";
    const avgRoas = totalSpend > 0 ? (totalConversions / (totalSpend / 100)).toFixed(2) : "0";
    return { totalSpend, totalImpressions, totalClicks, totalConversions, avgCtr, avgCpm, avgCpc, avgRoas };
  }

  async getAdCampaigns(userId: string): Promise<AdCampaignWithSets[]> {
    const campaigns = await this.db.select().from(adCampaigns).where(eq(adCampaigns.userId, userId));
    return Promise.all(campaigns.map(async (c) => {
      const sets = await this.db.select().from(adSets).where(eq(adSets.campaignId, c.id));
      const setsWithCreatives = await Promise.all(sets.map(async (s) => {
        const creatives = await this.db.select().from(adCreatives).where(eq(adCreatives.adSetId, s.id));
        return { ...s, creatives };
      }));
      const metrics = await this.db.select().from(adMetrics).where(eq(adMetrics.campaignId, c.id));
      return { ...c, adSets: setsWithCreatives, metrics: this.computeMetricSummary(metrics) };
    }));
  }

  async getAdCampaign(id: string, userId: string): Promise<AdCampaignWithSets | undefined> {
    const [c] = await this.db.select().from(adCampaigns).where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, userId)));
    if (!c) return undefined;
    const sets = await this.db.select().from(adSets).where(eq(adSets.campaignId, id));
    const setsWithCreatives = await Promise.all(sets.map(async (s) => {
      const creatives = await this.db.select().from(adCreatives).where(eq(adCreatives.adSetId, s.id));
      return { ...s, creatives };
    }));
    const metrics = await this.db.select().from(adMetrics).where(eq(adMetrics.campaignId, id));
    return { ...c, adSets: setsWithCreatives, metrics: this.computeMetricSummary(metrics) };
  }

  async createAdCampaign(campaign: InsertAdCampaign): Promise<AdCampaign> {
    const [c] = await this.db.insert(adCampaigns).values({
      ...campaign,
      startDate: campaign.startDate ? new Date(campaign.startDate) : null,
      endDate: campaign.endDate ? new Date(campaign.endDate) : null,
    } as any).returning();
    return c;
  }

  async updateAdCampaign(id: string, userId: string, update: Partial<InsertAdCampaign>): Promise<AdCampaign | undefined> {
    const [c] = await this.db.update(adCampaigns)
      .set({ ...update as any, updatedAt: new Date() })
      .where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, userId)))
      .returning();
    return c;
  }

  async deleteAdCampaign(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(adCampaigns)
      .where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getAdSets(campaignId: string, userId: string): Promise<AdSet[]> {
    return this.db.select().from(adSets).where(and(eq(adSets.campaignId, campaignId), eq(adSets.userId, userId)));
  }

  async getAdSet(id: string, userId: string): Promise<AdSet | undefined> {
    const [s] = await this.db.select().from(adSets).where(and(eq(adSets.id, id), eq(adSets.userId, userId)));
    return s;
  }

  async createAdSet(adSet: InsertAdSet): Promise<AdSet> {
    const [s] = await this.db.insert(adSets).values({
      ...adSet,
      startDate: adSet.startDate ? new Date(adSet.startDate) : null,
      endDate: adSet.endDate ? new Date(adSet.endDate) : null,
    } as any).returning();
    return s;
  }

  async updateAdSet(id: string, userId: string, update: Partial<InsertAdSet>): Promise<AdSet | undefined> {
    const [s] = await this.db.update(adSets)
      .set({ ...update as any, updatedAt: new Date() })
      .where(and(eq(adSets.id, id), eq(adSets.userId, userId)))
      .returning();
    return s;
  }

  async deleteAdSet(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(adSets).where(and(eq(adSets.id, id), eq(adSets.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getAdCreatives(adSetId: string, userId: string): Promise<AdCreative[]> {
    return this.db.select().from(adCreatives).where(and(eq(adCreatives.adSetId, adSetId), eq(adCreatives.userId, userId)));
  }

  async getAdCreative(id: string, userId: string): Promise<AdCreative | undefined> {
    const [c] = await this.db.select().from(adCreatives).where(and(eq(adCreatives.id, id), eq(adCreatives.userId, userId)));
    return c;
  }

  async createAdCreative(creative: InsertAdCreative): Promise<AdCreative> {
    const [c] = await this.db.insert(adCreatives).values(creative as any).returning();
    return c;
  }

  async updateAdCreative(id: string, userId: string, update: Partial<InsertAdCreative>): Promise<AdCreative | undefined> {
    const [c] = await this.db.update(adCreatives)
      .set({ ...update as any, updatedAt: new Date() })
      .where(and(eq(adCreatives.id, id), eq(adCreatives.userId, userId)))
      .returning();
    return c;
  }

  async deleteAdCreative(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(adCreatives).where(and(eq(adCreatives.id, id), eq(adCreatives.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getAdMetrics(campaignId: string, userId: string): Promise<AdMetric[]> {
    return this.db.select().from(adMetrics).where(and(eq(adMetrics.campaignId, campaignId), eq(adMetrics.userId, userId)));
  }

  async createAdMetric(metric: InsertAdMetric): Promise<AdMetric> {
    const [m] = await this.db.insert(adMetrics).values(metric as any).returning();
    return m;
  }

  async getAdMetricSummary(campaignId: string, userId: string): Promise<AdMetricSummary> {
    const rows = await this.db.select().from(adMetrics)
      .where(and(eq(adMetrics.campaignId, campaignId), eq(adMetrics.userId, userId)));
    return this.computeMetricSummary(rows);
  }

  // ── Newsletter ─────────────────────────────────────────────────────────────

  async getNewsletterSubscribers(userId: string): Promise<NewsletterSubscriber[]> {
    return this.db.select().from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.userId, userId))
      .orderBy(desc(newsletterSubscribers.subscribedAt));
  }

  async getNewsletterSubscriber(id: string, userId: string): Promise<NewsletterSubscriber | undefined> {
    const [row] = await this.db.select().from(newsletterSubscribers)
      .where(and(eq(newsletterSubscribers.id, id), eq(newsletterSubscribers.userId, userId))).limit(1);
    return row;
  }

  async createNewsletterSubscriber(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    const [row] = await this.db.insert(newsletterSubscribers).values(subscriber as any).returning();
    return row;
  }

  async updateNewsletterSubscriber(id: string, userId: string, updates: Partial<InsertNewsletterSubscriber>): Promise<NewsletterSubscriber | undefined> {
    const extra: Record<string, any> = {};
    if (updates.status === 'unsubscribed') extra.unsubscribedAt = new Date();
    const [row] = await this.db.update(newsletterSubscribers)
      .set({ ...updates as any, ...extra })
      .where(and(eq(newsletterSubscribers.id, id), eq(newsletterSubscribers.userId, userId)))
      .returning();
    return row;
  }

  async deleteNewsletterSubscriber(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(newsletterSubscribers)
      .where(and(eq(newsletterSubscribers.id, id), eq(newsletterSubscribers.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async bulkImportNewsletterSubscribers(userId: string, subscribers: InsertNewsletterSubscriber[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0; let skipped = 0;
    for (const sub of subscribers) {
      try {
        await this.db.insert(newsletterSubscribers).values({ ...sub as any, userId });
        imported++;
      } catch (e: any) {
        if (e?.code === '23505') { skipped++; } else { throw e; }
      }
    }
    return { imported, skipped };
  }

  async getNewsletters(userId: string): Promise<Newsletter[]> {
    return this.db.select().from(newsletters)
      .where(eq(newsletters.userId, userId))
      .orderBy(desc(newsletters.createdAt));
  }

  async getNewsletter(id: string, userId: string): Promise<Newsletter | undefined> {
    const [row] = await this.db.select().from(newsletters)
      .where(and(eq(newsletters.id, id), eq(newsletters.userId, userId))).limit(1);
    return row;
  }

  async createNewsletter(newsletter: InsertNewsletter): Promise<Newsletter> {
    const [row] = await this.db.insert(newsletters).values(newsletter as any).returning();
    return row;
  }

  async updateNewsletter(id: string, userId: string, updates: Partial<InsertNewsletter>): Promise<Newsletter | undefined> {
    const [row] = await this.db.update(newsletters)
      .set({ ...updates as any, updatedAt: new Date() })
      .where(and(eq(newsletters.id, id), eq(newsletters.userId, userId)))
      .returning();
    return row;
  }

  async deleteNewsletter(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(newsletters)
      .where(and(eq(newsletters.id, id), eq(newsletters.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async sendNewsletter(id: string, userId: string, recipientCount: number): Promise<Newsletter> {
    const [row] = await this.db.update(newsletters)
      .set({ status: 'sent', sentAt: new Date(), recipientCount, updatedAt: new Date() })
      .where(and(eq(newsletters.id, id), eq(newsletters.userId, userId)))
      .returning();
    if (!row) throw new Error('Newsletter not found');
    return row;
  }
}
