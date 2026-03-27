import {
  type User,
  type InsertUser,
  type Post,
  type InsertPost,
  type SocialAccount,
  type InsertSocialAccount,
  type Brand,
  type InsertBrand,
  type BrandAccount,
  type InsertBrandAccount,
  type BrandWithAccounts,
  type DashboardStats,
  type ChartDataPoint,
  type SuggestedPost,
  type InsertSuggestedPost,
  type SuggestionStatus,
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
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getPosts(userId?: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: string, post: Partial<InsertPost> & { publishedAt?: Date | null; publishResults?: Record<string, any>; platformMetadata?: Record<string, any> }): Promise<Post | undefined>;
  deletePost(id: string): Promise<boolean>;
  getRecentPosts(userId?: string, limit?: number): Promise<Post[]>;

  getAccounts(userId?: string): Promise<SocialAccount[]>;
  getAccount(id: string): Promise<SocialAccount | undefined>;
  createAccount(account: InsertSocialAccount): Promise<SocialAccount>;
  updateAccount(id: string, account: Partial<InsertSocialAccount>): Promise<SocialAccount | undefined>;
  deleteAccount(id: string): Promise<boolean>;
  createOrUpdateSocialAccount(account: InsertSocialAccount): Promise<SocialAccount>;

  getDashboardStats(userId?: string): Promise<DashboardStats>;
  getChartData(userId?: string): Promise<ChartDataPoint[]>;

  // Brands
  getBrands(userId: string): Promise<BrandWithAccounts[]>;
  getBrand(id: string): Promise<BrandWithAccounts | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, brand: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<boolean>;
  addAccountToBrand(brandId: string, accountId: string): Promise<BrandAccount>;
  removeAccountFromBrand(brandId: string, accountId: string): Promise<boolean>;

  // Suggestion Engine
  getSuggestions(userId: string, status?: string): Promise<SuggestedPost[]>;
  getSuggestion(id: string, userId: string): Promise<SuggestedPost | undefined>;
  createSuggestedPost(suggestion: InsertSuggestedPost): Promise<SuggestedPost>;
  updateSuggestion(id: string, userId: string, update: Partial<Pick<SuggestedPost, 'status' | 'scheduledPostId'>>): Promise<SuggestedPost | undefined>;
  deleteSuggestion(id: string, userId: string): Promise<boolean>;
  deletePendingSuggestions(userId: string): Promise<void>;

  // Ad Management
  getAdCampaigns(userId: string): Promise<AdCampaignWithSets[]>;
  getAdCampaign(id: string, userId: string): Promise<AdCampaignWithSets | undefined>;
  createAdCampaign(campaign: InsertAdCampaign): Promise<AdCampaign>;
  updateAdCampaign(id: string, userId: string, update: Partial<InsertAdCampaign>): Promise<AdCampaign | undefined>;
  deleteAdCampaign(id: string, userId: string): Promise<boolean>;

  getAdSets(campaignId: string, userId: string): Promise<AdSet[]>;
  getAdSet(id: string, userId: string): Promise<AdSet | undefined>;
  createAdSet(adSet: InsertAdSet): Promise<AdSet>;
  updateAdSet(id: string, userId: string, update: Partial<InsertAdSet>): Promise<AdSet | undefined>;
  deleteAdSet(id: string, userId: string): Promise<boolean>;

  getAdCreatives(adSetId: string, userId: string): Promise<AdCreative[]>;
  getAdCreative(id: string, userId: string): Promise<AdCreative | undefined>;
  createAdCreative(creative: InsertAdCreative): Promise<AdCreative>;
  updateAdCreative(id: string, userId: string, update: Partial<InsertAdCreative>): Promise<AdCreative | undefined>;
  deleteAdCreative(id: string, userId: string): Promise<boolean>;

  getAdMetrics(campaignId: string, userId: string): Promise<AdMetric[]>;
  createAdMetric(metric: InsertAdMetric): Promise<AdMetric>;
  getAdMetricSummary(campaignId: string, userId: string): Promise<AdMetricSummary>;

  // Newsletter
  getNewsletterSubscribers(userId: string): Promise<NewsletterSubscriber[]>;
  getNewsletterSubscriber(id: string, userId: string): Promise<NewsletterSubscriber | undefined>;
  createNewsletterSubscriber(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber>;
  updateNewsletterSubscriber(id: string, userId: string, updates: Partial<InsertNewsletterSubscriber>): Promise<NewsletterSubscriber | undefined>;
  deleteNewsletterSubscriber(id: string, userId: string): Promise<boolean>;
  bulkImportNewsletterSubscribers(userId: string, subscribers: InsertNewsletterSubscriber[]): Promise<{ imported: number; skipped: number }>;

  getNewsletters(userId: string): Promise<Newsletter[]>;
  getNewsletter(id: string, userId: string): Promise<Newsletter | undefined>;
  createNewsletter(newsletter: InsertNewsletter): Promise<Newsletter>;
  updateNewsletter(id: string, userId: string, updates: Partial<InsertNewsletter>): Promise<Newsletter | undefined>;
  deleteNewsletter(id: string, userId: string): Promise<boolean>;
  sendNewsletter(id: string, userId: string, recipientCount: number): Promise<Newsletter>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private posts: Map<string, Post>;
  private accounts: Map<string, SocialAccount>;
  private brands: Map<string, Brand>;
  private brandAccounts: Map<string, BrandAccount>;
  private suggestedPosts: Map<string, SuggestedPost>;
  private adCampaigns: Map<string, AdCampaign>;
  private adSets: Map<string, AdSet>;
  private adCreatives: Map<string, AdCreative>;
  private adMetrics: Map<string, AdMetric>;
  private newsletterSubscribers: Map<string, NewsletterSubscriber>;
  private newsletters: Map<string, Newsletter>;

  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.accounts = new Map();
    this.brands = new Map();
    this.brandAccounts = new Map();
    this.suggestedPosts = new Map();
    this.adCampaigns = new Map();
    this.adSets = new Map();
    this.adCreatives = new Map();
    this.adMetrics = new Map();
    this.newsletterSubscribers = new Map();
    this.newsletters = new Map();

    this.seedData();
  }

  private seedData() {
    const demoUserId = "demo-user";

    this.users.set(demoUserId, {
      id: demoUserId,
      name: "Maya Martinez",
      username: "maya.martinez",
      password: "hashed_password",
      email: "maya@company.com",
      avatar: null,
      createdAt: new Date(),
    });

    const now = new Date();
    const accounts: SocialAccount[] = [
      {
        id: randomUUID(),
        userId: demoUserId,
        platform: "instagram",
        accountName: "BrandHub Official",
        accountHandle: "brandhub_official",
        avatarUrl: null,
        accessToken: null,
        platformUserId: "brandhub_official",
        refreshToken: null,
        tokenExpiresAt: null,
        isConnected: true,
        followers: 24500,
        engagement: "4.2%",
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        platform: "twitter",
        accountName: "BrandHub",
        accountHandle: "BrandHub",
        avatarUrl: null,
        accessToken: null,
        platformUserId: "BrandHub",
        refreshToken: null,
        tokenExpiresAt: null,
        isConnected: true,
        followers: 18200,
        engagement: "2.8%",
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        platform: "linkedin",
        accountName: "BrandHub Inc",
        accountHandle: "brandhub-inc",
        avatarUrl: null,
        accessToken: null,
        platformUserId: "brandhub-inc",
        refreshToken: null,
        tokenExpiresAt: null,
        isConnected: true,
        followers: 12800,
        engagement: "5.1%",
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        platform: "facebook",
        accountName: "BrandHub",
        accountHandle: "BrandHubOfficial",
        avatarUrl: null,
        accessToken: null,
        platformUserId: "BrandHubOfficial",
        refreshToken: null,
        tokenExpiresAt: null,
        isConnected: true,
        followers: 35600,
        engagement: "3.5%",
      },
    ];

    accounts.forEach((account) => this.accounts.set(account.id, account));

    const posts: Post[] = [
      {
        id: randomUUID(),
        userId: demoUserId,
        content: "Exciting news! We're thrilled to announce our latest product update that's going to revolutionize how you work. Stay tuned for more details! #innovation #product #launch",
        mediaUrls: null,
        platforms: ["instagram", "facebook", "linkedin"],
        status: "published",
        scheduledAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        hashtags: ["innovation", "product", "launch"],
        reach: 12450,
        impressions: 18200,
        engagement: 892,
        clicks: 234,
        publishResults: null,
        platformMetadata: null,
        brandId: null,
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        content: "Behind every great product is an incredible team. Today we celebrate our amazing people who make the magic happen every day. #teamwork #culture",
        mediaUrls: null,
        platforms: ["linkedin", "twitter"],
        status: "published",
        scheduledAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        publishedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        hashtags: ["teamwork", "culture"],
        reach: 8920,
        impressions: 14500,
        engagement: 567,
        clicks: 145,
        publishResults: null,
        platformMetadata: null,
        brandId: null,
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        content: "Your feedback drives our innovation. Thank you to our community for helping us build something truly special. #community #gratitude",
        mediaUrls: null,
        platforms: ["instagram", "twitter", "facebook"],
        status: "scheduled",
        scheduledAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
        publishedAt: null,
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        hashtags: ["community", "gratitude"],
        reach: 0,
        impressions: 0,
        engagement: 0,
        clicks: 0,
        publishResults: null,
        platformMetadata: null,
        brandId: null,
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        content: "Tips for maximizing your productivity this week: 1. Set clear goals 2. Time block your tasks 3. Take regular breaks. What's your top productivity tip? #productivity #tips",
        mediaUrls: null,
        platforms: ["linkedin"],
        status: "scheduled",
        scheduledAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
        publishedAt: null,
        createdAt: new Date(),
        hashtags: ["productivity", "tips"],
        reach: 0,
        impressions: 0,
        engagement: 0,
        clicks: 0,
        publishResults: null,
        platformMetadata: null,
        brandId: null,
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        content: "New blog post: How to create engaging social media content that converts. Link in bio! #marketing #socialmedia #content",
        mediaUrls: null,
        platforms: ["instagram", "facebook"],
        status: "scheduled",
        scheduledAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
        publishedAt: null,
        createdAt: new Date(),
        hashtags: ["marketing", "socialmedia", "content"],
        reach: 0,
        impressions: 0,
        engagement: 0,
        clicks: 0,
        publishResults: null,
        platformMetadata: null,
        brandId: null,
      },
      {
        id: randomUUID(),
        userId: demoUserId,
        content: "Draft post about upcoming webinar - needs review and final images",
        mediaUrls: null,
        platforms: ["linkedin", "twitter"],
        status: "draft",
        scheduledAt: null,
        publishedAt: null,
        createdAt: new Date(),
        hashtags: ["webinar"],
        reach: 0,
        impressions: 0,
        engagement: 0,
        clicks: 0,
        publishResults: null,
        platformMetadata: null,
        brandId: null,
      },
    ];

    posts.forEach((post) => this.posts.set(post.id, post));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      avatar: insertUser.avatar ?? null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getPosts(userId?: string): Promise<Post[]> {
    const posts = Array.from(this.posts.values());
    if (userId) {
      return posts.filter((post) => post.userId === userId);
    }
    return posts.sort((a, b) => {
      const dateA = a.scheduledAt || a.createdAt;
      const dateB = b.scheduledAt || b.createdAt;
      return new Date(dateB!).getTime() - new Date(dateA!).getTime();
    });
  }

  async getPost(id: string): Promise<Post | undefined> {
    return this.posts.get(id);
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = randomUUID();
    const post: Post = {
      id,
      userId: insertPost.userId,
      content: insertPost.content,
      mediaUrls: insertPost.mediaUrls ?? null,
      platforms: insertPost.platforms as Post["platforms"],
      status: (insertPost.status || "draft") as Post["status"],
      scheduledAt: insertPost.scheduledAt ?? null,
      publishedAt: null,
      createdAt: new Date(),
      hashtags: insertPost.hashtags ?? null,
      reach: 0,
      impressions: 0,
      engagement: 0,
      clicks: 0,
      publishResults: null,
      platformMetadata: null,
      brandId: (insertPost as any).brandId ?? null,
    };
    this.posts.set(id, post);
    return post;
  }

  async updatePost(id: string, updates: Partial<InsertPost> & { publishedAt?: Date | null; publishResults?: Record<string, any>; platformMetadata?: Record<string, any> }): Promise<Post | undefined> {
    const post = this.posts.get(id);
    if (!post) return undefined;

    const updated: Post = {
      ...post,
      content: updates.content !== undefined ? updates.content : post.content,
      mediaUrls: updates.mediaUrls !== undefined ? updates.mediaUrls : post.mediaUrls,
      platforms:
        updates.platforms !== undefined
          ? (updates.platforms as Post["platforms"])
          : post.platforms,
      status:
        updates.status !== undefined
          ? (updates.status as Post["status"])
          : post.status,
      scheduledAt:
        updates.scheduledAt !== undefined ? updates.scheduledAt : post.scheduledAt,
      hashtags: updates.hashtags !== undefined ? updates.hashtags : post.hashtags,
      publishedAt: (updates as any).publishedAt !== undefined ? (updates as any).publishedAt : post.publishedAt,
      publishResults: (updates as any).publishResults !== undefined ? (updates as any).publishResults : (post as any).publishResults,
      platformMetadata: (updates as any).platformMetadata !== undefined ? (updates as any).platformMetadata : (post as any).platformMetadata,
    };
    this.posts.set(id, updated);
    return updated;
  }

  async deletePost(id: string): Promise<boolean> {
    return this.posts.delete(id);
  }

  async getRecentPosts(userId?: string, limit: number = 10): Promise<Post[]> {
    const posts = await this.getPosts(userId);
    return posts.slice(0, limit);
  }

  async getAccounts(userId?: string): Promise<SocialAccount[]> {
    const accounts = Array.from(this.accounts.values());
    if (userId) {
      return accounts.filter((account) => account.userId === userId);
    }
    return accounts;
  }

  async getAccount(id: string): Promise<SocialAccount | undefined> {
    return this.accounts.get(id);
  }

  async createAccount(insertAccount: InsertSocialAccount): Promise<SocialAccount> {
    const id = randomUUID();
    const account: SocialAccount = {
      id,
      userId: insertAccount.userId,
      platform: insertAccount.platform as SocialAccount["platform"],
      accountName: insertAccount.accountName,
      accountHandle: insertAccount.accountHandle,
      avatarUrl: insertAccount.avatarUrl ?? null,
      accessToken: insertAccount.accessToken ?? null,
      platformUserId: insertAccount.platformUserId,
      refreshToken: insertAccount.refreshToken ?? null,
      tokenExpiresAt: insertAccount.tokenExpiresAt ?? null,
      isConnected: insertAccount.isConnected ?? true,
      followers: insertAccount.followers ?? 0,
      engagement: insertAccount.engagement ?? "0%",
    };
    this.accounts.set(id, account);
    return account;
  }

  async updateAccount(id: string, updates: Partial<InsertSocialAccount>): Promise<SocialAccount | undefined> {
    const account = this.accounts.get(id);
    if (!account) return undefined;

    const updated: SocialAccount = {
      ...account,
      platform:
        updates.platform !== undefined
          ? (updates.platform as SocialAccount["platform"])
          : account.platform,
      accountName:
        updates.accountName !== undefined ? updates.accountName : account.accountName,
      accountHandle:
        updates.accountHandle !== undefined
          ? updates.accountHandle
          : account.accountHandle,
      avatarUrl:
        updates.avatarUrl !== undefined ? updates.avatarUrl : account.avatarUrl,
      accessToken:
        updates.accessToken !== undefined ? updates.accessToken : account.accessToken,
      platformUserId:
        updates.platformUserId !== undefined
          ? updates.platformUserId
          : account.platformUserId,
      refreshToken:
        updates.refreshToken !== undefined
          ? updates.refreshToken
          : account.refreshToken,
      tokenExpiresAt:
        updates.tokenExpiresAt !== undefined ? updates.tokenExpiresAt : account.tokenExpiresAt,
      isConnected:
        updates.isConnected !== undefined ? updates.isConnected : account.isConnected,
      followers:
        updates.followers !== undefined ? updates.followers : account.followers,
      engagement:
        updates.engagement !== undefined ? updates.engagement : account.engagement,
    };
    this.accounts.set(id, updated);
    return updated;
  }

  async createOrUpdateSocialAccount(insertAccount: InsertSocialAccount): Promise<SocialAccount> {
    const existing = Array.from(this.accounts.values()).find(
      (account) =>
        account.userId === insertAccount.userId &&
        account.platform === insertAccount.platform &&
        account.platformUserId === insertAccount.platformUserId,
    );

    if (existing) {
      const updated: SocialAccount = {
        ...existing,
        accountName: insertAccount.accountName ?? existing.accountName,
        accountHandle: insertAccount.accountHandle ?? existing.accountHandle,
        avatarUrl: insertAccount.avatarUrl ?? existing.avatarUrl,
        accessToken: insertAccount.accessToken ?? existing.accessToken,
        refreshToken:
          insertAccount.refreshToken !== undefined ? insertAccount.refreshToken : existing.refreshToken,
        tokenExpiresAt: insertAccount.tokenExpiresAt !== undefined ? insertAccount.tokenExpiresAt : existing.tokenExpiresAt,
        isConnected: insertAccount.isConnected ?? existing.isConnected,
        followers: insertAccount.followers ?? existing.followers,
        engagement: insertAccount.engagement ?? existing.engagement,
      };

      this.accounts.set(existing.id, updated);
      return updated;
    }

    return this.createAccount(insertAccount);
  }

  async deleteAccount(id: string): Promise<boolean> {
    return this.accounts.delete(id);
  }

  async getDashboardStats(userId?: string): Promise<DashboardStats> {
    const posts = await this.getPosts(userId);
    const accounts = await this.getAccounts(userId);

    const publishedPosts = posts.filter((p) => p.status === "published");
    const scheduledPosts = posts.filter((p) => p.status === "scheduled");

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
      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      data.push({
        date: dateStr,
        reach: Math.floor(Math.random() * 5000) + 8000,
        engagement: Math.floor(Math.random() * 500) + 400,
        impressions: Math.floor(Math.random() * 8000) + 12000,
      });
    }

    return data;
  }

  // ─── Brands ────────────────────────────────────────────────────────────────

  private async resolveBrandAccounts(brandId: string): Promise<SocialAccount[]> {
    const memberIds = Array.from(this.brandAccounts.values())
      .filter((ba) => ba.brandId === brandId)
      .map((ba) => ba.accountId);
    return memberIds
      .map((id) => this.accounts.get(id))
      .filter((a): a is SocialAccount => a !== undefined);
  }

  async getBrands(userId: string): Promise<BrandWithAccounts[]> {
    const userBrands = Array.from(this.brands.values()).filter((b) => b.userId === userId);
    return Promise.all(
      userBrands.map(async (b) => ({ ...b, accounts: await this.resolveBrandAccounts(b.id) }))
    );
  }

  async getBrand(id: string): Promise<BrandWithAccounts | undefined> {
    const brand = this.brands.get(id);
    if (!brand) return undefined;
    return { ...brand, accounts: await this.resolveBrandAccounts(id) };
  }

  async createBrand(insertBrand: InsertBrand): Promise<Brand> {
    const id = randomUUID();
    const brand: Brand = {
      id,
      userId: insertBrand.userId,
      name: insertBrand.name,
      description: insertBrand.description ?? null,
      color: insertBrand.color ?? "#6366f1",
      logoUrl: insertBrand.logoUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.brands.set(id, brand);
    return brand;
  }

  async updateBrand(id: string, updates: Partial<InsertBrand>): Promise<Brand | undefined> {
    const brand = this.brands.get(id);
    if (!brand) return undefined;
    const updated: Brand = {
      ...brand,
      name: updates.name ?? brand.name,
      description: updates.description !== undefined ? (updates.description ?? null) : brand.description,
      color: updates.color ?? brand.color,
      logoUrl: updates.logoUrl !== undefined ? (updates.logoUrl ?? null) : brand.logoUrl,
      updatedAt: new Date(),
    };
    this.brands.set(id, updated);
    return updated;
  }

  async deleteBrand(id: string): Promise<boolean> {
    if (!this.brands.has(id)) return false;
    this.brands.delete(id);
    // cascade-delete brand_accounts
    for (const [baId, ba] of Array.from(this.brandAccounts.entries())) {
      if (ba.brandId === id) this.brandAccounts.delete(baId);
    }
    return true;
  }

  async addAccountToBrand(brandId: string, accountId: string): Promise<BrandAccount> {
    // idempotent
    const existing = Array.from(this.brandAccounts.values()).find(
      (ba) => ba.brandId === brandId && ba.accountId === accountId
    );
    if (existing) return existing;
    const id = randomUUID();
    const ba: BrandAccount = { id, brandId, accountId };
    this.brandAccounts.set(id, ba);
    return ba;
  }

  async removeAccountFromBrand(brandId: string, accountId: string): Promise<boolean> {
    for (const [id, ba] of Array.from(this.brandAccounts.entries())) {
      if (ba.brandId === brandId && ba.accountId === accountId) {
        this.brandAccounts.delete(id);
        return true;
      }
    }
    return false;
  }

  // ── Suggestion Engine ──────────────────────────────────────────────────────

  async getSuggestions(userId: string, status?: string): Promise<SuggestedPost[]> {
    return Array.from(this.suggestedPosts.values())
      .filter((s) => s.userId === userId && (!status || s.status === status))
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getSuggestion(id: string, userId: string): Promise<SuggestedPost | undefined> {
    const s = this.suggestedPosts.get(id);
    return s && s.userId === userId ? s : undefined;
  }

  async createSuggestedPost(suggestion: InsertSuggestedPost): Promise<SuggestedPost> {
    const id = randomUUID();
    const now = new Date();
    const validTypes = ["new_post", "follow_up", "comment_reply"] as const;
    const s: SuggestedPost = {
      id,
      ...suggestion,
      type: (validTypes.includes(suggestion.type as any) ? suggestion.type : "new_post") as "new_post" | "follow_up" | "comment_reply",
      platforms: suggestion.platforms as any,
      status: (suggestion.status ?? "pending") as "pending" | "accepted" | "dismissed" | "scheduled",
      sourcePostId: suggestion.sourcePostId ?? null,
      hashtags: suggestion.hashtags ?? null,
      reasoning: suggestion.reasoning ?? null,
      suggestedTime: suggestion.suggestedTime ?? null,
      suggestedDayOfWeek: suggestion.suggestedDayOfWeek ?? null,
      suggestedHour: suggestion.suggestedHour ?? null,
      confidenceScore: suggestion.confidenceScore ?? 70,
      engagementPrediction: suggestion.engagementPrediction ?? null,
      scheduledPostId: suggestion.scheduledPostId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.suggestedPosts.set(id, s);
    return s;
  }

  async updateSuggestion(
    id: string,
    userId: string,
    update: Partial<Pick<SuggestedPost, 'status' | 'scheduledPostId'>>
  ): Promise<SuggestedPost | undefined> {
    const s = this.suggestedPosts.get(id);
    if (!s || s.userId !== userId) return undefined;
    const updated: SuggestedPost = { ...s, ...update, updatedAt: new Date() };
    this.suggestedPosts.set(id, updated);
    return updated;
  }

  async deleteSuggestion(id: string, userId: string): Promise<boolean> {
    const s = this.suggestedPosts.get(id);
    if (!s || s.userId !== userId) return false;
    this.suggestedPosts.delete(id);
    return true;
  }

  async deletePendingSuggestions(userId: string): Promise<void> {
    for (const [id, s] of Array.from(this.suggestedPosts.entries())) {
      if (s.userId === userId && s.status === 'pending') {
        this.suggestedPosts.delete(id);
      }
    }
  }

  // ── Ad Management ──────────────────────────────────────────────────────

  private buildCampaignWithSets(campaign: AdCampaign): AdCampaignWithSets {
    const sets = Array.from(this.adSets.values())
      .filter((s) => s.campaignId === campaign.id)
      .map((s) => ({
        ...s,
        creatives: Array.from(this.adCreatives.values()).filter((c) => c.adSetId === s.id),
      }));
    const metrics = this.computeMetricSummary(campaign.id);
    return { ...campaign, adSets: sets, metrics };
  }

  private computeMetricSummary(campaignId: string): AdMetricSummary {
    const rows = Array.from(this.adMetrics.values()).filter((m) => m.campaignId === campaignId);
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
    return Array.from(this.adCampaigns.values())
      .filter((c) => c.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .map((c) => this.buildCampaignWithSets(c));
  }

  async getAdCampaign(id: string, userId: string): Promise<AdCampaignWithSets | undefined> {
    const c = this.adCampaigns.get(id);
    if (!c || c.userId !== userId) return undefined;
    return this.buildCampaignWithSets(c);
  }

  async createAdCampaign(campaign: InsertAdCampaign): Promise<AdCampaign> {
    const id = randomUUID();
    const now = new Date();
    const c: AdCampaign = {
      id,
      ...campaign,
      platform: (campaign.platform ?? "facebook") as AdCampaign["platform"],
      objective: (campaign.objective ?? "awareness") as AdCampaign["objective"],
      status: (campaign.status ?? "draft") as AdCampaign["status"],
      totalBudget: campaign.totalBudget ?? 0,
      dailyBudget: campaign.dailyBudget ?? 0,
      currency: campaign.currency ?? "USD",
      brandId: campaign.brandId ?? null,
      platformCampaignId: campaign.platformCampaignId ?? null,
      notes: campaign.notes ?? null,
      startDate: campaign.startDate ? new Date(campaign.startDate) : null,
      endDate: campaign.endDate ? new Date(campaign.endDate) : null,
      createdAt: now,
      updatedAt: now,
    };
    this.adCampaigns.set(id, c);
    return c;
  }

  async updateAdCampaign(id: string, userId: string, update: Partial<InsertAdCampaign>): Promise<AdCampaign | undefined> {
    const c = this.adCampaigns.get(id);
    if (!c || c.userId !== userId) return undefined;
    const updated: AdCampaign = { ...c, ...update as any, updatedAt: new Date() };
    this.adCampaigns.set(id, updated);
    return updated;
  }

  async deleteAdCampaign(id: string, userId: string): Promise<boolean> {
    const c = this.adCampaigns.get(id);
    if (!c || c.userId !== userId) return false;
    this.adCampaigns.delete(id);
    // cascade delete ad sets and creatives
    for (const [sid, s] of Array.from(this.adSets.entries())) {
      if (s.campaignId === id) {
        for (const [cid, cr] of Array.from(this.adCreatives.entries())) {
          if (cr.adSetId === sid) this.adCreatives.delete(cid);
        }
        this.adSets.delete(sid);
      }
    }
    return true;
  }

  async getAdSets(campaignId: string, userId: string): Promise<AdSet[]> {
    return Array.from(this.adSets.values()).filter(
      (s) => s.campaignId === campaignId && s.userId === userId
    );
  }

  async getAdSet(id: string, userId: string): Promise<AdSet | undefined> {
    const s = this.adSets.get(id);
    return s && s.userId === userId ? s : undefined;
  }

  async createAdSet(adSet: InsertAdSet): Promise<AdSet> {
    const id = randomUUID();
    const now = new Date();
    const s: AdSet = {
      id,
      ...adSet,
      status: (adSet.status ?? "draft") as any,
      targeting: (adSet.targeting ?? null) as AdSet["targeting"],
      placement: adSet.placement ?? null,
      bidStrategy: (adSet.bidStrategy ?? "lowest_cost") as any,
      bidAmount: adSet.bidAmount ?? 0,
      dailyBudget: adSet.dailyBudget ?? 0,
      platformAdSetId: adSet.platformAdSetId ?? null,
      startDate: adSet.startDate ? new Date(adSet.startDate) : null,
      endDate: adSet.endDate ? new Date(adSet.endDate) : null,
      createdAt: now,
      updatedAt: now,
    };
    this.adSets.set(id, s);
    return s;
  }

  async updateAdSet(id: string, userId: string, update: Partial<InsertAdSet>): Promise<AdSet | undefined> {
    const s = this.adSets.get(id);
    if (!s || s.userId !== userId) return undefined;
    const updated: AdSet = { ...s, ...update as any, updatedAt: new Date() };
    this.adSets.set(id, updated);
    return updated;
  }

  async deleteAdSet(id: string, userId: string): Promise<boolean> {
    const s = this.adSets.get(id);
    if (!s || s.userId !== userId) return false;
    this.adSets.delete(id);
    for (const [cid, cr] of Array.from(this.adCreatives.entries())) {
      if (cr.adSetId === id) this.adCreatives.delete(cid);
    }
    return true;
  }

  async getAdCreatives(adSetId: string, userId: string): Promise<AdCreative[]> {
    return Array.from(this.adCreatives.values()).filter(
      (c) => c.adSetId === adSetId && c.userId === userId
    );
  }

  async getAdCreative(id: string, userId: string): Promise<AdCreative | undefined> {
    const c = this.adCreatives.get(id);
    return c && c.userId === userId ? c : undefined;
  }

  async createAdCreative(creative: InsertAdCreative): Promise<AdCreative> {
    const id = randomUUID();
    const now = new Date();
    const c: AdCreative = {
      id,
      ...creative,
      format: (creative.format ?? "image") as any,
      status: (creative.status ?? "draft") as any,
      headline: creative.headline ?? null,
      bodyText: creative.bodyText ?? null,
      callToAction: creative.callToAction ?? null,
      destinationUrl: creative.destinationUrl ?? null,
      mediaUrl: creative.mediaUrl ?? null,
      mediaUrls: creative.mediaUrls ?? null,
      platformCreativeId: creative.platformCreativeId ?? null,
      previewUrl: creative.previewUrl ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.adCreatives.set(id, c);
    return c;
  }

  async updateAdCreative(id: string, userId: string, update: Partial<InsertAdCreative>): Promise<AdCreative | undefined> {
    const c = this.adCreatives.get(id);
    if (!c || c.userId !== userId) return undefined;
    const updated: AdCreative = { ...c, ...update as any, updatedAt: new Date() };
    this.adCreatives.set(id, updated);
    return updated;
  }

  async deleteAdCreative(id: string, userId: string): Promise<boolean> {
    const c = this.adCreatives.get(id);
    if (!c || c.userId !== userId) return false;
    this.adCreatives.delete(id);
    return true;
  }

  async getAdMetrics(campaignId: string, userId: string): Promise<AdMetric[]> {
    return Array.from(this.adMetrics.values()).filter(
      (m) => m.campaignId === campaignId && m.userId === userId
    );
  }

  async createAdMetric(metric: InsertAdMetric): Promise<AdMetric> {
    const id = randomUUID();
    const m: AdMetric = {
      id,
      ...metric,
      adSetId: metric.adSetId ?? null,
      spend: metric.spend ?? 0,
      impressions: metric.impressions ?? 0,
      reach: metric.reach ?? 0,
      clicks: metric.clicks ?? 0,
      conversions: metric.conversions ?? 0,
      ctr: metric.ctr ?? "0",
      cpm: metric.cpm ?? "0",
      cpc: metric.cpc ?? "0",
      roas: metric.roas ?? "0",
      createdAt: new Date(),
    };
    this.adMetrics.set(id, m);
    return m;
  }

  async getAdMetricSummary(campaignId: string, userId: string): Promise<AdMetricSummary> {
    return this.computeMetricSummary(campaignId);
  }

  // ── Newsletter ─────────────────────────────────────────────────────────────

  async getNewsletterSubscribers(userId: string): Promise<NewsletterSubscriber[]> {
    return Array.from(this.newsletterSubscribers.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.subscribedAt!).getTime() - new Date(a.subscribedAt!).getTime());
  }

  async getNewsletterSubscriber(id: string, userId: string): Promise<NewsletterSubscriber | undefined> {
    const s = this.newsletterSubscribers.get(id);
    return s && s.userId === userId ? s : undefined;
  }

  async createNewsletterSubscriber(subscriber: InsertNewsletterSubscriber): Promise<NewsletterSubscriber> {
    // Check uniqueness
    const dup = Array.from(this.newsletterSubscribers.values()).find(
      (s) => s.userId === subscriber.userId && s.email === subscriber.email
    );
    if (dup) { const e: any = new Error('duplicate'); e.code = '23505'; throw e; }
    const id = randomUUID();
    const now = new Date();
    const s: NewsletterSubscriber = {
      id,
      userId: subscriber.userId,
      email: subscriber.email,
      name: subscriber.name ?? null,
      status: (subscriber.status ?? 'active') as NewsletterSubscriber['status'],
      tags: subscriber.tags ?? null,
      source: subscriber.source ?? 'manual',
      subscribedAt: now,
      unsubscribedAt: null,
    };
    this.newsletterSubscribers.set(id, s);
    return s;
  }

  async updateNewsletterSubscriber(id: string, userId: string, updates: Partial<InsertNewsletterSubscriber>): Promise<NewsletterSubscriber | undefined> {
    const s = this.newsletterSubscribers.get(id);
    if (!s || s.userId !== userId) return undefined;
    const updated: NewsletterSubscriber = {
      ...s,
      name: updates.name !== undefined ? (updates.name ?? null) : s.name,
      status: (updates.status ?? s.status) as NewsletterSubscriber['status'],
      tags: updates.tags !== undefined ? (updates.tags ?? null) : s.tags,
      unsubscribedAt: updates.status === 'unsubscribed' ? new Date() : s.unsubscribedAt,
    };
    this.newsletterSubscribers.set(id, updated);
    return updated;
  }

  async deleteNewsletterSubscriber(id: string, userId: string): Promise<boolean> {
    const s = this.newsletterSubscribers.get(id);
    if (!s || s.userId !== userId) return false;
    this.newsletterSubscribers.delete(id);
    return true;
  }

  async bulkImportNewsletterSubscribers(userId: string, subscribers: InsertNewsletterSubscriber[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0; let skipped = 0;
    for (const sub of subscribers) {
      const dup = Array.from(this.newsletterSubscribers.values()).find(
        (s) => s.userId === userId && s.email === sub.email
      );
      if (dup) { skipped++; continue; }
      await this.createNewsletterSubscriber({ ...sub, userId });
      imported++;
    }
    return { imported, skipped };
  }

  async getNewsletters(userId: string): Promise<Newsletter[]> {
    return Array.from(this.newsletters.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getNewsletter(id: string, userId: string): Promise<Newsletter | undefined> {
    const n = this.newsletters.get(id);
    return n && n.userId === userId ? n : undefined;
  }

  async createNewsletter(newsletter: InsertNewsletter): Promise<Newsletter> {
    const id = randomUUID();
    const now = new Date();
    const n: Newsletter = {
      id,
      userId: newsletter.userId,
      subject: newsletter.subject,
      previewText: newsletter.previewText ?? null,
      bodyHtml: newsletter.bodyHtml,
      bodyText: newsletter.bodyText ?? null,
      status: (newsletter.status ?? 'draft') as Newsletter['status'],
      scheduledAt: newsletter.scheduledAt ? new Date(newsletter.scheduledAt) : null,
      sentAt: null,
      recipientCount: 0,
      openCount: 0,
      clickCount: 0,
      tags: newsletter.tags ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.newsletters.set(id, n);
    return n;
  }

  async updateNewsletter(id: string, userId: string, updates: Partial<InsertNewsletter>): Promise<Newsletter | undefined> {
    const n = this.newsletters.get(id);
    if (!n || n.userId !== userId) return undefined;
    const updated: Newsletter = {
      ...n,
      subject: updates.subject ?? n.subject,
      previewText: updates.previewText !== undefined ? (updates.previewText ?? null) : n.previewText,
      bodyHtml: updates.bodyHtml ?? n.bodyHtml,
      bodyText: updates.bodyText !== undefined ? (updates.bodyText ?? null) : n.bodyText,
      status: (updates.status ?? n.status) as Newsletter['status'],
      scheduledAt: updates.scheduledAt !== undefined ? (updates.scheduledAt ? new Date(updates.scheduledAt) : null) : n.scheduledAt,
      tags: updates.tags !== undefined ? (updates.tags ?? null) : n.tags,
      updatedAt: new Date(),
    };
    this.newsletters.set(id, updated);
    return updated;
  }

  async deleteNewsletter(id: string, userId: string): Promise<boolean> {
    const n = this.newsletters.get(id);
    if (!n || n.userId !== userId) return false;
    this.newsletters.delete(id);
    return true;
  }

  async sendNewsletter(id: string, userId: string, recipientCount: number): Promise<Newsletter> {
    const n = this.newsletters.get(id);
    if (!n || n.userId !== userId) throw new Error('Newsletter not found');
    const updated: Newsletter = { ...n, status: 'sent', sentAt: new Date(), recipientCount, updatedAt: new Date() };
    this.newsletters.set(id, updated);
    return updated;
  }
}

import { getDb } from "./db";
import { DbStorage } from "./storage-db";

const dbResult = getDb();
export const storage: IStorage = dbResult ? new DbStorage(dbResult.db as any) : new MemStorage();
