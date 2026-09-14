import {
  BookOpen,
  Calculator,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  Clock,
  Coins,
  Dices,
  FlaskConical,
  Gamepad2,
  Gem,
  Hammer,
  Library,
  ListOrdered,
  Map as MapIcon,
  Medal,
  Newspaper,
  Package,
  Palette,
  Puzzle,
  Radar,
  Route,
  Scale,
  ScrollText,
  Shield,
  Sparkles,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  Type,
  Users,
  UsersRound,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LANES, ROLES } from "./draft";
import { pathRole, SLUGS_LANE, SLUGS_ROLE } from "./tier-list-filters";
import { MEASURED_RANKS } from "./measured-ranks";

/**
 * Site sections.
 *
 * The menu sorts them into five families; some entries open a submenu
 * (tier list by rank, by lane, by role, emblems…). The flat lists
 * `BASE` and `NEWS`, taken from the same families, remain the source of the
 * global search and of the home page tools grid.
 *
 * Module without game data: it is read by the menus, in the browser.
 */
export type Entry = { href: string; key: string; icon: LucideIcon };

/** A menu item: a page, a group of subpages, or both. */
export interface MenuNode {
  /** Page of the entry; absent for a plain group ("By rank"). */
  href?: string;
  /** `nav.<key>` key: label and description. */
  key?: string;
  /** Full translation key of the label, for subpages (`roles.Tank`, `measuredRanks.mythic`…). */
  label?: string;
  icon?: LucideIcon;
  children?: MenuNode[];
}

export interface Group {
  /** `nav.groups.<key>` key of the family title. */
  key: string;
  icon: LucideIcon;
  nodes: MenuNode[];
  /** Two-column panel, for a large family. */
  large?: boolean;
}

export const GROUPS: Group[] = [
  {
    key: "heroes",
    icon: Users,
    nodes: [
      { href: "/heroes", key: "heroes", icon: Users },
      {
        key: "byRole",
        icon: Shield,
        children: ROLES.map((r) => ({ href: pathRole(r), label: `roles.${r}` })),
      },
      { href: "/statistics", key: "statistics", icon: ChartColumn },
      {
        href: "/skins",
        key: "skins",
        icon: Palette,
        children: [
          { href: "/skins", label: "nav.allSkins" },
          { href: "/skins/calendar", label: "nav.skinsCalendar.label" },
        ],
      },
      { href: "/lore", key: "lore", icon: BookOpen },
    ],
  },
  {
    key: "tierLists",
    icon: Trophy,
    nodes: [
      { href: "/tier-list", key: "tierList", icon: Trophy },
      {
        key: "byRank",
        icon: Medal,
        children: MEASURED_RANKS.filter((r) => r !== "all").map((r) => ({
          href: `/tier-list/${r}`,
          label: `measuredRanks.${r}`,
        })),
      },
      {
        key: "byLane",
        icon: Route,
        children: LANES.map((l) => ({ href: `/tier-list/lane/${SLUGS_LANE[l]}`, label: `lanes.${l}` })),
      },
      {
        key: "byRoleTier",
        icon: Shield,
        children: ROLES.map((r) => ({ href: `/tier-list/role/${SLUGS_ROLE[r]}`, label: `roles.${r}` })),
      },
      { href: "/meta", key: "meta", icon: TrendingUp },
    ],
  },
  {
    key: "game",
    icon: Package,
    nodes: [
      { href: "/items", key: "items", icon: Package },
      {
        href: "/emblems",
        key: "emblems",
        icon: Gem,
        children: [
          { href: "/emblems", label: "nav.allEmblems" },
          ...ROLES.map((r) => ({ href: `/emblems/${SLUGS_ROLE[r]}`, label: `roles.${r}` })),
        ],
      },
      { href: "/spells", key: "spells", icon: Sparkles },
      { href: "/ranks", key: "ranks", icon: Medal },
      { href: "/game-modes", key: "gameModes", icon: Gamepad2 },
      { href: "/map", key: "mapGuide", icon: MapIcon },
    ],
  },
  {
    key: "tools",
    icon: Wrench,
    large: true,
    nodes: [
      { href: "/draft", key: "draft", icon: Swords },
      { href: "/compare", key: "compare", icon: Scale },
      { href: "/tools/team", key: "team", icon: UsersRound },
      { href: "/tools/tier-list-maker", key: "tierListMaker", icon: ListOrdered },
      { href: "/tools/win-rate", key: "winRate", icon: Calculator },
      { href: "/tools/collection", key: "collection", icon: Coins },
      { href: "/tools/server-time", key: "serverTime", icon: Clock },
      { href: "/tools/retribution", key: "retribution", icon: Zap },
      { href: "/tools/timer", key: "objectiveTimer", icon: Timer },
      { href: "/quiz", key: "quiz", icon: CircleHelp },
      { href: "/mlbbdle", key: "mlbbdle", icon: Puzzle },
      { href: "/tools/nickname", key: "nickname", icon: Type },
      { href: "/tools/draw-calculator", key: "drawCalculator", icon: Dices },
      { href: "/tools/build", key: "buildSimulator", icon: Hammer },
      { href: "/builds", key: "communityBuilds", icon: Library },
    ],
  },
  {
    key: "news",
    icon: Newspaper,
    nodes: [
      { href: "/news", key: "news", icon: Newspaper },
      { href: "/events", key: "events", icon: CalendarDays },
      { href: "/esports", key: "esports", icon: Trophy },
      { href: "/watch", key: "watch", icon: Radar },
      { href: "/patch-notes", key: "patchNotes", icon: ScrollText },
      { href: "/patch-notes/advance-server", key: "advanceServer", icon: FlaskConical },
    ],
  },
];

/** Top-level pages of a family: those with an address, a label and an icon. */
const pages = (g: Group): Entry[] =>
  g.nodes.flatMap((n) => (n.href && n.key && n.icon ? [{ href: n.href, key: n.key, icon: n.icon }] : []));

export const BASE: Entry[] = GROUPS.filter((g) => g.key !== "news").flatMap(pages);
export const NEWS: Entry[] = GROUPS.filter((g) => g.key === "news").flatMap(pages);
