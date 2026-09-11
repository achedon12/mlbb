import {
  BookOpen,
  Calculator,
  ChartColumn,
  CircleHelp,
  Clock,
  Coins,
  Gamepad2,
  Gem,
  ListOrdered,
  Medal,
  Newspaper,
  Package,
  Palette,
  Radar,
  Route,
  Scale,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  UsersRound,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LANES, ROLES } from "./draft";
import { cheminRole, SLUGS_LANE, SLUGS_ROLE } from "./filtres-tier-list";
import { RANGS_MESURE } from "./rangs-mesure";

/**
 * Rubriques du site.
 *
 * Le menu les range en cinq familles ; certaines entrees ouvrent un sous-menu
 * (tier list par rang, par lane, par role, emblemes…). Les listes a plat
 * `BASE` et `ACTUALITE`, tirees des memes familles, restent la source de la
 * recherche globale et de la grille d'outils de l'accueil.
 *
 * Module sans donnees de jeu : il est lu par les menus, cote navigateur.
 */
export type Entree = { href: string; cle: string; icone: LucideIcon };

/** Un element du menu : une page, un groupe de sous-pages, ou les deux. */
export interface Noeud {
  /** Page de l'entree ; absente pour un simple groupe (« Par rang »). */
  href?: string;
  /** Cle `nav.<cle>` : libelle et description. */
  cle?: string;
  /** Cle de traduction complete du libelle, pour les sous-pages (`roles.Tank`, `rangsMesure.mythic`…). */
  libelle?: string;
  icone?: LucideIcon;
  enfants?: Noeud[];
}

export interface Groupe {
  /** Cle `nav.groupes.<cle>` du titre de la famille. */
  cle: string;
  icone: LucideIcon;
  noeuds: Noeud[];
  /** Panneau sur deux colonnes, pour une famille nombreuse. */
  large?: boolean;
}

export const GROUPES: Groupe[] = [
  {
    cle: "heros",
    icone: Users,
    noeuds: [
      { href: "/heroes", cle: "heroes", icone: Users },
      {
        cle: "parRole",
        icone: Shield,
        enfants: ROLES.map((r) => ({ href: cheminRole(r), libelle: `roles.${r}` })),
      },
      { href: "/statistics", cle: "statistics", icone: ChartColumn },
      {
        href: "/skins",
        cle: "skins",
        icone: Palette,
        enfants: [
          { href: "/skins", libelle: "nav.tousLesSkins" },
          { href: "/skins/calendar", libelle: "nav.skinsCalendar.label" },
        ],
      },
      { href: "/lore", cle: "lore", icone: BookOpen },
    ],
  },
  {
    cle: "tierLists",
    icone: Trophy,
    noeuds: [
      { href: "/tier-list", cle: "tierList", icone: Trophy },
      {
        cle: "parRang",
        icone: Medal,
        enfants: RANGS_MESURE.filter((r) => r !== "all").map((r) => ({
          href: `/tier-list/${r}`,
          libelle: `rangsMesure.${r}`,
        })),
      },
      {
        cle: "parLane",
        icone: Route,
        enfants: LANES.map((l) => ({ href: `/tier-list/lane/${SLUGS_LANE[l]}`, libelle: `lanes.${l}` })),
      },
      {
        cle: "parRoleTier",
        icone: Shield,
        enfants: ROLES.map((r) => ({ href: `/tier-list/role/${SLUGS_ROLE[r]}`, libelle: `roles.${r}` })),
      },
      { href: "/meta", cle: "meta", icone: TrendingUp },
    ],
  },
  {
    cle: "jeu",
    icone: Package,
    noeuds: [
      { href: "/items", cle: "items", icone: Package },
      {
        href: "/emblems",
        cle: "emblems",
        icone: Gem,
        enfants: [
          { href: "/emblems", libelle: "nav.tousLesEmblemes" },
          ...ROLES.map((r) => ({ href: `/emblems/${SLUGS_ROLE[r]}`, libelle: `roles.${r}` })),
        ],
      },
      { href: "/spells", cle: "spells", icone: Sparkles },
      { href: "/ranks", cle: "ranks", icone: Medal },
      { href: "/game-modes", cle: "gameModes", icone: Gamepad2 },
    ],
  },
  {
    cle: "outils",
    icone: Wrench,
    large: true,
    noeuds: [
      { href: "/draft", cle: "draft", icone: Swords },
      { href: "/compare", cle: "compare", icone: Scale },
      { href: "/tools/team", cle: "team", icone: UsersRound },
      { href: "/tools/tier-list-maker", cle: "tierListMaker", icone: ListOrdered },
      { href: "/tools/win-rate", cle: "winRate", icone: Calculator },
      { href: "/tools/collection", cle: "collection", icone: Coins },
      { href: "/tools/server-time", cle: "serverTime", icone: Clock },
      { href: "/tools/retribution", cle: "retribution", icone: Zap },
      { href: "/quiz", cle: "quiz", icone: CircleHelp },
    ],
  },
  {
    cle: "actualite",
    icone: Newspaper,
    noeuds: [
      { href: "/news", cle: "news", icone: Newspaper },
      { href: "/watch", cle: "watch", icone: Radar },
      { href: "/patch-notes", cle: "patchNotes", icone: ScrollText },
    ],
  },
];

/** Pages de premier niveau d'une famille : celles qui ont une adresse, un libelle et une icone. */
const pages = (g: Groupe): Entree[] =>
  g.noeuds.flatMap((n) => (n.href && n.cle && n.icone ? [{ href: n.href, cle: n.cle, icone: n.icone }] : []));

export const BASE: Entree[] = GROUPES.filter((g) => g.cle !== "actualite").flatMap(pages);
export const ACTUALITE: Entree[] = GROUPES.filter((g) => g.cle === "actualite").flatMap(pages);
