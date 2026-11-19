/**
 * Whether the sources still document the Advance Server: the latest dated
 * test version is under `ADVANCE_FRESH_DAYS` old. The wiki stopped in June
 * 2024; until a source documents it again, the menu and the home page do
 * not point to a page frozen two years back (the page itself stays).
 *
 * The date comes from the build (`ADVANCE_LATEST`, set in next.config.ts),
 * not from the data file: the menu is drawn in the browser, and the file
 * weighs megabytes.
 */
export const ADVANCE_FRESH_DAYS = 120;

export function advanceDocumented(now = Date.now(), latest = process.env.ADVANCE_LATEST ?? ""): boolean {
  const at = Date.parse(latest);
  return Number.isFinite(at) && now - at <= ADVANCE_FRESH_DAYS * 86_400_000;
}
