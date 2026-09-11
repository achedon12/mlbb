import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Manifeste : permet l'ajout a l'ecran d'accueil sur mobile. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.titre,
    short_name: site.nom,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#06080f",
    theme_color: "#06080f",
    lang: "fr-FR",
    categories: ["games", "reference"],
    id: "/",
    scope: "/",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
