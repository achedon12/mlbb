# MLBBDex Discord bot — design

A free, public, multi-server Discord bot named **MLBBDex**, companion of
mlbbdex.com, with a server owner panel and a super admin panel on the site.
Everything is free: no plans, no paywall, no payment code.

## Goals

- Bring the site to where MLBB players already are: their Discord servers.
- Reuse what works on the site (daily MLBBdle and quiz, nickname generator,
  hero sheets, tier lists, patch notes) instead of inventing new content.
- Be listed and found: top.gg, discordbotlist.com, discord.bots.gg, and an
  indexable `/bot` page on the site.
- Secure by default: least privilege, no stored Discord user tokens, signed
  internal calls, secrets only in environment variables.

## Architecture

```
            Discord gateway
                  │
        ┌─────────▼─────────┐   HMAC-signed HTTP    ┌──────────────────────┐
        │  bot/ (discord.js)│ ────────────────────▶ │ Next.js site          │
        │  no DB access     │   /api/bot/*          │  /api/bot/* (internal)│
        │  :3100 internal   │ ◀──────────────────── │  /bot pages, panels   │
        └───────────────────┘   HMAC-signed HTTP    │  Prisma ──▶ Postgres  │
                                (guild checks,      └──────────────────────┘
                                 broadcasts)
```

- **`bot/`**: its own package (TypeScript, ESM, discord.js 14, Node 22), its
  own Dockerfile, no database driver. It reads game data from the site's
  public API (`/api/v1/*`, cached in memory) and everything stateful through
  the internal API. Runs under discord.js `ShardingManager` (`totalShards:
  "auto"`) from day one, so growth past 2,500 servers needs no rewrite.
- **Site**: owns Postgres through Prisma (only the site container has
  `DATABASE_URL`). Adds the internal API, the `/bot` landing, the dashboard,
  the super admin panel, privacy and terms pages.
- **Postgres 17** in `docker-compose.yml`, on an internal network, no
  published port, named volume, healthcheck. `prisma migrate deploy` runs at
  site start (or a one-shot `migrate` service) — never `db push` in
  production.

## Security

- **Bot ↔ site**: every internal request carries
  `X-MLBBDex-Timestamp` (unix seconds) and
  `X-MLBBDex-Signature` = hex HMAC-SHA256(`BOT_API_SECRET`,
  `${timestamp}.${method}.${path}.${body}`). The receiver rejects a timestamp
  more than 300 s away and compares in constant time. Same scheme both ways.
  `BOT_API_SECRET` is ≥ 32 random bytes (`openssl rand -hex 32`); a shorter
  one is refused by the verifier itself, not only by the configuration.
- Replay: the site remembers every signature it accepted for 600 s and
  refuses it a second time (the bot re-signs and retries once on a 401);
  the bot does the same for the site's POSTs.
- Order on the site's `/api/bot/*`: 404 without the bot's configuration,
  rate limit, body cap (declared length, then the stream itself, before
  anything is parsed: 256 KB, 2 MB for the guild sync), signature, then
  JSON and zod. Every signature failure answers the same
  `401 {"error":"unauthorized"}`; the reason only goes to the log. Every
  answer is `Cache-Control: no-store`.
- Rate limits key on the client address the reverse proxy saw: the
  `X-Forwarded-For` entry `TRUSTED_PROXY_HOPS` places from the right
  (default 1), validated as an IP; the client-supplied entries to its left
  are ignored, and so is `X-Real-IP`. Requests without a trustworthy
  address (the bot's direct calls) share one window.
- The bot's HTTP server binds to the internal docker network only, caps
  bodies at 64 KB, and rate limits.
- **Dashboard login**: Discord OAuth2 authorization code flow with PKCE and a
  `state` cookie (sealed, 10 minutes, scoped to `/api/discord/callback`,
  cleared by the callback whatever the outcome), scope `identify` only. The
  redirect URI comes from `NEXT_PUBLIC_SITE_URL`, never from the request;
  the login lands on `/<locale>/bot/dashboard` or `/<locale>/bot/admin`,
  nothing else. The Discord access token is used
  once to read the user id, then dropped: nothing Discord-issued is stored.
  Session = encrypted, httpOnly, Secure, SameSite=Lax cookie
  (`BOT_SESSION_SECRET`, 7 days), holding the Discord user id, name, avatar.
- **Who may configure a server**: asked live to the bot on every read and
  write (`GET /internal/guilds/manageable?user=<id>`,
  `GET /internal/guilds/<guild>/manageable?user=<id>`): the member must have
  `ManageGuild` in that server and the bot must be in it. Listing a user's
  servers costs the bot one Discord member lookup per server it is in, so
  the dashboard pages that ask the bot are capped at 20 views a minute per
  account and 60 per address (past that, "the bot is unreachable").
- **Super admins**: Discord user ids in `BOT_SUPER_ADMIN_IDS`
  (comma-separated), checked server-side on every admin route.
- Mutating routes check `Origin` against `NEXT_PUBLIC_SITE_URL` (and
  `Sec-Fetch-Site: same-origin` when the browser sends it), cap bodies at
  16 KB while reading them, validate them with zod, and are rate limited
  (`limitByMinute`). A server's write takes its id from the path only,
  asks the bot for ManageGuild on that request, and checks every channel
  and role id against what the bot reports for that server.
- Bot invite permissions, least privilege: View Channels, Send Messages,
  Send Messages in Threads, Embed Links, Attach Files, Read Message History,
  Use External Emojis, Add Reactions. Scopes `bot applications.commands`.
  No Administrator.
- Intents: `Guilds`, plus one privileged intent, `GuildMembers`, for a
  single purpose: the `guildMemberAdd` / `guildMemberRemove` events behind
  the welcome and goodbye messages. The bot never lists or fetches members
  with it and stores nothing about them; the member cache stays empty.
  Never `MessageContent`, never presences. It needs **Server Members
  Intent** switched on in the developer portal (Bot > Privileged Gateway
  Intents; Discord's review once the bot is past 100 servers). Each shard
  reads the application's flags before connecting: without the switch it
  connects with `Guilds` alone and logs a warning, and only those two
  messages are off. A 4014 close (intent refused anyway) makes the shard
  log the same warning and exit; its respawn connects without it.
- No personal data beyond Discord ids/names needed for features; documented
  on `/bot/privacy`; `/bot` data deleted when the bot leaves a server
  (after 30 days, so a re-invite keeps its settings).

## Data model (Prisma)

- `Guild`: id (Discord snowflake, PK), name, icon, memberCount, locale
  (one of fr/en/it/es/id, default from the server's preferred locale),
  joinedAt, leftAt (nullable), updatedAt.
- `GuildSettings` (1:1 Guild): for each announcement type —
  `patches`, `skins`, `events`, `advanceServer`, `esports` — a channel id
  (nullable = off) and an optional role id to mention; `dailyMlbbdleChannelId`,
  `dailyQuizChannelId`, `dailyHourUtc` (0–23, default 12); for the
  welcome and goodbye messages, `welcomeChannelId` / `goodbyeChannelId`
  (nullable = off, the default), `welcomeMessage` / `goodbyeMessage`
  (nullable = the default text, at most 500 characters) and
  `welcomeFailing` / `goodbyeFailing`.
- `Announcement`: id, type, key (e.g. patch version, skin id), payload
  (JSON), createdAt. Unique (type, key).
- `Delivery`: announcementId + guildId (composite PK), status, messageId,
  error, sentAt — so a restart never posts twice.
- `CommandLog`: id, command, guildId (nullable), locale, durationMs, ok,
  createdAt. No user id (counts only). Indexed on createdAt (every admin
  figure reads a time window, aggregated by Postgres).
- `DailyResult`: guildId, day, game (`mlbbdle-classic`, `mlbbdle-skill`,
  `quiz`), discordUserId, discordUserName, guesses/points, createdAt. Unique
  (guildId, day, game, discordUserId). For the server leaderboards.

## Internal API (site, `/api/bot/*`, HMAC-signed)

- `POST /api/bot/guilds/sync` — `{ full: boolean, guilds: [{id,name,icon,memberCount,locale}] }`.
  Full sync on bot ready marks absent guilds as left.
- `POST /api/bot/guilds/:id/join`, `POST /api/bot/guilds/:id/leave`.
- `GET  /api/bot/guilds/:id/settings` → settings (defaults if none),
  `welcome` and `goodbye` included as `{channelId, message, failing}`.
- `POST /api/bot/guilds/:id/greeting-failure` — `{kind: "welcome"|"goodbye"}`:
  the bot could not post that message (channel gone, permission lost); it
  is marked failing, and the bot skips it until the settings are saved.
- `GET  /api/bot/announcements/pending` → announcements with the guilds and
  channels still to deliver (the site creates announcements from its own
  data: new patch in `patches.json`, new skins in `skins.json`, events,
  advance server, esports results — detected at site start and after each
  data deploy, idempotent by (type, key)).
- `POST /api/bot/deliveries` — `[{announcementId, guildId, status, messageId?, error?}]`
  (up to 500; `announcementId` as a number or a numeric string), written
  as one bulk upsert.
- `POST /api/bot/commands/log` — batch of `{command, guildId, locale, durationMs, ok}`
  (the bot buffers and flushes every 30 s).
- `GET  /api/bot/daily?day=YYYY-MM-DD` → today's MLBBdle secrets (classic,
  skill) and quiz rounds, computed with `src/lib/mlbbdle.ts` / `quiz.ts`
  exactly like the site, so Discord and site share the same daily puzzle.
- `GET  /api/bot/daily/guilds?hour=0..23[&after=<guild id>]` →
  `{ hour, guilds: [{guildId, locale, dailyMlbbdleChannelId, dailyQuizChannelId}], next }`:
  the servers whose daily post goes out at that hour, a thousand per page
  (`next` = the `after` of the following page, null on the last). The
  bot's hourly round reads this, never every server's settings.
- `POST /api/bot/daily/results`, `GET /api/bot/daily/leaderboard?guild=&game=&period=day|week|all`
  (summed per player by the database; "all" reads the last 366 days).

## Bot internal API (`bot/`, HMAC-signed, port 3100, internal network)

- `GET  /health`
- `GET  /internal/guilds/manageable?user=<id>` → guilds where the user has
  ManageGuild and the bot is present (id, name, icon).
- `GET  /internal/guilds/:id/manageable?user=<id>` → `{ manageable: boolean }`.
- `GET  /internal/guilds/:id/channels` → text/announcement channels the bot
  can post in, and roles (for the dashboard pickers).
- `POST /internal/announcements/flush` → deliver pending now (called by the
  site after it creates announcements).
- `POST /internal/test-post` `{guildId, channelId, locale}` → posts a test
  embed (the dashboard "send a test" button). With `kind: "welcome"|"goodbye"`,
  `message` (the text being edited, or null), `member` `{id, username, avatar}`
  (the dashboard user), `guildName` and `memberCount` (from the site's
  database), it posts that message instead, pinging nobody.
- `GET  /internal/stats` → shards, ping, guild count, uptime, memory.

## Commands

Every name, description and option has localizations for en (default), fr,
it, es-ES, id (`setNameLocalizations` / `setDescriptionLocalizations`),
from `bot/src/i18n/<locale>.json`. Replies use the server's locale setting,
falling back to the interaction locale, then English. Every reply embed
links back to the matching mlbbdex.com page (with the locale prefix and a
`?utm_source=discord&utm_medium=bot` tag so Matomo counts it as a campaign).

- `/hero <name>` — role, lanes, tier, win/pick/ban, best build, emblem,
  spells, combos; buttons: Build · Counters · Skins · Open on MLBBDex.
- `/build <hero>` — top measured build(s) with items and emblem.
- `/counter <hero>` — heroes that beat it and that it beats, measured.
- `/tierlist [rank] [lane|role]` — top tiers.
- `/compare <hero> <hero>` — head-to-head.
- `/item <name>`, `/emblem <name>`, `/spell <name>`.
- `/patch [version]` — latest (or given) patch summary: buffs/nerfs.
- `/skins [hero]` — newest skins, or a hero's skins.
- `/events` — current and upcoming events.
- `/nickname <text> [style]` — styled nickname, with a select menu of styles
  (the site's most used tool).
- `/mlbbdle [mode]` — play today's daily hero in Discord: autocomplete
  guesses, ephemeral feedback grid, public "solved in N" message, server
  leaderboard.
- `/quiz` — today's quiz, buttons for answers, server leaderboard.
- `/leaderboard [game] [period]` — server rankings.
- `/servertime` — game server time and daily reset countdown.
- `/setup` — link to this server's dashboard page (ManageGuild only).
- `/help`, `/invite`, `/about` (links: site, support server, vote, privacy).

Autocomplete everywhere a hero/item/emblem/spell is asked, localized names.
All replies within 3 s (defer when calling the site). Errors are a friendly
ephemeral message, never a stack trace.

## Announcements

Rich embeds (image, colour per type), one per type, posted to the configured
channel, with the optional role mention. Delivery is idempotent (`Delivery`),
retried with backoff, and a channel that lost permissions marks the setting
as failing (shown in the dashboard) instead of retrying forever. The daily
MLBBdle/quiz post goes out at `dailyHourUtc` with a "Play" button.

## Welcome and goodbye messages

Posted by the shard that receives the member event (a server's events
always reach the same shard), to the channel the server chose, as a small
gold embed (the newcomer's avatar as thumbnail on a welcome).

- Text: the owner's (up to 500 characters) or the default one in the
  server's language (`ui.greetings` in the bot's i18n). Placeholders:
  `{user}` (a mention on a welcome, the plain name on a goodbye: someone
  who left is never pinged), `{username}`, `{server}`, `{count}` (member
  count, formatted for the language).
- Safety: in the owner's text @everyone and @here are broken and role and
  user mentions removed; the names filled in are escaped; the welcome
  carries the newcomer's mention in `content` with `allowed_mentions` set
  to that user alone, a goodbye allows nothing. Bots joining are not
  greeted.
- Raids: the first member of a burst is greeted at once, the next ones
  within 10 s are held; at the end of the window, 5 or fewer get one
  message each, more get a single summary ("Welcome to the N new
  members!"), and while it goes on, one summary per 10 s window at most.
  Goodbyes follow the same rule. Only the first few held members are kept
  in memory, for those seconds.
- Delivery: settings through `GET /api/bot/guilds/:id/settings` and its
  2-minute cache. A channel that is unset is skipped silently; one that is
  gone or no longer lets the bot post is skipped, logged at warn and
  reported to `POST /api/bot/guilds/:id/greeting-failure`.

## Site pages

- `/[locale]/bot` — landing: what it does, live server count, command list
  (indexable HTML, not images), screenshots, "Add to Discord" and "Join the
  server" buttons, FAQ; JSON-LD `SoftwareApplication`; in the sitemap and
  llms.txt; linked from the header/menus and footer.
- `/[locale]/bot/dashboard` — login with Discord, list of the user's
  manageable servers (and "add the bot" for the others), per-server form:
  language, announcement channels + role per type, daily games channel and
  hour, welcome and goodbye messages (on/off, channel, optional text with
  the placeholders and a live preview), "send a test" buttons, delivery
  health.
- `/[locale]/bot/admin` — super admins: servers (count, joins/leaves per
  day, biggest servers, locales), commands (top commands, error rate,
  p95 duration, per day 24h/7d/30d), announcements (delivered/failed),
  daily games (players per day), bot health (shards, ping, memory),
  "flush announcements" action.
- `/[locale]/bot/privacy`, `/[locale]/bot/terms` — required by Discord's
  developer portal and the bot lists.
- The community Discord server link (permanent invite,
  `NEXT_PUBLIC_DISCORD_INVITE_URL`) in the header, footer and `/bot`.

## Listing

- `bot/` posts its server count (and shard count) every 30 minutes to
  top.gg (`TOPGG_TOKEN`), discordbotlist.com (`DBL_TOKEN`) and
  discord.bots.gg (`DBOTSGG_TOKEN`); each is optional — no token, no post.
- Vote webhooks (top.gg, DBL) at `/api/bot/votes/<list>` verified with their
  secret (`TOPGG_WEBHOOK_SECRET`, `DBL_WEBHOOK_SECRET`), as each list
  documents it: top.gg v1 signs `${t}.${rawBody}` (HMAC-SHA256, header
  `x-topgg-signature: t=…,v1=…`, refused past 5 minutes, accepted once);
  top.gg legacy and discordbotlist.com send the secret as `Authorization`.
  Constant-time comparisons, 4 KB body cap, nothing parsed before the
  request is authenticated. A vote only thanks
  the voter in DM if they allow it and counts for the admin stats (free bot:
  no rewards to unlock).
- Listing copy (short and long descriptions, tags, in English) kept in
  `bot/LISTING.md`.

## Environment variables

Site: `DATABASE_URL`, `BOT_API_SECRET`, `BOT_INTERNAL_URL`
(`http://bot:3100`), `BOT_SESSION_SECRET`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `BOT_SUPER_ADMIN_IDS`,
`NEXT_PUBLIC_DISCORD_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_INVITE_URL`,
`TOPGG_WEBHOOK_SECRET`, `DBL_WEBHOOK_SECRET`, `TRUSTED_PROXY_HOPS`
(reverse proxies appending to `X-Forwarded-For`, default 1).

Bot: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `BOT_API_SECRET`,
`SITE_URL` (public API) and `SITE_INTERNAL_URL` (`http://mlbb:3001`),
`BOT_HTTP_HOST`, `BOT_HTTP_PORT`, `TOPGG_TOKEN`, `DBL_TOKEN`, `DBOTSGG_TOKEN`,
`SUPPORT_SERVER_URL`.

Postgres: `POSTGRES_PASSWORD` (compose only).

Without the Discord variables the site hides every bot page and the internal
API answers 404, as the push notifications already do: nothing breaks for a
deployment without the bot.

## Testing

- Site: unit tests for HMAC signing/verification (replay, skew, tamper),
  OAuth state/PKCE, settings validation, announcement detection
  idempotence, daily puzzle parity with the site, leaderboard ranking.
- Bot: unit tests for command option parsing, localization completeness
  (every command has every locale, every i18n key in every file),
  embed builders, signing, delivery retry/backoff, listing poster, and the
  welcome and goodbye messages (placeholders, sanitising, allowed
  mentions, raid coalescing with fake timers, failing channels, intents).
- Site, against a real Postgres (`tests/functional/bot-database.test.ts`,
  skipped without `TEST_DATABASE_URL`): bulk guild sync and deliveries,
  pending targets, daily servers by hour, leaderboard and admin aggregates,
  the welcome and goodbye settings (migration defaults, signed read,
  failing flag).
- Both: `npm run typecheck`, `npm run lint`, `npm test`, build.
