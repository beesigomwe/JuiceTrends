/**
 * Auto-migration script: creates missing tables and adds missing columns.
 * Non-destructive only (no drops). Keep TARGET_SCHEMA in sync with shared/schema.ts.
 *
 * Run: npm run db:auto-migrate
 */
import "dotenv/config";
import { Pool } from "pg";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

/**
 * Target schema: table name -> list of column definitions for CREATE and for ADD COLUMN.
 * When you add a new table or column in shared/schema.ts, add it here too so auto-migrate can create it.
 */
const TARGET_SCHEMA: Record<
  string,
  Array<{ name: string; createDef: string; addDef: string }>
> = {
  users: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "name", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "username", createDef: "TEXT NOT NULL UNIQUE", addDef: "TEXT NOT NULL UNIQUE" },
    { name: "password", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "email", createDef: "TEXT NOT NULL UNIQUE", addDef: "TEXT NOT NULL UNIQUE" },
    { name: "avatar", createDef: "TEXT", addDef: "TEXT" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
  social_accounts: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "platform", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "account_name", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "account_handle", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "avatar_url", createDef: "TEXT", addDef: "TEXT" },
    { name: "access_token", createDef: "TEXT", addDef: "TEXT" },
    { name: "platform_user_id", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "refresh_token", createDef: "TEXT", addDef: "TEXT" },
    { name: "token_expires_at", createDef: "TIMESTAMP", addDef: "TIMESTAMP" },
    { name: "is_connected", createDef: "BOOLEAN DEFAULT true", addDef: "BOOLEAN DEFAULT true" },
    { name: "followers", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "engagement", createDef: "TEXT DEFAULT '0%'", addDef: "TEXT DEFAULT '0%'" },
  ],
  posts: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "content", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "media_urls", createDef: "TEXT[]", addDef: "TEXT[]" },
    { name: "platforms", createDef: "TEXT[] NOT NULL", addDef: "TEXT[] NOT NULL" },
    { name: "status", createDef: "TEXT NOT NULL DEFAULT 'draft'", addDef: "TEXT NOT NULL DEFAULT 'draft'" },
    { name: "scheduled_at", createDef: "TIMESTAMP", addDef: "TIMESTAMP" },
    { name: "published_at", createDef: "TIMESTAMP", addDef: "TIMESTAMP" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
    { name: "hashtags", createDef: "TEXT[]", addDef: "TEXT[]" },
    { name: "reach", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "impressions", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "engagement", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "clicks", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    // §3.1 — per-platform publish outcomes
    { name: "publish_results", createDef: "JSONB", addDef: "JSONB" },
    // §3.1 — platform-specific metadata (YouTube title, Pinterest boardId, etc.)
    { name: "platform_metadata", createDef: "JSONB", addDef: "JSONB" },
    // Brands — optional brand association
    { name: "brand_id", createDef: "VARCHAR", addDef: "VARCHAR" },
    // Per-platform target accounts (nullable TEXT[])
    { name: "target_account_ids", createDef: "TEXT[]", addDef: "TEXT[]" },
  ],
  analytics_data: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "platform", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "date", createDef: "TIMESTAMP NOT NULL", addDef: "TIMESTAMP NOT NULL" },
    { name: "reach", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "impressions", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "engagement", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "clicks", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "followers", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "new_followers", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
  ],
  // §3.1 — media table
  media: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "filename", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "url", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "mime_type", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "size_bytes", createDef: "INTEGER NOT NULL", addDef: "INTEGER NOT NULL DEFAULT 0" },
    { name: "width", createDef: "INTEGER", addDef: "INTEGER" },
    { name: "height", createDef: "INTEGER", addDef: "INTEGER" },
    { name: "duration_seconds", createDef: "INTEGER", addDef: "INTEGER" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
    // §3.1 — post_media join table
  post_media: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "post_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "media_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "position", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
  ],
  // Brands — named groups of social accounts
  brands: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "name", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "description", createDef: "TEXT", addDef: "TEXT" },
    { name: "color", createDef: "TEXT DEFAULT '#6366f1'", addDef: "TEXT DEFAULT '#6366f1'" },
    { name: "logo_url", createDef: "TEXT", addDef: "TEXT" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
    { name: "updated_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
  // brand_accounts — join table linking brands to social accounts
  brand_accounts: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "brand_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "account_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
  ],
  // Ad Management — campaigns, ad sets, creatives, and daily metrics
  ad_campaigns: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "brand_id", createDef: "VARCHAR", addDef: "VARCHAR" },
    { name: "name", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "objective", createDef: "TEXT NOT NULL DEFAULT 'awareness'", addDef: "TEXT NOT NULL DEFAULT 'awareness'" },
    { name: "platform", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "status", createDef: "TEXT NOT NULL DEFAULT 'draft'", addDef: "TEXT NOT NULL DEFAULT 'draft'" },
    { name: "total_budget", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "daily_budget", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "currency", createDef: "TEXT DEFAULT 'USD'", addDef: "TEXT DEFAULT 'USD'" },
    { name: "start_date", createDef: "TIMESTAMP", addDef: "TIMESTAMP" },
    { name: "end_date", createDef: "TIMESTAMP", addDef: "TIMESTAMP" },
    { name: "platform_campaign_id", createDef: "TEXT", addDef: "TEXT" },
    { name: "notes", createDef: "TEXT", addDef: "TEXT" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
    { name: "updated_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
  ad_sets: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "campaign_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "name", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "status", createDef: "TEXT NOT NULL DEFAULT 'draft'", addDef: "TEXT NOT NULL DEFAULT 'draft'" },
    { name: "targeting", createDef: "JSONB", addDef: "JSONB" },
    { name: "placement", createDef: "TEXT", addDef: "TEXT" },
    { name: "bid_strategy", createDef: "TEXT DEFAULT 'lowest_cost'", addDef: "TEXT DEFAULT 'lowest_cost'" },
    { name: "bid_amount", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "daily_budget", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "start_date", createDef: "TIMESTAMP", addDef: "TIMESTAMP" },
    { name: "end_date", createDef: "TIMESTAMP", addDef: "TIMESTAMP" },
    { name: "platform_ad_set_id", createDef: "TEXT", addDef: "TEXT" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
    { name: "updated_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
  ad_creatives: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "ad_set_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "campaign_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "name", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "format", createDef: "TEXT NOT NULL DEFAULT 'image'", addDef: "TEXT NOT NULL DEFAULT 'image'" },
    { name: "headline", createDef: "TEXT", addDef: "TEXT" },
    { name: "body_text", createDef: "TEXT", addDef: "TEXT" },
    { name: "call_to_action", createDef: "TEXT", addDef: "TEXT" },
    { name: "destination_url", createDef: "TEXT", addDef: "TEXT" },
    { name: "media_url", createDef: "TEXT", addDef: "TEXT" },
    { name: "media_urls", createDef: "TEXT[]", addDef: "TEXT[]" },
    { name: "status", createDef: "TEXT NOT NULL DEFAULT 'draft'", addDef: "TEXT NOT NULL DEFAULT 'draft'" },
    { name: "platform_creative_id", createDef: "TEXT", addDef: "TEXT" },
    { name: "preview_url", createDef: "TEXT", addDef: "TEXT" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
    { name: "updated_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
  ad_metrics: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "campaign_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "ad_set_id", createDef: "VARCHAR", addDef: "VARCHAR" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "date", createDef: "TIMESTAMP NOT NULL", addDef: "TIMESTAMP NOT NULL" },
    { name: "spend", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "impressions", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "reach", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "clicks", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "conversions", createDef: "INTEGER DEFAULT 0", addDef: "INTEGER DEFAULT 0" },
    { name: "ctr", createDef: "TEXT DEFAULT '0'", addDef: "TEXT DEFAULT '0'" },
    { name: "cpm", createDef: "TEXT DEFAULT '0'", addDef: "TEXT DEFAULT '0'" },
    { name: "cpc", createDef: "TEXT DEFAULT '0'", addDef: "TEXT DEFAULT '0'" },
    { name: "roas", createDef: "TEXT DEFAULT '0'", addDef: "TEXT DEFAULT '0'" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
  // Suggestion Engine — AI-generated post suggestions and follow-up threads
  suggested_posts: [
    { name: "id", createDef: "VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()", addDef: "VARCHAR DEFAULT gen_random_uuid()" },
    { name: "user_id", createDef: "VARCHAR NOT NULL", addDef: "VARCHAR NOT NULL" },
    { name: "type", createDef: "TEXT NOT NULL DEFAULT 'new_post'", addDef: "TEXT NOT NULL DEFAULT 'new_post'" },
    { name: "source_post_id", createDef: "VARCHAR", addDef: "VARCHAR" },
    { name: "content", createDef: "TEXT NOT NULL", addDef: "TEXT NOT NULL" },
    { name: "platforms", createDef: "TEXT[] NOT NULL", addDef: "TEXT[] NOT NULL" },
    { name: "hashtags", createDef: "TEXT[]", addDef: "TEXT[]" },
    { name: "reasoning", createDef: "TEXT", addDef: "TEXT" },
    { name: "suggested_time", createDef: "TEXT", addDef: "TEXT" },
    { name: "suggested_day_of_week", createDef: "INTEGER", addDef: "INTEGER" },
    { name: "suggested_hour", createDef: "INTEGER", addDef: "INTEGER" },
    { name: "confidence_score", createDef: "INTEGER DEFAULT 70", addDef: "INTEGER DEFAULT 70" },
    { name: "engagement_prediction", createDef: "TEXT", addDef: "TEXT" },
    { name: "status", createDef: "TEXT NOT NULL DEFAULT 'pending'", addDef: "TEXT NOT NULL DEFAULT 'pending'" },
    { name: "scheduled_post_id", createDef: "VARCHAR", addDef: "VARCHAR" },
    { name: "created_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
    { name: "updated_at", createDef: "TIMESTAMP DEFAULT NOW()", addDef: "TIMESTAMP DEFAULT NOW()" },
  ],
};

const MIGRATIONS_META_TABLE = "_schema_migrations";

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_META_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getExistingTables(pool: Pool): Promise<Set<string>> {
  const r = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != $1`,
    [MIGRATIONS_META_TABLE]
  );
  return new Set(r.rows.map((row) => row.tablename));
}

async function getExistingColumns(pool: Pool, tableName: string): Promise<Set<string>> {
  const r = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set(r.rows.map((row) => row.column_name));
}

async function run(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await ensureMigrationsTable(pool);
    const existingTables = await getExistingTables(pool);

    for (const [tableName, columns] of Object.entries(TARGET_SCHEMA)) {
      if (!existingTables.has(tableName)) {
        const colDefs = columns.map((c) => `  "${c.name}" ${c.createDef}`).join(",\n");
        const uniqueConstraint =
          tableName === "social_accounts"
            ? ",\n  CONSTRAINT social_accounts_user_platform_platform_user_key UNIQUE (user_id, platform, platform_user_id)"
            : "";
        const sql = `CREATE TABLE "${tableName}" (\n${colDefs}${uniqueConstraint}\n)`;
        console.log(`[auto-migrate] Creating table: ${tableName}`);
        await pool.query(sql);
        existingTables.add(tableName);
        continue;
      }

      const existingCols = await getExistingColumns(pool, tableName);
      for (const col of columns) {
        if (existingCols.has(col.name)) continue;
        const sql = `ALTER TABLE "${tableName}" ADD COLUMN "${col.name}" ${col.addDef}`;
        console.log(`[auto-migrate] Adding column: ${tableName}.${col.name}`);
        await pool.query(sql);
      }
    }

    console.log("[auto-migrate] Done.");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error("[auto-migrate] Error:", err);
  process.exit(1);
});
