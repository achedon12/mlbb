import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.titre;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Image de partage par defaut.
 *
 * Reprise sur les cartes des reseaux et messageries quand une page n'en definit
 * pas de plus specifique. Sobre et lisible : le nom du site, une accroche, aux
 * couleurs de la marque, pour que le lien ne s'affiche jamais nu.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b0e17 0%, #141a2b 100%)",
          color: "#f4f1e8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "88px",
              height: "88px",
              borderRadius: "16px",
              background: "#f5c451",
              color: "#0b0e17",
              fontSize: "40px",
              fontWeight: 800,
            }}
          >
            ML
          </div>
          <div style={{ fontSize: "56px", fontWeight: 800, color: "#f5c451" }}>MLBB.fr</div>
        </div>

        <div
          style={{
            marginTop: "48px",
            fontSize: "58px",
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: "960px",
          }}
        >
          Base de connaissances Mobile Legends: Bang Bang
        </div>

        <div style={{ marginTop: "28px", fontSize: "30px", color: "#9aa7c2", maxWidth: "900px" }}>
          Fiches heros, builds, tier list, objets, emblemes et patch notes — en francais.
        </div>
      </div>
    ),
    { ...size },
  );
}
