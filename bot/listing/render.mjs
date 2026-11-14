/**
 * Listing visuals for top.gg, discordbotlist.com, discord.bots.gg and the
 * site's /bot page: a 1200×630 banner and mock-ups of the main replies.
 *
 * The mock-ups are not drawn by hand: each one is the JSON the bot's own
 * embed builders produce (`dist/`, so `npm run build` first), from the live
 * public API, laid out the way Discord's dark theme lays out a message, and
 * rasterised with sharp (the site's dependency). Run from `bot/`:
 *
 *   npm run build && node listing/render.mjs
 *
 * Fonts: Noto Sans stands in for Discord's gg sans. Squares of the MLBBdle
 * grid are drawn, not taken from an emoji font.
 */
import { copyFile, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { counterEmbed, heroButtons, heroEmbed, buildEmbed, patchEmbed, tierlistEmbed } from "../dist/embeds/game.js";
import { mlbbdleClassicEmbed } from "../dist/embeds/daily.js";
import { makeView, replyRow, openRow } from "../dist/embeds/common.js";
import { buildsOf, countersOf, rankingOf, topBuildOf } from "../dist/commands/shared.js";
import { GameData } from "../dist/site/game-data.js";
import { inviteUrl } from "../dist/links.js";

const SITE = process.env.SITE_URL ?? "https://mlbbdex.com";
const CLIENT_ID = "1571083624789581834";
const OUT = fileURLToPath(new URL(".", import.meta.url));
const REPO = fileURLToPath(new URL("../../", import.meta.url));

// ── Discord's dark theme ─────────────────────────────────────────────────
const C = {
  bg: "#313338",
  embed: "#2b2d31",
  text: "#dbdee1",
  strong: "#f2f3f5",
  muted: "#949ba4",
  link: "#00a8fc",
  code: "#1e1f22",
  button: "#4e5058",
  blurple: "#5865f2",
};
const FONT = "Noto Sans, DejaVu Sans, sans-serif";
const MONO = "DejaVu Sans Mono, monospace";
const W = 720;
const EMBED_W = 520;
const PAD = { top: 8, right: 16, bottom: 16, left: 12 };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;

// ── Text measurement (Noto Sans advance widths, in em) ───────────────────
function charWidth(ch, bold) {
  let w;
  if (ch === " ") w = 0.26;
  else if ("il.,:;'|!".includes(ch)) w = 0.25;
  else if ("fjrt()[]".includes(ch)) w = 0.33;
  else if ("mwMW".includes(ch)) w = 0.85;
  else if (/[A-Z]/.test(ch)) w = 0.66;
  else if (/[0-9]/.test(ch)) w = 0.57;
  else if (/[a-z]/.test(ch)) w = 0.55;
  else if (ch.codePointAt(0) > 0x2000) w = 0.9;
  else w = 0.58;
  return bold ? w * 1.06 : w;
}
const textWidth = (s, size, bold = false, mono = false) => [...s].reduce((a, ch) => a + (mono ? 0.6 : charWidth(ch, bold)), 0) * size;

// ── Inline markdown: **bold**, `code`, escapes, Discord timestamps, grid squares ──
const SQUARES = { "🟩": "#78b159", "🟧": "#f4900c", "🟥": "#dd2e44", "⬛": "#31373d", "⬆️": "#3b88c3", "⬇️": "#3b88c3" };

function relative(seconds) {
  const diff = seconds * 1000 - Date.now();
  const h = Math.round(Math.abs(diff) / 3_600_000);
  const unit = h >= 24 ? `${Math.round(h / 24)} days` : `${Math.max(1, h)} hours`;
  return diff > 0 ? `in ${unit}` : `${unit} ago`;
}

function tokens(line) {
  const out = [];
  let bold = false;
  let i = 0;
  let buf = "";
  const flush = (extra = {}) => {
    if (buf) out.push({ text: buf, bold, ...extra });
    buf = "";
  };
  while (i < line.length) {
    const rest = line.slice(i);
    const square = Object.keys(SQUARES).find((s) => rest.startsWith(s));
    if (square) {
      flush();
      out.push({ square, arrow: square.startsWith("⬆") ? "↑" : square.startsWith("⬇") ? "↓" : null });
      i += square.length;
    } else if (rest.startsWith("\\") && rest.length > 1) {
      buf += rest[1];
      i += 2;
    } else if (rest.startsWith("**")) {
      flush();
      bold = !bold;
      i += 2;
    } else if (rest.startsWith("`")) {
      const end = rest.indexOf("`", 1);
      flush();
      out.push({ text: rest.slice(1, end), code: true });
      i += end + 1;
    } else if (/^<t:\d+:\w>/.test(rest)) {
      const m = /^<t:(\d+):(\w)>/.exec(rest);
      flush();
      out.push({ text: relative(Number(m[1])), stamp: true });
      i += m[0].length;
    } else {
      buf += rest[0];
      i++;
    }
  }
  flush();
  return out;
}

/** Splits tokens into lines that fit `width`, word by word. */
function wrap(toks, width, size) {
  const lines = [[]];
  let x = 0;
  for (const t of toks) {
    if (t.square) {
      const w = size * 1.35;
      if (x + w > width) {
        lines.push([]);
        x = 0;
      }
      lines.at(-1).push(t);
      x += w;
      continue;
    }
    const words = t.code || t.stamp ? [t.text] : t.text.split(/(?<= )/);
    for (const word of words) {
      const w = textWidth(word, size, t.bold, t.code) + (t.code ? 6 : 0);
      if (x + w > width && x > 0) {
        lines.push([]);
        x = 0;
      }
      lines.at(-1).push({ ...t, text: word });
      x += w;
    }
  }
  return lines;
}

/** Draws wrapped markdown at (x, y); returns the SVG and the height used. */
function markdown(text, x, y, width, { size = 14, color = C.text, lineHeight = 1.375 } = {}) {
  let svg = "";
  let cy = y;
  for (const raw of text.split("\n")) {
    let line = raw;
    let s = size;
    let fill = color;
    if (line.startsWith("-# ")) {
      line = line.slice(3);
      s = 12;
      fill = C.muted;
    }
    if (!line.trim()) {
      cy += s * 0.9;
      continue;
    }
    for (const row of wrap(tokens(line), width, s)) {
      const lh = s * lineHeight;
      const base = cy + lh * 0.75;
      let cx = x;
      for (let k = 0; k < row.length; k++) {
        const t = row[k];
        // A run of plain words is one <text>: the renderer spaces the glyphs,
        // the estimate only places what follows the run.
        if (!t.square && !t.code && !t.stamp) {
          let spans = "";
          let w = 0;
          while (k < row.length && !row[k].square && !row[k].code && !row[k].stamp) {
            const p = row[k++];
            spans += `<tspan font-weight="${p.bold ? 700 : 400}" fill="${p.bold && fill === C.text ? C.strong : fill}">${esc(p.text)}</tspan>`;
            w += textWidth(p.text, s, p.bold);
          }
          k--;
          svg += `<text x="${cx}" y="${base}" font-family="${FONT}" font-size="${s}" xml:space="preserve">${spans}</text>`;
          cx += w;
          continue;
        }
        if (t.square) {
          const q = s * 1.15;
          svg += `<rect x="${cx}" y="${base - q * 0.85}" width="${q}" height="${q}" rx="${q * 0.18}" fill="${SQUARES[t.square]}"/>`;
          if (t.arrow) svg += `<text x="${cx + q / 2}" y="${base - q * 0.12}" font-family="${FONT}" font-size="${s}" font-weight="700" fill="#fff" text-anchor="middle">${t.arrow}</text>`;
          cx += s * 1.35;
          continue;
        }
        if (t.code) {
          const w = textWidth(t.text, s * 0.875, false, true) + 6;
          svg += `<rect x="${cx}" y="${base - s * 0.95}" width="${w}" height="${s * 1.3}" rx="3" fill="${C.code}"/>`;
          svg += `<text x="${cx + 3}" y="${base}" font-family="${MONO}" font-size="${s * 0.875}" fill="${fill}" xml:space="preserve">${esc(t.text)}</text>`;
          cx += w + 1;
          continue;
        }
        const w = textWidth(t.text, s, t.bold);
        if (t.stamp) svg += `<rect x="${cx - 1}" y="${base - s * 0.95}" width="${w + 2}" height="${s * 1.3}" rx="3" fill="#3f4147"/>`;
        svg += `<text x="${cx}" y="${base}" font-family="${FONT}" font-size="${s}" font-weight="${t.bold ? 700 : 400}" fill="${t.bold && fill === C.text ? C.strong : fill}" xml:space="preserve">${esc(t.text)}</text>`;
        cx += w;
      }
      cy += lh;
    }
  }
  return { svg, height: cy - y };
}

// ── Images: fetched from the site, inlined as PNG/JPEG data ─────────────
const imageCache = new Map();
async function inline(url, width, height, fit = "cover") {
  const key = `${url}|${width}|${height}|${fit}`;
  if (imageCache.has(key)) return imageCache.get(key);
  let input;
  if (url.startsWith(SITE)) {
    const local = `${REPO}public${decodeURI(new URL(url).pathname)}`;
    input = await readFile(local).catch(async () => Buffer.from(await (await fetch(url)).arrayBuffer()));
  } else {
    input = Buffer.from(await (await fetch(url)).arrayBuffer());
  }
  const meta = await sharp(input).metadata();
  const h = height ?? Math.round((width * meta.height) / meta.width);
  const png = await sharp(input).resize(width * 2, h * 2, { fit }).png().toBuffer();
  const data = { uri: `data:image/png;base64,${png.toString("base64")}`, height: h };
  imageCache.set(key, data);
  return data;
}

let clipId = 0;
function image(uri, x, y, w, h, r) {
  const id = `c${clipId++}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath><image href="${uri}" x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`;
}

// ── One embed ────────────────────────────────────────────────────────────
async function embed(e, x, y) {
  const inner = EMBED_W - 4 - PAD.left - PAD.right;
  const thumb = e.thumbnail ? 80 : 0;
  const textW = thumb ? inner - thumb - 16 : inner;
  const left = x + 4 + PAD.left;
  let cy = y + PAD.top + 8;
  let svg = "";

  if (e.author) {
    svg += `<text x="${left}" y="${cy + 14}" font-family="${FONT}" font-size="14" font-weight="600" fill="${C.strong}">${esc(e.author.name)}</text>`;
    cy += 24;
  }
  if (e.title) {
    const t = markdown(`**${e.title}**`, left, cy, textW, { size: 16, color: e.url ? C.link : C.strong });
    svg += t.svg.replaceAll(`fill="${C.strong}"`, `fill="${e.url ? C.link : C.strong}"`);
    cy += t.height + 4;
  }
  if (e.description) {
    const d = markdown(e.description, left, cy, textW);
    svg += d.svg;
    cy += d.height + 4;
  }
  // Fields: inline ones share a row (two next to a thumbnail, three otherwise).
  const fields = e.fields ?? [];
  const perRow = thumb ? 2 : 3;
  let i = 0;
  while (i < fields.length) {
    const row = [];
    while (i < fields.length && fields[i].inline && row.length < perRow) row.push(fields[i++]);
    if (!row.length) row.push(fields[i++]);
    const full = !row[0].inline;
    // Next to a thumbnail, Discord keeps every field in the narrower text column.
    const fieldsW = textW;
    const colW = full ? fieldsW : (fieldsW - 8 * (perRow - 1)) / perRow;
    let h = 0;
    row.forEach((f, k) => {
      const fx = left + k * (colW + 8);
      const n = markdown(`**${f.name}**`, fx, cy + 8, colW, { size: 14, color: C.strong });
      const v = markdown(f.value, fx, cy + 8 + n.height + 2, colW);
      svg += n.svg + v.svg;
      h = Math.max(h, 8 + n.height + 2 + v.height);
    });
    cy += h;
  }
  if (thumb) {
    const img = await inline(e.thumbnail.url, 80, 80, "contain");
    svg += image(img.uri, x + EMBED_W - PAD.right - 80, y + PAD.top + 8, 80, 80, 4);
    cy = Math.max(cy, y + PAD.top + 8 + 80);
  }
  if (e.image) {
    const img = await inline(e.image.url, inner, null);
    cy += 16;
    svg += image(img.uri, left, cy, inner, img.height, 4);
    cy += img.height;
  }
  if (e.footer) {
    cy += 8;
    if (e.footer.icon_url) {
      const icon = await inline(e.footer.icon_url, 20, 20);
      svg += image(icon.uri, left, cy, 20, 20, 10);
    }
    svg += `<text x="${left + (e.footer.icon_url ? 28 : 0)}" y="${cy + 14.5}" font-family="${FONT}" font-size="12" font-weight="500" fill="${C.text}">${esc(e.footer.text)}</text>`;
    cy += 20;
  }
  const height = cy - y + PAD.bottom;
  const frame = `<rect x="${x}" y="${y}" width="${EMBED_W}" height="${height}" rx="4" fill="${C.embed}"/><path d="M${x + 4} ${y}h-0a4 4 0 0 0-4 4v${height - 8}a4 4 0 0 0 4 4z" fill="${hex(e.color ?? 0)}"/>`;
  return { svg: frame + svg, height };
}

// ── Buttons ──────────────────────────────────────────────────────────────
function buttons(rows, x, y) {
  let svg = "";
  let cy = y;
  for (const row of rows) {
    let cx = x;
    for (const b of row.components) {
      const label = b.label ?? "";
      const isLink = b.style === 5;
      const w = textWidth(label, 14, false) * 1.08 + 32 + (isLink ? 18 : 0);
      const fill = b.style === 1 ? C.blurple : b.style === 3 ? "#248046" : C.button;
      svg += `<rect x="${cx}" y="${cy}" width="${w}" height="32" rx="4" fill="${fill}"/>`;
      svg += `<text x="${cx + 16}" y="${cy + 21}" font-family="${FONT}" font-size="14" font-weight="500" fill="#fff">${esc(label)}</text>`;
      if (isLink) {
        const ix = cx + w - 26;
        svg += `<path d="M${ix} ${cy + 11}h-3v11h11v-3M${ix + 3} ${cy + 10}h6v6M${ix + 9} ${cy + 10}l-7 7" stroke="#fff" stroke-width="1.6" fill="none"/>`;
      }
      cx += w + 8;
    }
    cy += 40;
  }
  return { svg, height: cy - y };
}

// ── A whole message, with the "used /command" line above it ─────────────
async function message({ command, user = "Shadow", embeds, components = [], ephemeral = false }) {
  const avatar = await inline(`${SITE}/icons/icon-192.png`, 40, 40);
  let y = 16;
  let svg = "";
  // The reply header Discord draws above a slash command's answer.
  svg += `<path d="M38 ${y + 14}v-6a6 6 0 0 1 6-6h22" stroke="#4e5058" stroke-width="2" fill="none"/>`;
  svg += `<circle cx="80" cy="${y + 8}" r="8" fill="#80848e"/>`;
  svg += `<text x="94" y="${y + 13}" font-family="${FONT}" font-size="13" fill="${C.muted}"><tspan fill="${C.text}" font-weight="500">${esc(user)}</tspan> used <tspan fill="${C.link}">${esc(command)}</tspan></text>`;
  y += 22;
  svg += image(avatar.uri, 16, y, 40, 40, 20);
  svg += `<text x="72" y="${y + 16}" font-family="${FONT}" font-size="16" font-weight="500" fill="${C.strong}">MLBBDex</text>`;
  const nameW = textWidth("MLBBDex", 16, true);
  svg += `<rect x="${78 + nameW}" y="${y + 3}" width="31" height="16" rx="3" fill="${C.blurple}"/><text x="${78 + nameW + 15.5}" y="${y + 15}" font-family="${FONT}" font-size="10" font-weight="700" fill="#fff" text-anchor="middle">APP</text>`;
  svg += `<text x="${118 + nameW}" y="${y + 16}" font-family="${FONT}" font-size="12" fill="${C.muted}">Today at 18:04</text>`;
  y += 26;
  for (const e of embeds) {
    const r = await embed(e, 72, y);
    svg += r.svg;
    y += r.height + 8;
  }
  if (components.length) {
    const b = buttons(components, 72, y);
    svg += b.svg;
    y += b.height;
  }
  if (ephemeral) {
    svg += `<text x="72" y="${y + 14}" font-family="${FONT}" font-size="12" fill="${C.muted}">👁 Only you can see this · <tspan fill="${C.link}">Dismiss message</tspan></text>`;
    y += 22;
  }
  const height = y + 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}"><rect width="100%" height="100%" fill="${C.bg}"/>${svg}</svg>`;
}

async function save(name, svg, density = 144) {
  const file = `${OUT}${name}.png`;
  await sharp(Buffer.from(svg), { density }).png({ compressionLevel: 9, palette: true, quality: 95, effort: 10 }).toFile(file);
  const { size } = await stat(file);
  if (size > 1024 * 1024) throw new Error(`${name}.png is ${size} bytes, over 1 MB`);
  // The site's /bot page serves the same visuals as WebP.
  await sharp(file).webp({ quality: 88 }).toFile(`${REPO}public/bot/${name}.webp`);
  // Share cards: not every network reads WebP, so the banner also goes as PNG.
  if (name === "banner") await copyFile(file, `${REPO}public/bot/banner.png`);
  process.stdout.write(`${name}.png ${Math.round(size / 1024)} KB\n`);
}

// ── The replies shown ────────────────────────────────────────────────────
const data = new GameData(SITE);
const view = makeView("en", SITE, "listing");
const ctx = { ...view, services: { data, clientId: CLIENT_ID, config: {} } };
const invite = inviteUrl(CLIENT_ID);
const json = (builder) => builder.toJSON();

const sun = await data.hero("sun");
const ling = await data.hero("ling");
const [ranking, top] = await Promise.all([rankingOf(ctx, "sun"), topBuildOf(ctx, sun)]);

await save(
  "screenshot-hero",
  await message({ command: "/hero", embeds: [json(heroEmbed(view, sun, ranking, top))], components: [json(heroButtons(view, "sun", invite))] }),
);

const { builds, rank } = await buildsOf(ctx, sun, "all");
await save(
  "screenshot-build",
  await message({ command: "/build", embeds: [json(buildEmbed(view, sun, builds, rank))], components: [json(replyRow(view, "/builds/sun", invite))] }),
);

await save(
  "screenshot-counter",
  await message({
    command: "/counter",
    embeds: [json(counterEmbed(view, ling, await countersOf(ctx, ling, "all")))],
    components: [json(replyRow(view, "/heroes/ling/counters", invite))],
  }),
);

const rankings = await data.rankings();
const note = rankings.measuredAt ? view.t("ui.common.measuredAt", { date: rankings.measuredAt.slice(0, 10) }) : null;
await save(
  "screenshot-tierlist",
  await message({
    command: "/tierlist",
    embeds: [json(tierlistEmbed(view, rankings.heroes, null, "/tier-list", note))],
    components: [json(replyRow(view, "/tier-list", invite))],
  }),
);

// MLBBdle: the grid of a game solved in four, the heroes from the site's data.
const heroes = JSON.parse(await readFile(`${REPO}src/data/game/heroes.json`, "utf8"));
const GENDER = { chou: "male", layla: "female", eudora: "female", lunox: "female", kagura: "female" };
const mlbbdleHero = (slug) => {
  const h = heroes.find((x) => x.slug === slug);
  return {
    slug, name: h.name, icon: null, gender: GENDER[slug], roles: h.roles, lanes: h.lanes, specialties: h.specialties,
    damage: h.damageType, range: h.attackType, resource: h.resource, region: h.region, year: Number(h.year),
  };
};
const secret = mlbbdleHero("kagura");
await save(
  "screenshot-mlbbdle",
  await message({
    command: "/mlbbdle",
    embeds: [json(mlbbdleClassicEmbed(view, 412, ["chou", "layla", "lunox", "eudora", "kagura"].map(mlbbdleHero), secret, true))],
    components: [json(openRow(view, "/mlbbdle"))],
    ephemeral: true,
  }),
);

// /patch: the latest patch with the site's own detail of it.
const patches = JSON.parse(await readFile(`${REPO}src/data/game/patches.json`, "utf8"));
const latest = patches.list[0];
const detail = patches.details[latest.version];
await save(
  "screenshot-patch",
  await message({
    command: "/patch",
    embeds: [
      json(
        patchEmbed(view, latest, { ...detail, adjustments: detail.adjustments.map(({ name, slug, type }) => ({ name, slug, type })) }, true),
      ),
    ],
    components: [json(replyRow(view, `/patch-notes/${latest.version}`, invite))],
  }),
);

// ── Banner, 1200×630 ─────────────────────────────────────────────────────
const art = await inline(`${SITE}${Object.values(sun.illustrations ?? {})[0]}`, 820, 630);
const logo = await inline(`${SITE}/icons/icon-512.png`, 96, 96);
const shot = await sharp(`${OUT}screenshot-hero.png`).resize(920).png().toBuffer();
const shotMeta = await sharp(shot).metadata();
const features = ["Hero builds & counters", "Live tier list", "Patch notes & skin alerts", "Daily MLBBdle & quiz"];
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#06080f"/><stop offset="0.4" stop-color="#06080f"/><stop offset="0.7" stop-color="#06080f" stop-opacity="0.55"/><stop offset="1" stop-color="#06080f" stop-opacity="0.2"/></linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5c451"/><stop offset="1" stop-color="#b8871f"/></linearGradient>
</defs>
<rect width="1200" height="630" fill="#06080f"/>
<image href="${art.uri}" x="380" y="0" width="820" height="630" preserveAspectRatio="xMidYMid slice"/>
<rect width="1200" height="630" fill="url(#fade)"/>
<image href="${logo.uri}" x="64" y="64" width="72" height="72"/>
<text x="156" y="114" font-family="${FONT}" font-size="44" font-weight="800" fill="#eef2fb">MLBBDex</text>
<text x="64" y="212" font-family="${FONT}" font-size="50" font-weight="800" fill="url(#gold)">The Mobile Legends</text>
<text x="64" y="272" font-family="${FONT}" font-size="50" font-weight="800" fill="url(#gold)">Discord bot</text>
${features.map((f, k) => `<rect x="64" y="${318 + k * 46}" width="10" height="10" transform="rotate(45 69 ${323 + k * 46})" fill="#e0a92e"/><text x="88" y="${330 + k * 46}" font-family="${FONT}" font-size="26" font-weight="500" fill="#dbe2f0">${esc(f)}</text>`).join("")}
<rect x="64" y="528" width="236" height="52" rx="6" fill="#5865f2"/>
<text x="182" y="561" font-family="${FONT}" font-size="22" font-weight="700" fill="#fff" text-anchor="middle">Add to Discord</text>
<text x="324" y="561" font-family="${FONT}" font-size="22" font-weight="500" fill="#b7c2da">100% free · 5 languages · mlbbdex.com</text>
<g transform="rotate(-3 960 300)"><rect x="${716}" y="${70}" width="${468}" height="${Math.min(470, shotMeta.height / 2 + 8)}" rx="10" fill="#000" opacity="0.35"/>
<clipPath id="shot"><rect x="720" y="64" width="460" height="${Math.min(462, shotMeta.height / 2)}" rx="8"/></clipPath>
<image href="data:image/png;base64,${shot.toString("base64")}" x="720" y="64" width="460" height="${shotMeta.height / 2}" clip-path="url(#shot)" preserveAspectRatio="xMidYMin slice"/></g>
</svg>`;
await save("banner", banner, 72);
