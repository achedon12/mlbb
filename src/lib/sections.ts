import {
  BookOpen,
  Bot,
  Calculator,
  CalendarDays,
  CalendarRange,
  ChartColumn,
  CircleHelp,
  Clock,
  Coins,
  Crosshair,
  Dices,
  FlaskConical,
  Gamepad2,
  Gem,
  Gift,
  Grid3x3,
  Hammer,
  HandHelping,
  Library,
  ListOrdered,
  Map as MapIcon,
  Medal,
  MessagesSquare,
  Newspaper,
  Package,
  Palette,
  PencilRuler,
  Puzzle,
  Radar,
  Scale,
  ScrollText,
  Sparkles,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  Type,
  UserRoundSearch,
  Users,
  UsersRound,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LANES, ROLES } from "./draft";
import { pathRole, SLUGS_LANE, SLUGS_ROLE } from "./tier-list-filters";
import { MEASURED_RANKS } from "./measured-ranks";
import { botPublished } from "./bot/public";

/**
 * Site map of the navigation: the six sections of the header, the tools hub
 * and the footer, all from this one module.
 *
 * Each section has a hub page (`/heroes`, `/tier-list`, `/guides`, `/tools`,
 * `/news`, `/community`) and a few columns of entries; a column may carry
 * rows of short links (tier list by rank, by lane…) instead of a submenu.
 * The flat lists `BASE` and `NEWS`, taken from the same sections, remain the
 * source of the global search, the home tools and the guides' tool links.
 *
 * Module without game data: it is read by the header, the hubs and the tests.
 */
export type Entry = { href: string; key: string; icon: LucideIcon };

/** A short link of a chip row: full translation key of its label. */
export type Chip = { href: string; label: string };

/** A row of short links under a heading (`nav.<key>.label`). */
export interface ChipRow {
  key: string;
  links: Chip[];
}

export interface Column {
  /** `nav.columns.<key>` key of the column heading. */
  key: string;
  entries: Entry[];
  rows?: ChipRow[];
}

export interface Section {
  /** `nav.groups.<key>` key of the header label, `nav.hubs.<key>` of the hub link. */
  key: string;
  icon: LucideIcon;
  /** Hub page of the section, linked at the foot of its panel. */
  hub: string;
  /**
   * Address prefixes that make the section current, for the header's active
   * mark. The first match in the order of `SECTIONS` wins.
   */
  match: string[];
  columns: Column[];
}

// -- Entries ---------------------------------------------------------------------

const e = (href: string, key: string, icon: LucideIcon): Entry => ({ href, key, icon });

const HEROES = e("/heroes", "heroes", Users);
const FREE_ROTATION = e("/heroes/free-rotation", "freeRotation", Gift);
const COMPARE = e("/compare", "compare", Scale);
const LORE = e("/lore", "lore", BookOpen);
const SKINS = e("/skins", "skins", Palette);
const SKINS_CALENDAR = e("/skins/calendar", "skinsCalendar", CalendarRange);
const EVENTS = e("/events", "events", CalendarDays);

const TIER_LIST = e("/tier-list", "tierList", Trophy);
const STATISTICS = e("/statistics", "statistics", ChartColumn);
const META = e("/meta", "meta", TrendingUp);
const MATCHUPS = e("/tools/matchups", "matchups", Grid3x3);
const BUILDS = e("/builds", "communityBuilds", Library);

const GUIDES = e("/guides", "guides", BookOpen);
const MAP = e("/map", "mapGuide", MapIcon);
const GAME_MODES = e("/game-modes", "gameModes", Gamepad2);
const RANKS = e("/ranks", "ranks", Medal);
const ITEMS = e("/items", "items", Package);
const EMBLEMS = e("/emblems", "emblems", Gem);
const SPELLS = e("/spells", "spells", Sparkles);

const DRAFT = e("/draft", "draft", Swords);
const TEAM = e("/tools/team", "team", UsersRound);
const STRATEGY = e("/tools/strategy-planner", "strategyPlanner", PencilRuler);
const BUILD = e("/tools/build", "buildSimulator", Hammer);
const DAMAGE = e("/tools/damage-calculator", "damageCalculator", Crosshair);
const TIER_MAKER = e("/tools/tier-list-maker", "tierListMaker", ListOrdered);
const COLLECTION = e("/tools/collection", "collection", Coins);
const ACCOUNT_VALUE = e("/tools/account-value", "accountValue", Wallet);
const WIN_RATE = e("/tools/win-rate", "winRate", Calculator);
const DRAW = e("/tools/draw-calculator", "drawCalculator", Dices);
const TIMER = e("/tools/timer", "objectiveTimer", Timer);
const RETRIBUTION = e("/tools/retribution", "retribution", Zap);
const SERVER_TIME = e("/tools/server-time", "serverTime", Clock);
const QUIZ = e("/quiz", "quiz", CircleHelp);
const MLBBDLE = e("/mlbbdle", "mlbbdle", Puzzle);
const NICKNAME = e("/tools/nickname", "nickname", Type);

const NEWS_PAGE = e("/news", "news", Newspaper);
const PATCH_NOTES = e("/patch-notes", "patchNotes", ScrollText);
const ADVANCE = e("/patch-notes/advance-server", "advanceServer", FlaskConical);
const WATCH = e("/watch", "watch", Radar);
const ESPORTS = e("/esports", "esports", Trophy);

const COMMUNITY = e("/community", "community", MessagesSquare);
const TEAMMATES = e("/community/teammates", "teammates", UserRoundSearch);
const CONTRIBUTE = e("/contribute", "contribute", HandHelping);
// Only when the bot is deployed: its page is not built otherwise.
const BOT = botPublished() ? [e("/bot", "bot", Bot)] : [];

// -- Rows of short links ----------------------------------------------------------

const ROW_HERO_ROLES: ChipRow = {
  key: "byRole",
  links: ROLES.map((r) => ({ href: pathRole(r), label: `roles.${r}` })),
};
const ROW_RANKS: ChipRow = {
  key: "byRank",
  links: MEASURED_RANKS.filter((r) => r !== "all").map((r) => ({ href: `/tier-list/${r}`, label: `measuredRanks.${r}` })),
};
const ROW_LANES: ChipRow = {
  key: "byLane",
  links: LANES.map((l) => ({ href: `/tier-list/lane/${SLUGS_LANE[l]}`, label: `lanes.${l}` })),
};
const ROW_TIER_ROLES: ChipRow = {
  key: "byRoleTier",
  links: ROLES.map((r) => ({ href: `/tier-list/role/${SLUGS_ROLE[r]}`, label: `roles.${r}` })),
};
const ROW_EMBLEMS: ChipRow = {
  key: "emblemsByRole",
  links: ROLES.map((r) => ({ href: `/emblems/${SLUGS_ROLE[r]}`, label: `roles.${r}` })),
};

// -- Tools ------------------------------------------------------------------------

/**
 * Every tool, by what it is for. The header's Tools panel and the `/tools`
 * hub both read this list: a tool added here appears in both.
 */
export const TOOL_GROUPS: Column[] = [
  { key: "toolsDraft", entries: [DRAFT, TEAM, STRATEGY, MATCHUPS, COMPARE] },
  { key: "toolsBuilds", entries: [BUILD, DAMAGE, TIER_MAKER] },
  { key: "toolsAccount", entries: [COLLECTION, ACCOUNT_VALUE, WIN_RATE, DRAW] },
  { key: "toolsMatch", entries: [TIMER, RETRIBUTION, SERVER_TIME] },
  { key: "toolsGames", entries: [MLBBDLE, QUIZ, NICKNAME] },
];

// -- Sections ---------------------------------------------------------------------

export const SECTIONS: Section[] = [
  {
    key: "heroes",
    icon: Users,
    hub: "/heroes",
    match: ["/heroes", "/compare", "/lore", "/skins"],
    columns: [
      { key: "browse", entries: [HEROES, FREE_ROTATION, COMPARE, LORE], rows: [ROW_HERO_ROLES] },
      { key: "skins", entries: [SKINS, SKINS_CALENDAR, EVENTS] },
    ],
  },
  {
    key: "meta",
    icon: TrendingUp,
    hub: "/tier-list",
    match: ["/tier-list", "/statistics", "/meta", "/builds", "/tools/matchups"],
    columns: [
      { key: "rankings", entries: [TIER_LIST, STATISTICS, META], rows: [ROW_RANKS] },
      { key: "filters", entries: [], rows: [ROW_LANES, ROW_TIER_ROLES] },
      { key: "picks", entries: [MATCHUPS, BUILDS] },
    ],
  },
  {
    key: "guides",
    icon: BookOpen,
    hub: "/guides",
    match: ["/guides", "/map", "/game-modes", "/ranks", "/items", "/emblems", "/spells"],
    columns: [
      { key: "learn", entries: [GUIDES, MAP, GAME_MODES, RANKS] },
      { key: "database", entries: [ITEMS, EMBLEMS, SPELLS], rows: [ROW_EMBLEMS] },
    ],
  },
  {
    key: "tools",
    icon: Wrench,
    hub: "/tools",
    match: ["/tools", "/draft", "/quiz", "/mlbbdle"],
    columns: TOOL_GROUPS,
  },
  {
    key: "news",
    icon: Newspaper,
    hub: "/news",
    match: ["/news", "/patch-notes", "/events", "/watch", "/esports"],
    columns: [
      { key: "news", entries: [NEWS_PAGE, PATCH_NOTES, ADVANCE, WATCH] },
      { key: "esports", entries: [ESPORTS] },
    ],
  },
  {
    key: "community",
    icon: MessagesSquare,
    hub: "/community",
    match: ["/community", "/bot", "/contribute"],
    columns: [{ key: "community", entries: [COMMUNITY, TEAMMATES, BUILDS, ...BOT, CONTRIBUTE] }],
  },
];

/** Section a path belongs to (path without its locale), for the header's active mark. */
export function sectionOf(path: string): string | null {
  const hit = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  // Most specific prefix first: `/tools/matchups` belongs to Meta, not Tools.
  let best: { key: string; length: number } | null = null;
  for (const s of SECTIONS) {
    for (const m of s.match) {
      if (hit(m) && (!best || m.length > best.length)) best = { key: s.key, length: m.length };
    }
  }
  return best?.key ?? null;
}

// -- Footer -----------------------------------------------------------------------

/** Footer column: a `footer.columns.<key>` heading and its links (full translation keys). */
export interface FooterColumn {
  key: string;
  links: Chip[];
}

const link = ({ href, key }: Entry): Chip => ({ href, label: `nav.${key}.label` });

export const FOOTER: FooterColumn[] = [
  { key: "heroes", links: [HEROES, FREE_ROTATION, COMPARE, SKINS, LORE].map(link) },
  { key: "meta", links: [TIER_LIST, STATISTICS, META, MATCHUPS, BUILDS].map(link) },
  { key: "guides", links: [GUIDES, ITEMS, EMBLEMS, SPELLS, MAP, GAME_MODES, RANKS].map(link) },
  { key: "tools", links: [e("/tools", "tools", Wrench), DRAFT, TEAM, BUILD, MLBBDLE].map(link) },
  { key: "news", links: [NEWS_PAGE, PATCH_NOTES, EVENTS, ESPORTS, WATCH].map(link) },
  {
    key: "site",
    links: [
      ...[COMMUNITY, ...BOT, CONTRIBUTE].map(link),
      { href: "/api-doc", label: "footer.publicApi" },
      { href: "/about", label: "footer.about" },
      { href: "/account", label: "footer.myAccount" },
      { href: "/legal", label: "footer.legalNotice" },
      { href: "/privacy", label: "footer.privacy" },
    ],
  },
];

// -- Flat lists -------------------------------------------------------------------

const unique = (entries: Entry[]) => entries.filter((x, i) => entries.findIndex((y) => y.href === x.href) === i);

const entriesOf = (s: Section) => s.columns.flatMap((c) => c.entries);

/** Every page of the menu but the news section's. */
export const BASE: Entry[] = unique(SECTIONS.filter((s) => s.key !== "news").flatMap(entriesOf));
export const NEWS: Entry[] = unique(SECTIONS.filter((s) => s.key === "news").flatMap(entriesOf));

/** Every address the header, the tools hub and the footer link to. */
export function navigationHrefs(): Set<string> {
  const hrefs = new Set<string>(["/"]);
  for (const s of SECTIONS) {
    hrefs.add(s.hub);
    for (const c of s.columns) {
      c.entries.forEach((x) => hrefs.add(x.href));
      c.rows?.forEach((r) => r.links.forEach((x) => hrefs.add(x.href)));
    }
  }
  TOOL_GROUPS.forEach((c) => c.entries.forEach((x) => hrefs.add(x.href)));
  FOOTER.forEach((c) => c.links.forEach((x) => hrefs.add(x.href)));
  return hrefs;
}
