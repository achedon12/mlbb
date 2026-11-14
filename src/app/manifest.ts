import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * Web app manifest: installing the site from the browser (Chrome, Edge,
 * Safari), with home screen shortcuts and the screenshots of the richer
 * install dialog.
 *
 * `id` stays "/": browsers identify an installed app by it, changing it
 * would make every existing install a different app.
 *
 * Icons and screenshots are generated: `node scripts/app-icons.mjs` and
 * `node scripts/app-screenshots.mjs`.
 */
const NIGHT = "#06080f";

const SHORTCUTS = [
  { name: "Tier list", url: "/tier-list", icon: "tier-list", description: "Heroes ranked from ranked win and ban rates" },
  { name: "Heroes", url: "/heroes", icon: "heroes", description: "Every hero, with builds and counters" },
  { name: "MLBBdle", url: "/mlbbdle", icon: "mlbbdle", description: "The daily hero guessing game" },
  { name: "Builds", url: "/builds", icon: "builds", description: "Community builds made in the build simulator" },
] as const;

const SCREENSHOTS = [
  { name: "home", label: "Home: the current patch, new heroes and the meta at a glance" },
  { name: "tier-list", label: "Tier list calculated from ranked win, pick and ban rates" },
  { name: "hero", label: "Hero page: skills, builds and counters by rank" },
  { name: "builds", label: "Community builds, made in the build simulator" },
  { name: "mlbbdle", label: "MLBBdle, the daily hero guessing game" },
] as const;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: site.title,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: NIGHT,
    theme_color: NIGHT,
    lang: "en",
    dir: "ltr",
    categories: ["games", "entertainment", "reference"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: SHORTCUTS.map((s) => ({
      name: s.name,
      short_name: s.name,
      description: s.description,
      url: s.url,
      icons: [
        { src: `/icons/shortcuts/${s.icon}-96.png`, sizes: "96x96", type: "image/png" },
        { src: `/icons/shortcuts/${s.icon}-192.png`, sizes: "192x192", type: "image/png" },
      ],
    })),
    screenshots: [
      ...SCREENSHOTS.map((s) => ({
        src: `/screenshots/${s.name}-narrow.webp`,
        sizes: "1080x1920",
        type: "image/webp",
        form_factor: "narrow" as const,
        label: s.label,
      })),
      ...SCREENSHOTS.map((s) => ({
        src: `/screenshots/${s.name}-wide.webp`,
        sizes: "1920x1080",
        type: "image/webp",
        form_factor: "wide" as const,
        label: s.label,
      })),
    ],
  };
}
