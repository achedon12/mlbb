import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = site.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default share image.
 *
 * Used on social network and messaging cards when a page does not define
 * a more specific one. Plain and readable: the site name, a tagline, in
 * the brand colors, so the link is never shown bare.
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
          <div style={{ fontSize: "56px", fontWeight: 800, color: "#f5c451" }}>MLBBDex</div>
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
          Mobile Legends: Bang Bang knowledge base
        </div>

        <div style={{ marginTop: "28px", fontSize: "30px", color: "#9aa7c2", maxWidth: "900px" }}>
          Hero pages, builds, tier list, items, emblems and patch notes — in English, French, Italian and Spanish.
        </div>
      </div>
    ),
    { ...size },
  );
}
