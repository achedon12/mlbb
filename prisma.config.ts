import { defineConfig } from "prisma/config";

/**
 * Prisma configuration: where the schema and the migrations live, and the
 * database the migrate commands talk to. `prisma generate` needs no
 * database, so the address may be missing (build, CI, a site without the
 * bot); `prisma migrate` then fails with a clear message.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
