import {
  Calculator,
  Gamepad2,
  Gem,
  Newspaper,
  Package,
  Radar,
  Scale,
  ScrollText,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Rubriques du site, rangees en deux familles : la base de donnees et
 * l'actualite. Partagees par les menus (bureau et mobile) et par l'index de la
 * recherche globale, qui les propose comme destinations.
 */
export type Entree = { href: string; cle: string; icone: LucideIcon };

export const BASE: Entree[] = [
  { href: "/heroes", cle: "heroes", icone: Users },
  { href: "/tier-list", cle: "tierList", icone: Trophy },
  { href: "/compare", cle: "compare", icone: Scale },
  { href: "/draft", cle: "draft", icone: Swords },
  { href: "/tools/win-rate", cle: "winRate", icone: Calculator },
  { href: "/game-modes", cle: "gameModes", icone: Gamepad2 },
  { href: "/items", cle: "items", icone: Package },
  { href: "/emblems", cle: "emblems", icone: Gem },
];

export const ACTUALITE: Entree[] = [
  { href: "/news", cle: "news", icone: Newspaper },
  { href: "/watch", cle: "watch", icone: Radar },
  { href: "/patch-notes", cle: "patchNotes", icone: ScrollText },
];
