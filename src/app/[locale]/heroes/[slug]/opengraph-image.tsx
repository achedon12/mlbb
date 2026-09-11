import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import sharp from "sharp";
import { herosParSlug, illustrations } from "@/lib/donnees";
import { site } from "@/lib/site";
import { tauxParSlug } from "@/lib/tier-list";

export const size = { width: 1200, height: 630 };

// Une carte illustree pese un demi-megaoctet : 133 heros en quatre langues
// alourdiraient le build de 300 Mo pour des images que seuls les robots des
// reseaux sociaux demandent. Aucune n'est donc generee au build ; chacune
// l'est a sa premiere demande, puis servie depuis le cache une semaine.
export const revalidate = 604800;

export function generateStaticParams() {
  return [];
}
export const contentType = "image/png";
export const alt = site.titre;

const COULEUR_PALIER: Record<string, string> = {
  "S+": "#f0506e",
  S: "#f5c451",
  A: "#34d399",
  B: "#4da3ff",
  C: "#9aa7c2",
};

/**
 * Image de partage d'une fiche : portrait, palier et taux de victoire. Un lien
 * partage montre le heros, plutot que la carte generique du site.
 */
export default async function Image({ params }: { params: Promise<{ locale: Langue; slug: string }> }) {
  const { locale, slug } = await params;
  const t = creerT(locale);
  const h = herosParSlug.get(slug);
  const taux = tauxParSlug.get(slug);

  // L'illustration du skin d'origine, a defaut le portrait, lue sur le disque
  // et embarquee : le moteur d'images ne va pas la chercher sur le site pendant
  // le build, et ne lit pas le WebP — d'ou la conversion, recadree sur la zone
  // la plus parlante de l'image.
  let portrait: string | null = null;
  const chemin = Object.values(illustrations[slug] ?? {})[0] ?? h?.visuels.portrait;
  if (chemin) {
    try {
      const png = await sharp(await readFile(join(process.cwd(), "public", chemin)))
        .resize(440, 630, { fit: "cover", position: sharp.strategy.attention })
        .png()
        .toBuffer();
      portrait = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      portrait = null;
    }
  }
  const pourcent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: "#f5c451" }}>{site.nom}</div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 88, fontWeight: 800, lineHeight: 1 }}>
            {h?.nom ?? slug}
          </div>
          {h?.titre && <div style={{ display: "flex", marginTop: 14, fontSize: 36, color: "#9aa7c2" }}>{h.titre}</div>}
          {h && (
            <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "#cfd6e6" }}>
              {h.roles.map((r) => t(`roles.${r}`)).join(" · ")}
            </div>
          )}
          {taux && (
            <div style={{ display: "flex", gap: 20, marginTop: 44 }}>
              <div
                style={{
                  display: "flex",
                  padding: "12px 26px",
                  fontSize: 38,
                  fontWeight: 800,
                  color: "#0b0e17",
                  background: COULEUR_PALIER[taux.palier] ?? "#9aa7c2",
                  borderRadius: 10,
                }}
              >
                {t("pages.heroDetail.palier", { p: taux.palier })}
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
                <span style={{ fontSize: 38, fontWeight: 700 }}>{`${pourcent.format(taux.victoire)} %`}</span>
                <span style={{ fontSize: 24, color: "#9aa7c2" }}>{t("pages.heroDetail.stat.tauxVictoire")}</span>
              </div>
            </div>
          )}
          <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: "#9aa7c2" }}>
            {t("pages.heroDetail.ogAccroche")}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
