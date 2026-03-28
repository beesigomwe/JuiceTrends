import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile } from "fs/promises";
import { createRequire } from "module";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

async function copyAssets() {
  // connect-pg-simple reads table.sql relative to its own __dirname at runtime.
  // Because esbuild bundles the server into dist/index.cjs, __dirname becomes
  // /app/dist at runtime, so we must copy the file there explicitly.
  const require = createRequire(import.meta.url);
  const pgSimplePath = require.resolve("connect-pg-simple");
  const tableSqlSrc = pgSimplePath.replace("index.js", "table.sql");
  await copyFile(tableSqlSrc, "dist/table.sql");
  console.log("copied connect-pg-simple/table.sql -> dist/table.sql");
}

buildAll()
  .then(() => copyAssets())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
