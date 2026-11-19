import { describe, expect, it, vi } from "vitest";
import { CARD_FILE, CARD_PATH, profile, profileReply } from "../src/commands/profile.js";
import { makeView } from "../src/embeds/common.js";
import { verify } from "../src/security/signing.js";
import { SiteUnavailableError } from "../src/site/http.js";
import { SiteClient } from "../src/site/internal-api.js";

/**
 * /profile: the site's verdict turned into a reply (the card in the
 * channel, every "no" only to the member who asked), and the signed call
 * that fetches the card.
 */

const SITE = "https://mlbbdex.com";
const SECRET = "k".repeat(64);
const USER = "123456789012345678";
const VIEWER = "223456789012345678";
const en = makeView("en", SITE, "profile");
const fr = makeView("fr", SITE, "profile");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

const button = (reply: ReturnType<typeof profileReply>) => reply.components[0]?.toJSON().components[0] as { label: string; url: string } | undefined;
const text = (reply: ReturnType<typeof profileReply>) => (reply.visibility === "private" ? reply.embeds[0]!.toJSON().description : "");

describe("/profile replies", () => {
  it("posts the card in the channel, with a link to manage it", () => {
    const reply = profileReply(en, { png: PNG }, { own: true, targetName: "Leo" });
    expect(reply.visibility).toBe("channel");
    if (reply.visibility !== "channel") return;
    expect(reply.files[0]!.name).toBe(CARD_FILE);
    expect(reply.files[0]!.description).toBe("Mobile Legends profile card of Leo");
    expect(button(reply)!.label).toBe("My card on MLBBDex");
    expect(button(reply)!.url).toContain(`/en${CARD_PATH.split("#")[0]}`);
    expect(button(reply)!.url).toMatch(/utm_source=discord.*#discord-card$/);
    expect(button(profileReply(en, { png: PNG }, { own: false, targetName: "Leo" }))!.label).toBe("Get your card");
  });

  it("tells the owner how to link or update, privately", () => {
    const notLinked = profileReply(fr, { reason: "notLinked" }, { own: true, targetName: "Leo" });
    expect(notLinked.visibility).toBe("private");
    expect(text(notLinked)).toMatch(/relié ton compte de jeu/);
    expect(button(notLinked)!.label).toBe("Relier mon compte");
    expect(button(notLinked)!.url).toContain("/fr/account");
    const stale = profileReply(en, { reason: "stale" }, { own: true, targetName: "Leo" });
    expect(text(stale)).toMatch(/30 days/);
    expect(button(stale)!.label).toBe("Update my card");
  });

  it("says the same about anyone else's card, linked or not, with the name escaped", () => {
    const reply = profileReply(en, { reason: "unavailable" }, { own: false, targetName: "[x](https://evil.example)" });
    expect(reply.visibility).toBe("private");
    expect(text(reply)).toContain("has no public card");
    expect(text(reply)).toMatch(/^\\\[x\]/);
  });

  it("answers privately when rate limited or when the site is down", () => {
    expect(text(profileReply(en, { reason: "rateLimited" }, { own: true, targetName: "Leo" }))).toMatch(/minute/);
    const down = profileReply(en, "siteDown", { own: true, targetName: "Leo" });
    expect(down.visibility).toBe("private");
    expect(down.components).toEqual([]);
  });

  it("registers a localized command with one optional member option", () => {
    const data = profile.data();
    expect(data.name).toBe("profile");
    expect(data.name_localizations?.fr).toBe("profil");
    expect(data.options).toHaveLength(1);
    expect(data.options![0]).toMatchObject({ name: "user", type: 6, required: false });
  });
});

describe("profile card call", () => {
  const png = () => new Response(new Uint8Array(PNG), { headers: { "content-type": "image/png" } });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("signs the path with both ids and the language, as the site verifies it", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => png());
    const client = new SiteClient("http://mlbb:3001", SECRET, fetch);
    const card = await client.profileCard(USER, VIEWER, "fr");
    expect(card).toEqual({ png: PNG });
    const [url, init] = fetch.mock.calls[0]!;
    const u = new URL(url);
    expect(u.pathname + u.search).toBe(`/api/bot/profile?user=${USER}&viewer=${VIEWER}&locale=fr`);
    const headers = init!.headers as Record<string, string>;
    expect(
      verify({ secret: SECRET, timestamp: headers["X-MLBBDex-Timestamp"], signature: headers["X-MLBBDex-Signature"], method: "GET", path: u.pathname + u.search, body: "" }),
    ).toEqual({ ok: true });
  });

  it("reads a refusal, an unknown reason as the least telling one", async () => {
    const client = (body: unknown) => new SiteClient("http://mlbb:3001", SECRET, vi.fn(async () => json(body)));
    expect(await client({ reason: "notLinked" }).profileCard(USER, USER, "en")).toEqual({ reason: "notLinked" });
    expect(await client({ reason: "somethingNew" }).profileCard(USER, VIEWER, "en")).toEqual({ reason: "unavailable" });
    await expect(client([1, 2]).profileCard(USER, VIEWER, "en")).rejects.toBeInstanceOf(SiteUnavailableError);
  });

  it("turns a site error into SiteUnavailableError", async () => {
    const client = new SiteClient("http://mlbb:3001", SECRET, vi.fn(async () => json({ error: "drawing failed" }, 503)));
    await expect(client.profileCard(USER, VIEWER, "en")).rejects.toBeInstanceOf(SiteUnavailableError);
  });
});
