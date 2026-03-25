import { eq, desc } from "drizzle-orm";
import {
  users,
  posts,
  socialAccounts,
  type User,
  type InsertUser,
  type Post,
  type InsertPost,
  type SocialAccount,
  type InsertSocialAccount,
  type DashboardStats,
  type ChartDataPoint,
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
}
