import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb(): { pool: Pool; db: ReturnType<typeof drizzle> } | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _db = drizzle(_pool);
  }
  return { pool: _pool, db: _db! };
}
