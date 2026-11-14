import { db, databaseConfigured } from "@/lib/db";

/**
 * Live server count for the `/bot` page: the only database read of a public
 * page. Kept ten minutes in memory, on top of the page's own revalidation,
 * and null whenever it cannot be read (build without a database, database
 * down): the page then simply does not show the figure.
 */
const TTL_MS = 10 * 60_000;
let cached: { at: number; value: number | null } | null = null;

export async function liveServerCount(): Promise<number | null> {
  if (!databaseConfigured()) return null;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let value: number | null = null;
  try {
    value = await db().guild.count({ where: { leftAt: null } });
  } catch {
    value = cached?.value ?? null;
  }
  cached = { at: Date.now(), value };
  return value;
}
