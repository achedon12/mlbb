import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Temporary voice channels on the site: the dashboard's input and its
 * checks, the default names shown in the preview (the bot's own), the
 * dashboard save, and the bot's signed routes (settings with the hubs,
 * registering, listing and forgetting the channels it created). The bot's
 * schemas are imported from `bot/src/site/schemas`, which pulls in zod and
 * the locale list only, never discord.js.
 */

const SECRET = "a".repeat(64);
const GUILD = "111111111111111111";
const LEFT_GUILD = "111111111111111112";
const USER = "222222222222222222";
const HUB = "333333333333333331";
const RANKED = "333333333333333332";
const FOREIGN = "444444444444444444";
const TEXT = "333333333333333339";
const TEMP = "777777777777777771";
const TEMP_2 = "777777777777777772";

Object.assign(process.env, {
  DATABASE_URL: "postgresql://x:y@localhost:5432/z",
  BOT_API_SECRET: SECRET,
  BOT_SESSION_SECRET: "b".repeat(64),
  BOT_INTERNAL_URL: "http://bot:3100",
  DISCORD_CLIENT_ID: "123456789012345678",
  DISCORD_CLIENT_SECRET: "c".repeat(32),
});

const client = vi.hoisted(() => ({
  canManage: vi.fn(async (_c: unknown, guild: string, user: string) => guild === "111111111111111111" && user === "222222222222222222"),
  guildChannels: vi.fn(async () => ({
    channels: [{ id: "333333333333333339", name: "general", type: "text" }],
    roles: [],
    manageRoles: false,
    voiceChannels: [
      { id: "333333333333333331", name: "Custom games", category: "Lobbies" },
      { id: "333333333333333332", name: "Ranked", category: null },
    ],
    manageChannels: true,
    moveMembers: true,
  })),
  refreshGuildQuietly: vi.fn(async () => undefined),
}));
vi.mock("@/lib/bot/client", async (original) => ({ ...(await original<object>()), ...client }));

const jar = vi.hoisted(() => ({ session: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (jar.session ? { value: jar.session } : undefined) }) }));

type Hub = { id: number; guildId: string; channelId: string; userLimit: number; nameTemplate: string | null };
type Temp = { guildId: string; channelId: string; hubChannelId: string; ownerId: string };
const store = vi.hoisted(() => ({ hubs: [] as Hub[], temps: [] as Temp[], nextId: 1 }));
vi.mock("@/lib/db", () => {
  const guilds: Record<string, { id: string; leftAt: Date | null; locale: string }> = {
    "111111111111111111": { id: "111111111111111111", leftAt: null, locale: "fr" },
    "111111111111111112": { id: "111111111111111112", leftAt: new Date(), locale: "en" },
  };
  const db = {
    guild: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const guild = guilds[where.id];
        if (!guild) return null;
        const tempVoiceHubs = store.hubs.filter((h) => h.guildId === where.id).sort((a, b) => a.id - b.id);
        return { ...guild, name: "Server", icon: null, memberCount: 10, settings: null, tempVoiceHubs };
      }),
    },
    tempVoiceHub: {
      deleteMany: vi.fn(({ where }: { where: { guildId: string } }) => ({ kind: "delete", guildId: where.guildId })),
      createMany: vi.fn(({ data }: { data: Omit<Hub, "id">[] }) => ({ kind: "create", data })),
    },
    tempVoiceChannel: {
      count: vi.fn(async ({ where }: { where: { guildId: string } }) => store.temps.filter((t) => t.guildId === where.guildId).length),
      upsert: vi.fn(async ({ where, create }: { where: { channelId: string }; create: Temp }) => {
        if (!store.temps.some((t) => t.channelId === where.channelId)) store.temps.push(create);
      }),
      findMany: vi.fn(async ({ where, take }: { where: { channelId?: { gt: string } }; take: number }) =>
        store.temps
          .filter((t) => guilds[t.guildId] && !guilds[t.guildId]!.leftAt && (!where.channelId || t.channelId > where.channelId.gt))
          .sort((a, b) => (a.channelId < b.channelId ? -1 : 1))
          .slice(0, take),
      ),
      deleteMany: vi.fn(async ({ where }: { where: { channelId: { in: string[] } } }) => {
        const before = store.temps.length;
        store.temps = store.temps.filter((t) => !where.channelId.in.includes(t.channelId));
        return { count: before - store.temps.length };
      }),
    },
    // The save's two writes, applied in order like the real transaction.
    $transaction: vi.fn(async (ops: ({ kind: "delete"; guildId: string } | { kind: "create"; data: Omit<Hub, "id">[] })[]) => {
      for (const op of ops) {
        if (op.kind === "delete") store.hubs = store.hubs.filter((h) => h.guildId !== op.guildId);
        else for (const row of op.data) store.hubs.push({ id: store.nextId++, ...row });
      }
      return ops;
    }),
  };
  return { databaseConfigured: () => true, db: () => db };
});

const { LOCALES: BOT_OWN_LOCALES } = await import("../../bot/src/i18n/locales");
const { guildSettings, tempVoiceChannelsPage } = await import("../../bot/src/site/schemas");
const { BOT_LOCALES, MAX_TEMP_VOICE_HUBS, TEMP_VOICE_DEFAULT_NAMES, TEMP_VOICE_NAME_MAX, tempVoicePreview } = await import("@/lib/bot/kinds");
const { checkTempVoice, nameTemplate, tempVoiceHubView, tempVoiceInput, tempVoiceRows } = await import("@/lib/bot/temp-voice");
const { readBotConfig } = await import("@/lib/bot/config");
const { sealSession } = await import("@/lib/bot/session");
const { signedHeaders } = await import("@/lib/bot/signature");
const dashboardRoute = await import("@/app/api/discord/guilds/[id]/temp-voice/route");
const settingsRoute = await import("@/app/api/bot/guilds/[id]/settings/route");
const registerRoute = await import("@/app/api/bot/guilds/[id]/temp-voice/route");
const listRoute = await import("@/app/api/bot/temp-voice/route");
const forgetRoute = await import("@/app/api/bot/temp-voice/forget/route");
const { TempVoiceSection } = await import("@/components/bot/temp-voice-section");
const { LocaleProvider, ExtendMessages } = await import("@/i18n/provider");
const { messagesClient, messagesPage } = await import("@/i18n/translations");
const { LOCALES } = await import("@/i18n/config");

const config = readBotConfig(process.env);
if (typeof config === "string") throw new Error("test configuration invalid");
const BASE = "http://mlbb:3001";
let address = 0;

const hub = (channelId: string, userLimit = 0, template: string | null = null) => ({ channelId, userLimit, nameTemplate: template });

describe("the dashboard's input", () => {
  it("accepts up to 5 distinct hubs with a limit of 0 to 99 and an optional name", () => {
    const parsed = tempVoiceInput.parse({ hubs: [hub(HUB, 10, "  Custom · {user} "), hub(RANKED, 5, "   ")] });
    expect(parsed.hubs).toEqual([hub(HUB, 10, "Custom · {user}"), hub(RANKED, 5, null)]);
    expect(tempVoiceInput.parse({ hubs: [] }).hubs).toEqual([]);
  });

  it("refuses duplicates, too many hubs, bad limits, long or control-character names, extra fields", () => {
    const six = Array.from({ length: MAX_TEMP_VOICE_HUBS + 1 }, (_, i) => hub(`33333333333333334${i}`));
    for (const body of [
      { hubs: [hub(HUB), hub(HUB)] },
      { hubs: six },
      { hubs: [hub(HUB, -1)] },
      { hubs: [hub(HUB, 100)] },
      { hubs: [hub(HUB, 2.5)] },
      { hubs: [hub(HUB, 0, "x".repeat(TEMP_VOICE_NAME_MAX + 1))] },
      { hubs: [hub(HUB, 0, "a\nb")] },
      { hubs: [hub("not-an-id")] },
      { hubs: [{ ...hub(HUB), guildId: GUILD }] },
      { hubs: [hub(HUB)], extra: true },
    ]) {
      expect(tempVoiceInput.safeParse(body).success, JSON.stringify(body).slice(0, 80)).toBe(false);
    }
    expect(nameTemplate.parse("")).toBeNull();
  });

  it("only takes the server's voice channels, a hub kept as it was excepted", () => {
    const voice = new Set([HUB, RANKED]);
    expect(checkTempVoice(tempVoiceInput.parse({ hubs: [hub(HUB), hub(RANKED)] }), voice)).toEqual({ ok: true });
    expect(checkTempVoice(tempVoiceInput.parse({ hubs: [hub(TEXT)] }), voice)).toEqual({ ok: false, field: "hubs.0.channelId" });
    expect(checkTempVoice(tempVoiceInput.parse({ hubs: [hub(HUB), hub(FOREIGN)] }), voice)).toEqual({ ok: false, field: "hubs.1.channelId" });
    // Deleted on Discord since: still saved alongside the others, the dashboard warns.
    expect(checkTempVoice(tempVoiceInput.parse({ hubs: [hub(FOREIGN)] }), voice, new Set([FOREIGN]))).toEqual({ ok: true });
  });

  it("writes and reads rows as the bot reads them", () => {
    const rows = tempVoiceRows(GUILD, tempVoiceInput.parse({ hubs: [hub(RANKED, 5, "Ranked {user}")] }));
    expect(rows).toEqual([{ guildId: GUILD, channelId: RANKED, userLimit: 5, nameTemplate: "Ranked {user}" }]);
    expect(tempVoiceHubView({ channelId: HUB, userLimit: 250, nameTemplate: null }).userLimit).toBe(99);
    const parsed = guildSettings.parse({ locale: "fr", announcements: {}, tempVoice: { hubs: rows.map(tempVoiceHubView) } });
    expect(parsed.tempVoice.hubs).toEqual([{ channelId: RANKED, userLimit: 5, nameTemplate: "Ranked {user}" }]);
  });
});

describe("default names", () => {
  it("are the bot's own, in each of its languages", () => {
    expect(Object.keys(TEMP_VOICE_DEFAULT_NAMES).sort()).toEqual([...BOT_OWN_LOCALES].sort());
    for (const locale of BOT_LOCALES) {
      const bot = JSON.parse(readFileSync(join(process.cwd(), "bot", "src", "i18n", `${locale}.json`), "utf8")) as {
        ui: { tempVoice: { defaultName: string } };
      };
      expect(TEMP_VOICE_DEFAULT_NAMES[locale], locale).toBe(bot.ui.tempVoice.defaultName);
      expect(TEMP_VOICE_DEFAULT_NAMES[locale]).toContain("{user}");
    }
  });

  it("preview like the bot names: template, else default, placeholder replaced, 100 characters at most", () => {
    expect(tempVoicePreview(null, TEMP_VOICE_DEFAULT_NAMES.en, "Leo")).toBe("🎯 Leo's lobby");
    expect(tempVoicePreview("Ranked · {user}", TEMP_VOICE_DEFAULT_NAMES.fr, "Leo")).toBe("Ranked · Leo");
    expect([...tempVoicePreview("{user}", "x", "y".repeat(300))].length).toBe(100);
  });
});

function request(method: string, path: string, body?: unknown) {
  address += 1;
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      origin: "https://mlbbdex.com",
      "x-forwarded-for": `198.51.${Math.floor(address / 250)}.${address % 250}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const save = (body: unknown, guild = GUILD) =>
  dashboardRoute.PUT(request("PUT", `/api/discord/guilds/${guild}/temp-voice`, body), { params: Promise.resolve({ id: guild }) });

/** A signed call from the bot. */
function signed(method: "GET" | "POST", path: string, body?: unknown) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  address += 1;
  return new Request(`${BASE}${path}`, {
    method,
    headers: { ...signedHeaders(SECRET, method, path, raw), "x-forwarded-for": `203.0.113.${address % 250}`, ...(raw ? { "content-type": "application/json" } : {}) },
    ...(raw ? { body: raw } : {}),
  });
}

beforeEach(() => {
  jar.session = sealSession(config, { id: USER, name: "Leo", avatar: null });
  store.hubs = [];
  store.temps = [];
  store.nextId = 1;
  client.refreshGuildQuietly.mockClear();
});

describe("dashboard save", () => {
  it("saves every hub at once, then asks the bot to forget its copy", async () => {
    const response = await save({ hubs: [hub(HUB, 10), hub(RANKED, 5, "Ranked · {user}")] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hubs: [hub(HUB, 10), hub(RANKED, 5, "Ranked · {user}")] });
    expect(store.hubs.map((h) => h.channelId)).toEqual([HUB, RANKED]);
    expect(client.refreshGuildQuietly).toHaveBeenCalledWith(expect.anything(), GUILD);
    // An empty list turns the feature off.
    expect((await save({ hubs: [] })).status).toBe(200);
    expect(store.hubs).toEqual([]);
  });

  it("refuses a text channel or another server's channel, and a server the user does not manage", async () => {
    expect((await save({ hubs: [hub(TEXT)] })).status).toBe(400);
    expect((await save({ hubs: [hub(FOREIGN)] })).status).toBe(400);
    expect((await save({ hubs: [hub(HUB)] }, "999999999999999999")).status).toBe(403);
    expect(store.hubs).toEqual([]);
  });

  it("refuses a request without a session", async () => {
    jar.session = undefined;
    expect((await save({ hubs: [hub(HUB)] })).status).toBe(401);
  });
});

describe("the bot's routes", () => {
  it("serves the hubs with the settings, read by the bot's own schema", async () => {
    await save({ hubs: [hub(RANKED, 5)] });
    const path = `/api/bot/guilds/${GUILD}/settings`;
    const response = await settingsRoute.GET(signed("GET", path), { params: Promise.resolve({ id: GUILD }) });
    expect(response.status).toBe(200);
    const parsed = guildSettings.parse(await response.json());
    expect(parsed.tempVoice.hubs).toEqual([hub(RANKED, 5)]);
  });

  it("registers, lists and forgets the channels created, signed only", async () => {
    const register = (guild: string, body: unknown) =>
      registerRoute.POST(signed("POST", `/api/bot/guilds/${guild}/temp-voice`, body), { params: Promise.resolve({ id: guild }) });
    expect((await register(GUILD, { channelId: TEMP, hubChannelId: HUB, ownerId: USER })).status).toBe(200);
    // Registered again (a retried call): kept as it was.
    expect((await register(GUILD, { channelId: TEMP, hubChannelId: RANKED, ownerId: USER })).status).toBe(200);
    expect((await register(GUILD, { channelId: TEMP_2, hubChannelId: RANKED, ownerId: USER })).status).toBe(200);
    // A server the bot left keeps nothing; a malformed body is refused.
    expect((await register(LEFT_GUILD, { channelId: "777777777777777773", hubChannelId: HUB, ownerId: USER })).status).toBe(404);
    expect((await register(GUILD, { channelId: "x", hubChannelId: HUB, ownerId: USER })).status).toBe(400);
    expect(store.temps).toHaveLength(2);
    expect(store.temps.find((t) => t.channelId === TEMP)?.hubChannelId).toBe(HUB);

    const listed = await listRoute.GET(signed("GET", "/api/bot/temp-voice"));
    const page = tempVoiceChannelsPage.parse(await listed.json());
    expect(page.channels.map((c) => c.channelId)).toEqual([TEMP, TEMP_2]);
    expect(page.next).toBeNull();
    const after = tempVoiceChannelsPage.parse(await (await listRoute.GET(signed("GET", `/api/bot/temp-voice?after=${TEMP}`))).json());
    expect(after.channels.map((c) => c.channelId)).toEqual([TEMP_2]);

    const forgotten = await forgetRoute.POST(signed("POST", "/api/bot/temp-voice/forget", { channelIds: [TEMP] }));
    expect(await forgotten.json()).toEqual({ ok: true, forgotten: 1 });
    expect(store.temps.map((t) => t.channelId)).toEqual([TEMP_2]);

    const unsigned = await listRoute.GET(new Request(`${BASE}/api/bot/temp-voice`));
    expect(unsigned.status).toBe(401);
  });
});

describe("dashboard section", () => {
  const render = (locale: (typeof LOCALES)[number], props: Partial<Parameters<typeof TempVoiceSection>[0]> = {}) =>
    renderToStaticMarkup(
      h(LocaleProvider, {
        locale,
        messages: messagesClient(locale),
        children: h(ExtendMessages, {
          messages: messagesPage(locale, ["pages.botUI"]),
          children: h(TempVoiceSection, {
            guildId: GUILD,
            initial: [hub(HUB, 10), hub(FOREIGN, 5)],
            voiceChannels: [
              { id: HUB, name: "Custom games", category: "Lobbies" },
              { id: RANKED, name: "Ranked", category: null },
            ],
            manageChannels: false,
            moveMembers: true,
            defaultName: TEMP_VOICE_DEFAULT_NAMES.en,
            sampleUser: "Leo",
            state: { kind: "attention", text: "!" },
            ...props,
          }),
        }),
      }),
    );

  it("warns about a missing permission and a deleted hub, and previews the name", () => {
    const html = render("en");
    expect(html).toContain("Manage Channels");
    expect(html).not.toContain("does not have the Move Members");
    expect(html).toContain("Lobbies › Custom games");
    expect(html).toContain("Deleted channel");
    expect(html).toContain("🎯 Leo&#x27;s lobby");
  });

  it("has every text in every site language", () => {
    for (const locale of LOCALES) {
      const html = render(locale, { manageChannels: false, moveMembers: false, initial: [], voiceChannels: [] });
      expect(html, locale).not.toMatch(/pages\.botUI\.tempVoice/);
    }
  });
});
