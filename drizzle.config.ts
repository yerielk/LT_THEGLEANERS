import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL || "postgres://lecta:lecta@127.0.0.1:5432/lecta" },
});
