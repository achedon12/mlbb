import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import sharp from "sharp";
import { heroesBySlug, illustrations } from "@/lib/data";
import { site } from "@/lib/site";
import { rateBySlug } from "@/lib/tier-list";

export const size = { width: 1200, height: 630 };

// An illustrated card weighs half a megabyte: 133 heroes in four languages
// would add 300 MB to the build for images that only social network
// bots request. None is therefore generated at build time; each one
// is on its first request, then served from the cache for a week.
export const revalidate = 604800;

export function generateStaticParams() {
  return [];
}
export const contentType = "image/png";
export const alt = site.title;

const COLOR_TIER: Record<string, string> = {
  "S+": "#f0506e",
  S: "#f5c451",
  A: "#34d399",
  B: "#4da3ff",
  C: "#9aa7c2",
};

/**
 * Share image of a hero page: portrait, tier and win rate. A shared
 * link shows the hero, rather than the site's generic card.
 */
export default async function Image({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const t = createT(locale);
  const h = heroesBySlug.get(slug);
  const rate = rateBySlug.get(slug);

  // The original skin's illustration, or else the portrait, read from disk
  // and embedded: the image engine does not fetch it from the site during
  // the build, and does not read WebP — hence the conversion, cropped on the
  // most telling area of the image.
  let portrait: string | null = null;
  const path = Object.values(illustrations[slug] ?? {})[0] ?? h?.images.portrait;
  if (path) {
    try {
      const png = await sharp(await readFile(join(process.cwd(), "public", path)))
        .resize(440, 630, { fit: "cover", position: sharp.strategy.attention })
        .png()
        .toBuffer();
      portrait = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      portrait = null;
    }
  }
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #0b0e17 0%, #141a2b 100%)",
          color: "#f4f1e8",
          fontFamily: "sans-serif",
        }}
      >
        {portrait && (
          <img src={portrait} alt="" width={440} height={630} style={{ width: 440, height: 630, objectFit: "cover" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#f5c451" }}>{site.name}</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 88, fontWeight: 800, lineHeight: 1 }}>
            {h?.name ?? slug}
          </div>
          {h?.title && <div style={{ display: "flex", marginTop: 14, fontSize: 36, color: "#9aa7c2" }}>{h.title}</div>}
          {h && (
            <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "#cfd6e6" }}>
              {h.roles.map((r) => t(`roles.${r}`)).join(" · ")}
            </div>
          )}
          {rate && (
            <div style={{ display: "flex", gap: 20, marginTop: 44 }}>
              <div
                style={{
                  display: "flex",
                  padding: "12px 26px",
                  fontSize: 38,
                  fontWeight: 800,
                  color: "#0b0e17",
                  background: COLOR_TIER[rate.tier] ?? "#9aa7c2",
                  borderRadius: 10,
                }}
              >
                {t("pages.heroDetail.tier", { p: rate.tier })}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "12px 26px",
                  border: "2px solid #34405c",
                  borderRadius: 10,
                }}
              >
                <span style={{ fontSize: 38, fontWeight: 700 }}>{`${percent.format(rate.win)} %`}</span>
                <span style={{ fontSize: 24, color: "#9aa7c2" }}>{t("pages.heroDetail.stat.winRate")}</span>
              </div>
            </div>
          )}
          <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: "#9aa7c2" }}>
            {t("pages.heroDetail.ogTagline")}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
