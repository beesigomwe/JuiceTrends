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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private posts: Map<string, Post>;
  private accounts: Map<string, SocialAccount>;
  private brands: Map<string, Brand>;
  private brandAccounts: Map<string, BrandAccount>;

  constructor() {
    this.users = new Map();
    this.posts = new Map();
    this.accounts = new Map();
    this.brands = new Map();
    this.brandAccounts = new Map();

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
}

import { getDb } from "./db";
import { DbStorage } from "./storage-db";

const dbResult = getDb();
export const storage: IStorage = dbResult ? new DbStorage(dbResult.db as any) : new MemStorage();
