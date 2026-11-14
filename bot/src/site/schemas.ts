import { z } from "zod";
import { LOCALES } from "../i18n/locales.js";

/**
 * Shapes of the site's internal API (`/api/bot/*`), validated on receipt:
 * the bot trusts the site's signature, not the content's correctness. A
 * malformed answer is an error, never a crash further down.
 */

export const SNOWFLAKE = /^\d{17,20}$/;
export const snowflake = z.string().regex(SNOWFLAKE);
const locale = z.enum(LOCALES).catch("en");

/** `{ data: X }` and plain `X` are both accepted, so either side may wrap. */
export const unwrap = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v) && "data" in v ? (v as { data: unknown }).data : v), schema);

export const ANNOUNCEMENT_TYPES = ["patches", "skins", "events", "advanceServer", "esports"] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

const channelSetting = z
  .object({ channelId: snowflake.nullable().catch(null), roleId: snowflake.nullable().catch(null), failing: z.boolean().catch(false) })
  .catch({ channelId: null, roleId: null, failing: false });

export const GREETING_KINDS = ["welcome", "goodbye"] as const;
export type GreetingKind = (typeof GREETING_KINDS)[number];
/** The site's cap on an owner's text; the bot clips to it again before posting. */
export const GREETING_MAX_LENGTH = 500;

/**
 * Welcome or goodbye message. Anything unreadable turns it off: a message
 * nobody configured must never be posted. A text over the cap is clipped
 * rather than dropped (the owner did write one).
 */
const greetingSetting = z
  .object({
    channelId: snowflake.nullable().catch(null),
    message: z
      .string()
      .transform((text) => text.slice(0, GREETING_MAX_LENGTH))
      .nullable()
      .catch(null),
    failing: z.boolean().catch(false),
  })
  .catch({ channelId: null, message: null, failing: false });
export type GreetingSetting = z.infer<typeof greetingSetting>;

/** The site's cap on each auto-role list; the bot never gives more than this. */
export const MAX_AUTO_ROLES = 3;

/** Snowflakes only, each once, at most 3: anything else in the list is dropped. */
const roleList = z
  .array(z.unknown())
  .transform((ids) => [...new Set(ids.filter((id): id is string => typeof id === "string" && SNOWFLAKE.test(id)))].slice(0, MAX_AUTO_ROLES))
  .catch([]);

/**
 * Roles given to newcomers: `roleIds` to people, `botRoleIds` to bots.
 * Unreadable, they are off: a role nobody chose must never be given.
 */
const autoRoleSetting = z
  .object({
    roleIds: roleList,
    botRoleIds: roleList.default([]),
    failing: z.boolean().catch(false),
    // Who chose them: the bot gives only what that person could give.
    configuredBy: snowflake.nullable().catch(null).default(null),
  })
  .catch({ roleIds: [], botRoleIds: [], failing: false, configuredBy: null });
export type AutoRoleSetting = z.infer<typeof autoRoleSetting>;
/**
 * Why auto-roles stopped: `bot`, the bot may not give them (Manage Roles
 * lost, a role moved or made dangerous); `granter`, the manager who chose
 * them left or could no longer give them.
 */
export const AUTO_ROLE_FAILURES = ["bot", "granter"] as const;
export type AutoRoleFailure = (typeof AUTO_ROLE_FAILURES)[number];

export const guildSettings = unwrap(
  z.preprocess(
    // Settings may list the announcement types at the top level or under
    // `announcements`: both are folded into the second form.
    (v) => {
      if (!v || typeof v !== "object") return v;
      const raw = v as Record<string, unknown>;
      if (raw.announcements && typeof raw.announcements === "object") return raw;
      return { ...raw, announcements: Object.fromEntries(ANNOUNCEMENT_TYPES.map((t) => [t, raw[t]])) };
    },
    z.object({
      locale: locale.nullable().catch(null),
      announcements: z.object(
        Object.fromEntries(ANNOUNCEMENT_TYPES.map((t) => [t, channelSetting])) as Record<AnnouncementType, typeof channelSetting>,
      ),
      dailyMlbbdleChannelId: snowflake.nullable().catch(null),
      dailyQuizChannelId: snowflake.nullable().catch(null),
      dailyHourUtc: z.number().int().min(0).max(23).catch(12),
      // Absent from an older site: off.
      welcome: greetingSetting.default({ channelId: null, message: null, failing: false }),
      goodbye: greetingSetting.default({ channelId: null, message: null, failing: false }),
      autoRoles: autoRoleSetting.default({ roleIds: [], botRoleIds: [], failing: false, configuredBy: null }),
    }),
  ),
);
export type GuildSettings = z.infer<typeof guildSettings>;

export const DEFAULT_SETTINGS: GuildSettings = {
  locale: null,
  announcements: Object.fromEntries(
    ANNOUNCEMENT_TYPES.map((t) => [t, { channelId: null, roleId: null, failing: false }]),
  ) as GuildSettings["announcements"],
  dailyMlbbdleChannelId: null,
  dailyQuizChannelId: null,
  dailyHourUtc: 12,
  welcome: { channelId: null, message: null, failing: false },
  goodbye: { channelId: null, message: null, failing: false },
  autoRoles: { roleIds: [], botRoleIds: [], failing: false, configuredBy: null },
};

// ─── Role menus ────────────────────────────────────────────────────────

export const ROLE_MENU_MODES = ["single", "multiple"] as const;
export type RoleMenuMode = (typeof ROLE_MENU_MODES)[number];
/** Discord's cap on the options of one select menu; the site's too. */
export const MAX_ROLE_MENU_OPTIONS = 25;

const roleMenuOption = z.object({
  roleId: snowflake,
  label: z.string().trim().min(1).max(100),
  // A unicode emoji or `<:name:id>`; unreadable, the option has none.
  emoji: z.string().max(80).nullable().catch(null).default(null),
});

/**
 * A self-assign role menu as the site stores it. The bot gives nothing
 * outside `options`: whatever an interaction carries is matched against
 * this list, and an option the list does not hold is refused.
 */
export const roleMenu = z.object({
  id: z.union([z.number().int().positive(), z.string().regex(/^\d{1,12}$/)]).transform(String),
  channelId: snowflake,
  title: z.string().min(1).max(256),
  description: z.string().max(4000).nullable().catch(null).default(null),
  mode: z.enum(ROLE_MENU_MODES),
  options: z
    .array(roleMenuOption)
    .min(1)
    .max(MAX_ROLE_MENU_OPTIONS)
    .refine((options) => new Set(options.map((o) => o.roleId)).size === options.length, "duplicate role"),
  // Who chose the roles: the bot gives only what that person could give.
  configuredBy: snowflake.nullable().catch(null).default(null),
  messageId: snowflake.nullable().catch(null).default(null),
  messageChannelId: snowflake.nullable().catch(null).default(null),
});
export type RoleMenu = z.infer<typeof roleMenu>;

/** `GET /api/bot/guilds/:id/role-menus`: an unreadable menu is dropped, never half-used. */
export const roleMenuList = unwrap(
  z.object({
    menus: z
      .array(z.unknown())
      .max(100)
      .transform((list) =>
        list.flatMap((m) => {
          const parsed = roleMenu.safeParse(m);
          return parsed.success ? [parsed.data] : [];
        }),
      ),
  }),
);

export const announcementTarget = z.object({
  guildId: snowflake,
  channelId: snowflake,
  roleId: snowflake.nullable().catch(null),
  locale,
});
export type AnnouncementTarget = z.infer<typeof announcementTarget>;

export const announcement = z.object({
  id: z.union([z.string().min(1).max(64), z.number().int()]).transform(String),
  type: z.enum(ANNOUNCEMENT_TYPES),
  key: z.string().max(200),
  payload: z.unknown(),
  targets: z.array(announcementTarget).max(10_000),
});
export type Announcement = z.infer<typeof announcement>;

export const pendingAnnouncements = unwrap(
  z.object({
    // One bad announcement must not block the others: invalid entries are
    // dropped here, and logged by the caller from the count difference.
    announcements: z.array(z.unknown()).transform((list) =>
      list.flatMap((a) => {
        const parsed = announcement.safeParse(a);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  }),
);

// ─── Announcement payloads, per type ───────────────────────────────────

// A site path, optionally with a page anchor: skin announcements point to
// "/heroes/<hero>/skins#<anchor>", and refusing the "#" dropped every one.
const path = z.string().regex(/^\/[A-Za-z0-9/_.\-~%]*(?:#[A-Za-z0-9_-]{1,100})?$/).max(300);
const text = (max: number) => z.string().min(1).max(max);
const count = z.number().int().min(0).catch(0);

export const PAYLOADS = {
  patches: z.object({
    version: text(40),
    title: text(200).optional(),
    date: z.string().nullable().optional(),
    url: path,
    counts: z.object({ buff: count, nerf: count, adjust: count }).catch({ buff: 0, nerf: 0, adjust: 0 }),
    heroes: z.array(z.string()).catch([]),
  }),
  skins: z.object({
    hero: text(60),
    heroName: text(80),
    name: text(200),
    image: z.string().nullable().optional(),
    url: path,
  }),
  events: z.object({ month: text(20), title: text(200).optional(), url: path, count: count.optional() }),
  advanceServer: z.object({ version: text(40), date: z.string().nullable().optional(), url: path }),
  esports: z.object({
    slug: text(120),
    name: text(200),
    status: z.string().max(40).optional(),
    url: path,
    winner: z.string().max(120).nullable().optional(),
  }),
} satisfies Record<AnnouncementType, z.ZodType>;

// ─── Daily games ───────────────────────────────────────────────────────

const mlbbdleHero = z.object({
  slug: z.string(),
  name: z.string(),
  icon: z.string().nullable().catch(null),
  gender: z.enum(["male", "female", "none"]).nullable().catch(null),
  roles: z.array(z.string()).catch([]),
  lanes: z.array(z.string()).catch([]),
  specialties: z.array(z.string()).catch([]),
  damage: z.string().nullable().catch(null),
  range: z.string().nullable().catch(null),
  resource: z.string().nullable().catch(null),
  region: z.string().nullable().catch(null),
  year: z.number().nullable().catch(null),
});
export type MlbbdleHero = z.infer<typeof mlbbdleHero>;

const skillPuzzle = z.object({
  answer: z.string(),
  name: z.string(),
  icon: z.string(),
  excerpt: z.string().nullable().catch(null),
});
export type SkillPuzzle = z.infer<typeof skillPuzzle>;

const quizRound = z.discriminatedUnion("type", [
  z.object({ type: z.literal("skill"), reponse: z.string(), nom: z.string(), icone: z.string(), extrait: z.string().nullable().catch(null) }),
  z.object({ type: z.literal("skin"), reponse: z.string(), image: z.string(), skin: z.string() }),
  z.object({ type: z.literal("story"), reponse: z.string(), extraits: z.array(z.string()) }),
  z.object({
    type: z.literal("item"),
    reponse: z.string(),
    bonus: z.string().catch(""),
    prix: z.number().nullable().catch(null),
    categorie: z.string().catch(""),
    recette: z.array(z.object({ nom: z.string() })).catch([]),
    passif: z.string().nullable().catch(null),
  }),
  z.object({
    type: z.literal("duel"),
    paires: z.array(z.tuple([z.object({ slug: z.string(), victoire: z.number() }), z.object({ slug: z.string(), victoire: z.number() })])),
  }),
]);
export type QuizRound = z.infer<typeof quizRound>;

export const daily = unwrap(
  z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    number: z.number().int(),
    mlbbdle: z.object({
      // A slug, or an object carrying it: both forms have been discussed.
      classic: z.preprocess((v) => (v && typeof v === "object" ? (v as { slug?: unknown }).slug : v), z.string()),
      skill: skillPuzzle.nullable().catch(null),
      roster: z.array(mlbbdleHero),
      labels: z.record(z.string(), z.string()).catch({}),
    }),
    quiz: z
      .object({
        numero: z.number().int().optional(),
        manches: z.array(quizRound),
      })
      .nullable()
      .catch(null),
    quizRoster: z
      .object({
        heroes: z.array(z.object({ slug: z.string(), nom: z.string() })).catch([]),
        items: z.array(z.object({ slug: z.string(), nom: z.string() })).catch([]),
      })
      .catch({ heroes: [], items: [] }),
  }),
);
export type Daily = z.infer<typeof daily>;

export const GAMES = ["mlbbdle-classic", "mlbbdle-skill", "quiz"] as const;
export type Game = (typeof GAMES)[number];
export const PERIODS = ["day", "week", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const leaderboard = unwrap(
  z.object({
    entries: z
      .array(
        z.object({
          rank: z.number().int().optional(),
          discordUserId: snowflake,
          discordUserName: z.string().max(100),
          score: z.number(),
          plays: z.number().int().optional(),
          played: z.number().int().optional(),
        }),
      )
      .max(100),
  }),
);
export type Leaderboard = z.infer<typeof leaderboard>;

/** Any 2xx JSON body: the bot does not depend on what write routes return. */
/** One page of `GET /api/bot/daily/guilds?hour=`: the servers to post the daily games in. */
export const dailyGuildsPage = unwrap(
  z.object({
    guilds: z
      .array(
        z.object({
          guildId: snowflake,
          locale,
          dailyMlbbdleChannelId: snowflake.nullable().catch(null),
          dailyQuizChannelId: snowflake.nullable().catch(null),
        }),
      )
      .max(5_000),
    next: snowflake.nullable().catch(null),
  }),
);
export type DailyGuild = z.infer<typeof dailyGuildsPage>["guilds"][number];

export const anyBody = z.unknown();
