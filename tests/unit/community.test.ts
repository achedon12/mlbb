import { afterEach, describe, expect, it } from "vitest";
import {
  canDelete,
  canEdit,
  cardInput,
  isBanned,
  isNewAccount,
  knownHeroes,
  readPageNumber,
  readQuery,
  readSort,
  replyInput,
  reportInput,
  slugify,
  threadIdOf,
  threadInput,
  threadPath,
} from "@/lib/community/rules";
import { fold, links, screenText } from "@/lib/community/filter";
import { plainText, renderMarkdown } from "@/lib/community/markdown";

const HOUR = 3600_000;

describe("community rules", () => {
  it("builds stable thread addresses and reads them back", () => {
    expect(slugify("Best build for Ling? (Mythic, S38)")).toBe("best-build-for-ling-mythic-s38");
    expect(slugify("Été : quel héros ?")).toBe("ete-quel-heros");
    expect(slugify("!!!")).toBe("thread");
    expect(slugify("a".repeat(100))).toHaveLength(60);
    expect(threadPath({ id: 42, title: "Hello world", category: "general" })).toBe("/community/general/42-hello-world");
    expect(threadIdOf("42-hello-world")).toBe(42);
    expect(threadIdOf("42")).toBe(42);
    expect(threadIdOf("0-x")).toBeNull();
    expect(threadIdOf("abc")).toBeNull();
    expect(threadIdOf("42-<script>")).toBeNull();
    expect(threadIdOf("9999999999")).toBeNull();
  });

  it("reads list parameters defensively", () => {
    expect(readSort("top")).toBe("top");
    expect(readSort("random")).toBe("latest");
    expect(readPageNumber("3")).toBe(3);
    expect(readPageNumber("0")).toBe(1);
    expect(readPageNumber("-2")).toBe(1);
    expect(readPageNumber("1e3")).toBe(1);
    expect(readPageNumber("40", 20)).toBe(20);
    expect(readQuery("  ling ‮ build\n")).toBe("ling build");
    expect([...readQuery("x".repeat(500))]).toHaveLength(100);
  });

  it("opens edit and delete windows from the post's creation", () => {
    const created = new Date(0);
    expect(canEdit(created, HOUR - 1)).toBe(true);
    expect(canEdit(created, HOUR)).toBe(false);
    expect(canDelete(created, 23 * HOUR)).toBe(true);
    expect(canDelete(created, 24 * HOUR)).toBe(false);
    expect(isNewAccount(created, 71 * HOUR)).toBe(true);
    expect(isNewAccount(created, 72 * HOUR)).toBe(false);
  });

  it("tells a running ban from a lifted or expired one", () => {
    const now = 10 * HOUR;
    expect(isBanned(null, now)).toBe(false);
    expect(isBanned({ bannedAt: null, banUntil: null }, now)).toBe(false);
    expect(isBanned({ bannedAt: new Date(0), banUntil: null }, now)).toBe(true);
    expect(isBanned({ bannedAt: new Date(0), banUntil: new Date(now + 1) }, now)).toBe(true);
    expect(isBanned({ bannedAt: new Date(0), banUntil: new Date(now) }, now)).toBe(false);
  });

  it("accepts a thread and cleans its text, refuses bad fields and extra keys", () => {
    const ok = threadInput.parse({ category: "general", title: "  Hello​   world  ", body: "A long enough body\r\n\r\n\r\n\r\nend" });
    expect(ok).toEqual({ category: "general", title: "Hello world", body: "A long enough body\n\nend", heroes: [] });
    expect(threadInput.safeParse({ category: "nope", title: "Hello world", body: "A long enough body" }).success).toBe(false);
    expect(threadInput.safeParse({ category: "general", title: "Hi", body: "A long enough body" }).success).toBe(false);
    expect(threadInput.safeParse({ category: "general", title: "Hello world", body: "short" }).success).toBe(false);
    expect(threadInput.safeParse({ category: "general", title: "Hello world", body: "x".repeat(10_001) }).success).toBe(false);
    expect(threadInput.safeParse({ category: "general", title: "Hello world", body: "A long enough body", admin: true }).success).toBe(false);
    expect(threadInput.safeParse({ category: "general", title: "Hello world", body: "A long enough body", heroes: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
    expect(replyInput.safeParse({ body: " " }).success).toBe(false);
    expect(replyInput.parse({ body: "ok!" })).toEqual({ body: "ok!" });
  });

  it("keeps known hero tags only, each once", () => {
    expect(knownHeroes(["ling", "nobody", "ling", "fanny"], new Set(["ling", "fanny"]))).toEqual(["ling", "fanny"]);
  });

  it("reads reports strictly", () => {
    expect(reportInput.parse({ kind: "post", id: 3, reason: "spam", note: "  bot  " })).toEqual({ kind: "post", id: 3, reason: "spam", note: "bot" });
    expect(reportInput.safeParse({ kind: "user", id: 3, reason: "spam" }).success).toBe(false);
    expect(reportInput.safeParse({ kind: "post", id: -1, reason: "spam" }).success).toBe(false);
    expect(reportInput.safeParse({ kind: "post", id: 3, reason: "hate" }).success).toBe(false);
  });

  it("validates a teammate card and normalises its contacts", () => {
    const base = { region: "eu", rank: "mythic", lanes: ["Gold", "Gold", "Roam"], languages: ["fr", "en"] };
    expect(cardInput.parse({ ...base, gameId: "12345678(1234)", discord: "leo.mlbb", note: "" })).toMatchObject({
      lanes: ["Gold", "Roam"],
      heroes: [],
      playTimes: [],
      gameId: "12345678 (1234)",
      discord: "leo.mlbb",
      note: null,
    });
    expect(cardInput.parse({ ...base, gameId: "12345678 1234" }).gameId).toBe("12345678 (1234)");
    expect(cardInput.parse(base)).toMatchObject({ gameId: null, discord: null, note: null });
    expect(cardInput.safeParse({ ...base, gameId: "call me" }).success).toBe(false);
    expect(cardInput.safeParse({ ...base, discord: "@everyone" }).success).toBe(false);
    expect(cardInput.safeParse({ ...base, note: "join www.example.com" }).success).toBe(false);
    expect(cardInput.safeParse({ ...base, lanes: [] }).success).toBe(false);
    expect(cardInput.safeParse({ ...base, lanes: ["Top"] }).success).toBe(false);
    expect(cardInput.safeParse({ ...base, languages: ["en", "fr", "es", "it", "id"] }).success).toBe(false);
    expect(cardInput.safeParse({ ...base, region: "mars" }).success).toBe(false);
  });
});

describe("community filter", () => {
  afterEach(() => {
    delete process.env.COMMUNITY_BLOCKED_WORDS;
    delete process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;
  });

  it("folds case, accents, digit swaps and spaced letters", () => {
    expect(fold("Héllo  W0RLD")).toBe("hello world");
    expect(fold("f.a.g")).toBe("fag");
    expect(fold("n1gg3r")).toBe("nigger");
  });

  it("refuses slurs, whole words only", () => {
    const options = { newAccount: false };
    expect(screenText("you are a f.a.g", options)).toBe("blocked");
    expect(screenText("F A G", options)).toBe("blocked");
    expect(screenText("Retard team", options)).toBe("blocked");
    expect(screenText("Skill issue, raccoon, Scunthorpe, retardation of the turtle", options)).toBe("ok");
    process.env.COMMUNITY_BLOCKED_WORDS = "Booster, xy";
    expect(screenText("buy a booster", options)).toBe("blocked");
    expect(screenText("xy", options)).toBe("ok");
  });

  it("refuses scam bait, shorteners and other servers' invites", () => {
    const options = { newAccount: false };
    expect(screenText("FREE DIAMONDS here", options)).toBe("spam");
    expect(screenText("see https://bit.ly/abc", options)).toBe("spam");
    expect(screenText("see https://bit.ly./abc", options)).toBe("spam");
    expect(screenText("join https://discord.gg/other", options)).toBe("spam");
    expect(screenText("join https://discord.com/invite/other", options)).toBe("spam");
    expect(screenText("docs at https://discord.com/developers/docs", options)).toBe("ok");
    process.env.NEXT_PUBLIC_DISCORD_INVITE_URL = "https://discord.gg/mlbbdex";
    expect(screenText("our server: https://discord.gg/mlbbdex.", options)).toBe("ok");
    expect(screenText("see [wiki](https://mobile-legends.fandom.com/wiki/Ling)", options)).toBe("ok");
  });

  it("caps links, and new accounts post none", () => {
    const six = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`).join(" ");
    expect(screenText(six, { newAccount: false })).toBe("links");
    expect(screenText("www.example.com", { newAccount: true })).toBe("newAccountLinks");
    expect(screenText("no link here", { newAccount: true })).toBe("ok");
    expect(links("a https://x.org/a, and www.y.org.").map((u) => u?.hostname)).toEqual(["x.org", "www.y.org"]);
  });
});

describe("community markdown", () => {
  it("renders the usual Markdown", () => {
    const html = renderMarkdown("# Title\n\n**bold** *it* `code`\n\n- a\n- b\n\n> quote");
    expect(html).toContain("<h3>Title</h3>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>it</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("<blockquote>");
  });

  it("never lets HTML, scripts or unsafe links through", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script><img src=x onerror=alert(1)> <b onclick="x">b</b>\n\n[x](javascript:alert(1)) [y](data:text/html,hi) ![img](https://e.com/a.png)',
    );
    expect(html).not.toMatch(/<script|<img|<b[\s>]|<span|<[^>]*\son\w+=|href="(?:javascript|data):/i);
    expect(html).toContain("&lt;script&gt;");
    // An unsafe link keeps its text, not its address.
    expect(html).toMatch(/>x<\/a>|\bx\b/);
    expect(html).not.toContain('href=""');
    // The image becomes a plain link to it.
    expect(html).toContain('<a href="https://e.com/a.png"');
  });

  it("marks every link as user content, opened without referrer", () => {
    const html = renderMarkdown("[wiki](https://mobile-legends.fandom.com) and https://mlbbdex.com");
    expect(html.match(/rel="nofollow ugc noopener noreferrer"/g)).toHaveLength(2);
    expect(html).toContain('target="_blank"');
  });

  it("gives a plain-text excerpt", () => {
    expect(plainText("**Ling** & <Fanny>\n\n- jungle")).toBe("Ling & <Fanny> jungle");
    expect(plainText("word ".repeat(100), 20)).toHaveLength(20);
  });
});

describe("readQuery", () => {
  it("ignores a repeated parameter instead of failing", async () => {
    const { readQuery } = await import("@/lib/community/rules");
    expect(readQuery(["a", "b"])).toBe("");
    expect(readQuery("ling build")).toBe("ling build");
  });
});

describe("plainText", () => {
  it("decodes each entity once", async () => {
    const { plainText } = await import("@/lib/community/markdown");
    expect(plainText("Tom &amp;lt;3 Jerry & <b>")).toBe("Tom &lt;3 Jerry & <b>");
  });
});
