import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleMenusSection } from "@/components/bot/role-menus-section";
import { LOCALES, type Locale } from "@/i18n/config";
import { ExtendMessages, LocaleProvider } from "@/i18n/provider";
import { messagesClient, messagesPage } from "@/i18n/translations";
import { roleMenuStatus } from "@/lib/bot/kinds";
import { customEmojiText, emojiImage, parseEmoji, suggestEmoji } from "@/lib/bot/role-menu-emoji";
import { checkRoleMenu, roleMenuInput, roleMenuOwner, roleMenuView, storedOptions } from "@/lib/bot/role-menus";

/** Role menus on the site: the input, the checks against the server, the owner after a save, the emojis. */

const CHANNEL = "333333333333333333";
const A = "555555555555555551";
const B = "555555555555555552";
const USER = "222222222222222222";
const OTHER = "222222222222222223";

const input = (extra: Record<string, unknown> = {}) => ({
  channelId: CHANNEL,
  title: "Rank",
  description: null,
  mode: "single",
  options: [
    { roleId: A, label: "Epic", emoji: "<:rank_epic:666666666666666661>" },
    { roleId: B, label: "Legend", emoji: null },
  ],
  ...extra,
});

describe("role menu input", () => {
  it("trims, turns a blank text or emoji into none, keeps line breaks", () => {
    const parsed = roleMenuInput.parse(
      input({ title: "  Rank  ", description: " Line 1\r\nLine 2 ", options: [{ roleId: A, label: " Epic ", emoji: "  " }] }),
    );
    expect(parsed).toMatchObject({ title: "Rank", description: "Line 1\nLine 2", options: [{ label: "Epic", emoji: null }] });
    expect(roleMenuInput.parse(input({ description: "   " })).description).toBeNull();
  });

  it("refuses control characters, oversized texts, duplicates and more than 25 roles", () => {
    const bad = [
      input({ title: "a\u0007b" }),
      input({ title: "x".repeat(101) }),
      input({ description: "x".repeat(1001) }),
      input({ options: [{ roleId: A, label: "x".repeat(81), emoji: null }] }),
      input({ options: [input().options[0], input().options[0]] }),
      input({ options: Array.from({ length: 26 }, (_, i) => ({ roleId: `5555555555555556${String(i).padStart(2, "0")}`, label: "x", emoji: null })) }),
      input({ options: [{ roleId: "@everyone", label: "x", emoji: null }] }),
      input({ options: [{ roleId: A, label: "x", emoji: "<@123456789012345678>" }] }),
    ];
    for (const value of bad) expect(roleMenuInput.safeParse(value).success, JSON.stringify(value).slice(0, 80)).toBe(false);
  });
});

describe("checks against the server", () => {
  const guild = { channels: new Set([CHANNEL]), assignable: new Set([A, B]), emojis: new Set(["666666666666666661"]) };
  const parsed = (extra: Record<string, unknown> = {}) => roleMenuInput.parse(input(extra));

  it("accepts the server's own channel, roles and emojis, and nothing else", () => {
    expect(checkRoleMenu(parsed(), guild)).toEqual({ ok: true });
    expect(checkRoleMenu(parsed({ channelId: "444444444444444444" }), guild)).toEqual({ ok: false, field: "channelId" });
    expect(checkRoleMenu(parsed(), { ...guild, assignable: new Set([A]) })).toEqual({ ok: false, field: "options.1.roleId" });
    expect(checkRoleMenu(parsed(), { ...guild, emojis: new Set() })).toEqual({ ok: false, field: "options.0.emoji" });
    // A unicode emoji needs nothing from the server.
    expect(checkRoleMenu(parsed({ options: [{ roleId: A, label: "x", emoji: "🔥" }] }), { ...guild, emojis: new Set() })).toEqual({ ok: true });
  });
});

describe("who owns a menu after a save", () => {
  it("is the saver who can give every role", () => {
    expect(roleMenuOwner(null, [A, B], USER, new Set([A, B]))).toEqual({ ok: true, configuredBy: USER });
    expect(roleMenuOwner({ roleIds: [A], configuredBy: OTHER }, [A], USER, new Set([A]))).toEqual({ ok: true, configuredBy: USER });
  });

  it("stays when the roles are unchanged and the saver cannot give them", () => {
    expect(roleMenuOwner({ roleIds: [A, B], configuredBy: OTHER }, [B, A], USER, new Set())).toEqual({ ok: true, configuredBy: OTHER });
  });

  it("refuses a new menu or new roles the saver cannot give", () => {
    expect(roleMenuOwner(null, [A], USER, new Set())).toEqual({ ok: false });
    expect(roleMenuOwner({ roleIds: [A], configuredBy: OTHER }, [A, B], USER, new Set([A]))).toEqual({ ok: false });
  });
});

describe("stored menus", () => {
  it("drops unreadable options and reads the dates", () => {
    expect(storedOptions([{ roleId: A, label: "Epic", emoji: 3 }, { roleId: "x", label: "y" }, null])).toEqual([{ roleId: A, label: "Epic", emoji: null }]);
    expect(storedOptions("nope")).toEqual([]);
    const at = new Date("2026-11-14T10:00:00Z");
    const view = roleMenuView({
      id: 1,
      guildId: "111111111111111111",
      channelId: CHANNEL,
      title: "Rank",
      description: null,
      mode: "weird",
      options: [],
      configuredBy: USER,
      messageId: null,
      messageChannelId: null,
      publishedAt: null,
      updatedAt: at,
    });
    expect(view).toMatchObject({ mode: "single", publishedAt: null, updatedAt: at.toISOString() });
  });

  it("tells a draft, a published menu and one changed since", () => {
    const at = "2026-11-14T10:00:00.000Z";
    expect(roleMenuStatus({ messageId: null, publishedAt: null, updatedAt: at })).toBe("draft");
    expect(roleMenuStatus({ messageId: "1", publishedAt: at, updatedAt: at })).toBe("published");
    expect(roleMenuStatus({ messageId: "1", publishedAt: at, updatedAt: "2026-11-14T10:05:00.000Z" })).toBe("changed");
  });
});

describe("emojis", () => {
  it("reads custom and unicode emojis", () => {
    expect(parseEmoji("<:rank_epic:666666666666666661>")).toEqual({ kind: "custom", id: "666666666666666661", name: "rank_epic", animated: false });
    expect(parseEmoji("<a:spin:666666666666666661>")).toMatchObject({ animated: true });
    expect(parseEmoji("🏆")).toEqual({ kind: "unicode", value: "🏆" });
    expect(parseEmoji("👍🏽")).toMatchObject({ kind: "unicode" });
    for (const bad of ["epic", "123", "<:x:1>", "<@&555555555555555551>", "https://x"]) expect(parseEmoji(bad)).toBeNull();
    expect(customEmojiText({ id: "666666666666666661", name: "spin", animated: true })).toBe("<a:spin:666666666666666661>");
    expect(emojiImage("666666666666666661", false)).toBe("https://cdn.discordapp.com/emojis/666666666666666661.webp?size=48");
    expect(emojiImage("../x", false)).toBeNull();
  });

  it("finds the community server's rank emojis from the rank roles' names", () => {
    const names = ["warrior", "elite", "master", "grandmaster", "epic", "legend", "mythic", "mythic_honor", "mythic_glory", "mythic_immortal"];
    const emojis = names.map((n, i) => ({ id: `66666666666666660${i}`, name: `rank_${n}`, animated: false }));
    const ranks = ["Warrior", "Elite", "Master", "Grandmaster", "Epic", "Legend", "Mythic", "Mythical Honor", "Mythical Glory", "Mythical Immortal"];
    expect(ranks.map((r) => suggestEmoji(r, emojis)?.name)).toEqual(names.map((n) => `rank_${n}`));
    // Named in full, too.
    expect(suggestEmoji("Mythical Glory", [...emojis, { id: "666666666666666699", name: "rank_mythical_glory", animated: false }])?.name).toBe("rank_mythical_glory");
    // Nothing close: none rather than a wrong one.
    expect(suggestEmoji("Moderator", emojis)).toBeNull();
    expect(suggestEmoji("Epic", [])).toBeNull();
  });
});

describe("the dashboard's role menu section", () => {
  const at = "2026-11-14T10:00:00.000Z";
  const menu = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    channelId: CHANNEL,
    title: `Menu ${id}`,
    description: null,
    mode: "single" as const,
    options: [
      { roleId: A, label: "Epic", emoji: "<:rank_epic:666666666666666661>" },
      { roleId: B, label: "Legend", emoji: "🏆" },
    ],
    configuredBy: USER,
    messageId: null,
    messageChannelId: null,
    publishedAt: null,
    updatedAt: at,
    ...extra,
  });
  const render = (locale: Locale) =>
    renderToStaticMarkup(
      h(LocaleProvider, {
        locale,
        messages: messagesClient(locale),
        children: h(ExtendMessages, {
          messages: messagesPage(locale, ["pages.botUI"]),
          children: h(RoleMenusSection, {
            guildId: "111111111111111111",
            userId: USER,
            initial: [
              menu(1),
              menu(2, { messageId: "777777777777777777", messageChannelId: CHANNEL, publishedAt: at }),
              menu(3, { options: [{ roleId: "555555555555555559", label: "Gone", emoji: null }] }),
            ],
            channels: [{ id: CHANNEL, name: "ranks" }],
            roles: [
              { id: A, name: "Epic", assignable: true, refusal: null, granterRefusal: null },
              { id: B, name: "Legend", assignable: true, refusal: null, granterRefusal: null },
            ],
            emojis: [{ id: "666666666666666661", name: "rank_epic", animated: false }],
            manageRoles: true,
            paused: [2],
            state: { kind: "attention", text: "!" },
          }),
        }),
      }),
    ).replace(/&#x27;/g, "'");

  it("shows each menu's state, its roles with their emojis, and what needs attention, in every language", () => {
    const fr = render("fr");
    expect(fr).toContain("Pas encore publié");
    expect(fr).toContain("Publié dans #ranks");
    expect(fr).toContain("https://cdn.discordapp.com/emojis/666666666666666661.webp?size=48");
    expect(fr).toContain("ne peut plus donner certains de ses rôles");
    expect(fr).toContain("ne peuvent plus être donnés");
    for (const locale of LOCALES) expect(render(locale), locale).not.toMatch(/pages\.botUI/);
  });
});
