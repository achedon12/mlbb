import { describe, expect, it } from "vitest";
import { COMMANDS } from "../src/commands/index.js";
import { exampleLine, HELP_CATEGORIES, HELP_ORDER, helpComponents, helpEmbed, parseHelpPage, type HelpLinks } from "../src/commands/help.js";
import { FAMILIES, FAMILY_COLORS, makeView } from "../src/embeds/common.js";
import { LOCALES, t } from "../src/i18n/index.js";

const SITE = "https://mlbbdex.com";
const en = makeView("en", SITE, "help");
const fr = makeView("fr", SITE, "help");
const links: HelpLinks = {
  invite: "https://discord.com/oauth2/authorize?client_id=1571083624789581834",
  support: "https://discord.gg/mw5RzvkkU3",
  website: `${SITE}/en/bot`,
  vote: "https://discordbotlist.com/bots/mlbbdex/upvote",
};

describe("/help categories", () => {
  it("list every command exactly once, in the six families", () => {
    expect(HELP_CATEGORIES.map((c) => c.key)).toEqual([...FAMILIES]);
    expect([...HELP_ORDER].sort()).toEqual(COMMANDS.map((c) => c.key).sort());
    expect(new Set(HELP_ORDER).size).toBe(HELP_ORDER.length);
  });

  it("every category and example exists in every language", () => {
    for (const locale of LOCALES) {
      for (const c of HELP_CATEGORIES) {
        expect(t(locale, `ui.help.categories.${c.key}`)).not.toMatch(/^ui\./);
        for (const e of c.commands) {
          for (const [option, value] of e.example ?? []) {
            expect(t(locale, `commands.${e.key}.options.${option}.name`), `${locale} ${e.key}.${option}`).not.toMatch(/^commands\./);
            if (value.startsWith("choices.")) expect(t(locale, value), value).not.toBe(value);
          }
        }
      }
    }
  });

  it("examples use the reader's command and option names, and translated choices", () => {
    const build = HELP_CATEGORIES[0]!.commands.find((e) => e.key === "build")!;
    expect(exampleLine(en, build)).toBe("/build hero:Chou rank:Mythical Glory");
    const nickname = HELP_CATEGORIES.find((c) => c.key === "tools")!.commands[0]!;
    expect(exampleLine(fr, nickname)).toBe(`/${t("fr", "commands.nickname.name")} ${t("fr", "commands.nickname.options.text.name")}:Shadow ${t("fr", "commands.nickname.options.style.name")}:${t("fr", "choices.style.fraktur")}`);
    expect(exampleLine(en, { key: "quiz" })).toBe("/quiz");
  });

  it("the overview names each category and its commands, and how to start", () => {
    const json = helpEmbed(en, "overview").toJSON();
    expect(json.fields).toHaveLength(HELP_CATEGORIES.length + 1);
    expect(json.fields?.[0]?.name).toBe("🛡️ Heroes & builds");
    expect(json.fields?.[0]?.value).toContain("`/hero`");
    expect(json.fields?.at(-1)?.value).toContain("`/hero name:Layla`");
    expect(json.color).toBe(FAMILY_COLORS.setup);
  });

  it("a category page shows each command's description and example, in its family's colour", () => {
    const json = helpEmbed(fr, "meta").toJSON();
    expect(json.title).toBe("📊 Méta");
    expect(json.color).toBe(FAMILY_COLORS.meta);
    expect(json.fields?.map((f) => f.name)).toEqual(["/tierlist", "/counter", "/compare"].map((n) => `/${t("fr", `commands.${n.slice(1)}.name`)}`));
    for (const f of json.fields ?? []) expect(f.value).toMatch(/\n`\/.+`$/);
  });

  it("switch with a menu that preselects the page, and end with the four links", () => {
    const [menuRow, buttonRow] = helpComponents(en, "games", links).map((r) => r.toJSON());
    const menu = menuRow!.components[0]!;
    expect("custom_id" in menu && menu.custom_id).toBe("help:page");
    const options = "options" in menu ? menu.options : [];
    expect(options.map((o) => o.value)).toEqual(["overview", ...FAMILIES]);
    expect(options.find((o) => o.default)?.value).toBe("games");
    for (const o of options) expect((o.description ?? "").length).toBeLessThanOrEqual(100);
    const urls = buttonRow!.components.map((c) => ("url" in c ? c.url : ""));
    expect(urls).toEqual([links.invite, links.support, links.website, links.vote]);
  });

  it("drops the support button when no server is configured", () => {
    const buttons = helpComponents(en, "overview", { ...links, support: undefined })[1]!.toJSON().components;
    expect(buttons).toHaveLength(3);
  });

  it("an unknown page value falls back to the overview", () => {
    expect(parseHelpPage("tools")).toBe("tools");
    expect(parseHelpPage("<script>")).toBe("overview");
    expect(parseHelpPage(undefined)).toBe("overview");
  });
});
