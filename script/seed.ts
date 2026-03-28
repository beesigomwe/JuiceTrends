import "dotenv/config";
import bcrypt from "bcrypt";
import { getDb } from "../server/db";
import { users } from "../shared/schema";

const SALT_ROUNDS = 10;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function usernameFromEmail(email: string): string {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSeedUsersEnabled(): boolean {
  const v = process.env.SEED_USERS;
  if (v === undefined || v === "") return true;
  return v.toLowerCase() !== "false" && v !== "0";
}

async function main() {
  requireEnv("DATABASE_URL");

  // Schema is managed by auto-migrate.ts which runs before this script in the
  // Railway build command. We do NOT call drizzle-kit push here because it is
  // interactive and will fail when the remote DB has tables that differ from
  // the local schema (e.g. tables from a previous deployment attempt).

  const seedUsers = isSeedUsersEnabled();
  if (!seedUsers) {
    console.log("SEED_USERS is false; skipping user account creation.");
    return;
  }

  const adminUser = requireEnv("ADMIN_USER");
  const adminPass = requireEnv("ADMIN_PASS");
  const testUser = requireEnv("TEST_USER");
  const testPass = requireEnv("TEST_PASS");

  const dbResult = getDb();
  if (!dbResult) throw new Error("getDb() returned null");
  const { pool, db } = dbResult;

  const adminPasswordHash = await bcrypt.hash(adminPass, SALT_ROUNDS);
  const testPasswordHash = await bcrypt.hash(testPass, SALT_ROUNDS);

  const adminUsername = usernameFromEmail(adminUser);
  const testUsername = usernameFromEmail(testUser);

  console.log("Upserting admin and test users...");
  await db
    .insert(users)
    .values({
      name: "Admin",
      username: adminUsername,
      email: adminUser,
      password: adminPasswordHash,
      avatar: null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: "Admin", username: adminUsername, password: adminPasswordHash },
    });

  await db
    .insert(users)
    .values({
      name: "Test User",
      username: testUsername,
      email: testUser,
      password: testPasswordHash,
      avatar: null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: "Test User", username: testUsername, password: testPasswordHash },
    });

  await pool.end();
  console.log("Seed complete. You can log in with ADMIN_USER/ADMIN_PASS or TEST_USER/TEST_PASS.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
