/**
 * Donation links ("Support MLBBDex"): Ko-fi and PayPal.me, set on the server
 * with `SUPPORT_KOFI_URL` and `SUPPORT_PAYPAL_URL`.
 *
 * Read at runtime by `/api/support`, never inlined at build time: the pages
 * are prerendered, so a value read while rendering them would be frozen into
 * the image (and the image is built without the server's `.env`). The
 * browser asks the route once per page load, so recreating the container
 * with a new `.env` is enough to change or remove a link.
 *
 * A value that is not an https address on the platform's own domain is
 * ignored, as if unset: a typo or a tampered `.env` cannot turn the button
 * into a link to anywhere. With neither set, nothing is shown.
 *
 * Pure: also imported by the client, which checks the route's answer again.
 */
export type SupportPlatform = "kofi" | "paypal";

export interface SupportLink {
  platform: SupportPlatform;
  href: string;
}

/** Display order, and the order the footer picks its single link from. */
export const SUPPORT_PLATFORMS: readonly SupportPlatform[] = ["kofi", "paypal"];

/** Brand names, not translated. */
export const SUPPORT_PLATFORM_NAMES: Record<SupportPlatform, string> = { kofi: "Ko-fi", paypal: "PayPal" };

const HOSTS: Record<SupportPlatform, readonly string[]> = {
  kofi: ["ko-fi.com"],
  paypal: ["paypal.me", "www.paypal.com"],
};

const ENV: Record<SupportPlatform, string> = { kofi: "SUPPORT_KOFI_URL", paypal: "SUPPORT_PAYPAL_URL" };

/**
 * The link if `raw` is an https address on the platform's domain, with a
 * page (an account, not the bare home page), and no credentials or port;
 * otherwise null.
 */
export function supportUrl(raw: unknown, platform: SupportPlatform): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!HOSTS[platform].includes(url.hostname)) return null;
  if (url.pathname.replace(/\/+$/, "") === "") return null;
  return url.href;
}

/** The configured links, in display order. */
export function supportLinks(env: Record<string, string | undefined> = process.env): SupportLink[] {
  return SUPPORT_PLATFORMS.flatMap((platform) => {
    const href = supportUrl(env[ENV[platform]], platform);
    return href ? [{ platform, href }] : [];
  });
}

/** The route's answer, checked again: anything malformed is dropped. */
export function parseSupportLinks(data: unknown): SupportLink[] {
  const list = (data as { links?: unknown } | null)?.links;
  if (!Array.isArray(list)) return [];
  return SUPPORT_PLATFORMS.flatMap((platform) => {
    const entry = list.find((l: unknown) => (l as SupportLink | null)?.platform === platform) as SupportLink | undefined;
    const href = entry ? supportUrl(entry.href, platform) : null;
    return href ? [{ platform, href }] : [];
  });
}
