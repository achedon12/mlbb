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
  No Administrator. **Not Manage Roles either**: the auto-roles need it,
  and a server's admin who turns them on grants it (and drags the bot's
  role above the roles to give); the dashboard says so when it is missing.
- Intents: `Guilds`, plus one privileged intent, `GuildMembers`, for a
  single purpose: the `guildMemberAdd` / `guildMemberRemove` events behind
  the welcome and goodbye messages and the auto-roles (plus
  `guildMemberUpdate`, for a member passing membership screening). The
  bot never lists or fetches members
  with it and stores nothing about them; the member cache stays empty.
  Never `MessageContent`, never presences. It needs **Server Members
  Intent** switched on in the developer portal (Bot > Privileged Gateway
  Intents; Discord's review once the bot is past 100 servers). Each shard
  reads the application's flags before connecting: without the switch it
  connects with `Guilds` alone and logs a warning, and only those two
  messages and the auto-roles are off. A 4014 close (intent refused anyway) makes the shard
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
  `welcomeFailing` / `goodbyeFailing`; for the auto-roles, `autoRoleIds`
  (people) and `botAutoRoleIds` (bots), each 0 to 3 role ids (empty = off,
  the default), one `autoRoleFailing` with its `autoRoleFailReason`
  (`bot` or `granter`), and `autoRolesConfiguredBy`, the Discord id of the
  manager who chose them.
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
  `welcome` and `goodbye` included as `{channelId, message, failing}`,
  `autoRoles` as `{roleIds, botRoleIds, failing, failReason, configuredBy}`.
- `POST /api/bot/guilds/:id/greeting-failure` — `{kind: "welcome"|"goodbye"}`:
  the bot could not post that message (channel gone, permission lost); it
  is marked failing, and the bot skips it until the settings are saved.
- `POST /api/bot/guilds/:id/auto-role-failure` — `{reason: "bot"|"granter"}`:
  the bot could not give the auto-roles (`bot`: Manage Roles lost, a role
  gone, moved above it or given a dangerous permission; `granter`: the
  manager who chose them left or can no longer give them); same rule,
  until the settings are saved.
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
  can post in, and roles (for the dashboard pickers): every role but
  @everyone, each with `assignable` and `refusal` (`managed`, `above_bot`,
  `dangerous`, or null), and `manageRoles` (does the bot hold it). Managed
  roles are never offered as a mention.
- `GET  /internal/guilds/:id/can-assign?user=<id>` → `{member, roles:
  [{id, refusal}]}`: which roles that user may have the bot give, the
  member fetched live (`refusal`: `not_member`, `no_manage_roles`,
  `above_user`, or null).
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
- `/help` — an overview, then one page per family (Heroes & builds, Meta,
  Patch & news, Games, Tools, Server setup) switched with a select menu,
  each command with a localized example; links: add to server, support
  server, website, vote on top.gg.
- `/invite`, `/about` (version, servers, online since; links: invite, site,
  support server, vote, privacy).

Autocomplete everywhere a hero/item/emblem/spell is asked, localized names.
All replies within 3 s (defer when calling the site; the main lists are
warmed at start and every 10 minutes). Errors are a friendly embed, never a
stack trace: a name that matches nothing gets "did you mean …?" with the
closest names (the autocomplete matcher, then a few typos away), a site
that does not answer gets a retry hint.

Style: one colour per family (heroes gold, meta red, news green, games
blue, tools violet, setup blurple; a hero sheet takes its tier's colour),
the footer "mlbbdex.com · Data: …" with the site's icon. The hero sheet
has the square icon as thumbnail and the original skin's artwork as image.
Under `/hero`, `/build`, `/counter`, `/tierlist` and `/patch`: one row of
link buttons, "Open on MLBBDex" and, outside the community server
(`SUPPORT_GUILD_ID`), "Add to your server". No DM, no extra message.

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

## Auto-roles

Given by the shard that receives the member event, in one
`member.roles.add([...], "MLBBDex auto-role")` call: `autoRoleIds` to a
person who joins, `botAutoRoleIds` to a bot that is added (never the other
list). Off until a role is chosen.

- Never escalate: before every assignment the bot checks, against its
  cache, that it holds Manage Roles and that each role is below its highest
  role, not managed (integration, bot, booster), not @everyone, and has
  none of Administrator, Manage Server, Manage Roles, Manage Channels, Ban
  Members, Kick Members, Moderate Members, Manage Webhooks, Mention
  Everyone. The dashboard lists only those as choices (the others shown
  disabled with the reason), and the save asks the bot for the same list on
  that request and refuses any other id: another server's role, a typed
  id, a dangerous one.
- No confused deputy: Manage Server opens the dashboard, it does not let
  anyone hand out roles. Whoever sets the lists must be able to give every
  role themselves (owner, or Manage Roles and the role strictly below
  their highest role), asked live to the bot (`can-assign`) on the save;
  otherwise the save is refused ("auto-roles not grantable") and the
  pickers already show those roles disabled with the reason. The saver
  becomes `autoRolesConfiguredBy`. Lists left unchanged are not checked
  again, so another manager can still save other settings; when they are
  failing, a saver who can give them takes them over and clears the flag,
  one who cannot leaves them failing. Before every assignment the bot
  checks that this manager is still a member who could give them (member
  lookup cached 5 minutes per server and manager); if not, nothing is
  given and the auto-roles are marked failing with the reason `granter`,
  which the dashboard explains.
- Membership screening: Discord refuses a role to a member still
  `pending` (rules not accepted yet). Such a member is remembered in
  memory (server and member id, 24 hours at most, 10,000 per shard) and
  given the roles when Discord reports `pending` false. That arrives as
  `guildMemberUpdate`, or as `guildMemberAvailable` when the member is out
  of the (one-entry) member cache, so the bot cannot compare old and new
  itself; a later update of a member it does not remember gives nothing,
  so a role an admin removed is not given back. A restart forgets those
  members: they get no auto-roles. Bots skip screening and get theirs at
  once.
- Raids: one queue per shard, 2 assignments at a time (@discordjs/rest
  waits out the rate limits), capped at 2,000 members waiting; past that a
  member is skipped and logged. There is nothing to coalesce, unlike the
  greetings: each member needs their own call.
- Failures: a refused check or Discord's Missing Permissions marks the
  auto-roles failing (`POST /api/bot/guilds/:id/auto-role-failure`, warn
  log); the bot skips them until the settings are saved. A member who left
  already, an outage or a 5xx is only logged.

## Site pages

- `/[locale]/bot` — landing: what it does, live server count, command list
  (indexable HTML, not images), screenshots, "Add to Discord" and "Join the
  server" buttons, FAQ; JSON-LD `SoftwareApplication`; in the sitemap and
  llms.txt; linked from the header/menus and footer.
- `/[locale]/bot/dashboard` — login with Discord, list of the user's
  manageable servers (and "add the bot" for the others), per-server form:
  language, announcement channels + role per type, daily games channel and
  hour, welcome and goodbye messages (on/off, channel, optional text with
  the placeholders and a live preview), auto-roles (on/off, up to 3 roles
  for members and 3 for bots, a warning when the bot lacks Manage Roles or
  a role is above its own), "send a test" buttons, delivery health.
- `/[locale]/bot/admin` — super admins, over 24 h (by hour), 7 or 30 days
  (by UTC day), each figure against the window before of the same length:
  bot health (status, uptime, memory, version, each shard's status, ping,
  servers and memory, asked live to the bot); tiles for commands run,
  active servers, members reached, daily game players, servers using the
  bot, error rate, p95 response time, announcements posted and votes;
  commands per bucket stacked by command (top five, then "other"), top
  commands with errors and p95, p95 per bucket, users' languages, most
  active servers; joins and leaves per bucket, server languages,
  biggest servers, failing settings; deliveries per announcement type and
  status, last failures; daily game players per day and game; the last
  errors and bot warnings of the site's log; the database backups.
  Actions: "flush announcements", "back up now". Every figure is
  aggregated by Postgres (`src/lib/bot/stats.ts`, a few queries at a time
  so the five-connection pool stays free for the bot) and every chart is
  server-rendered HTML/SVG with CSS tooltips and a screen-reader table
  (`src/components/bot/admin-charts.tsx`). `CommandLog` stores no user
  id, so there is no "unique users of commands" figure: the unique
  players come from the daily games.
- `/[locale]/bot/privacy`, `/[locale]/bot/terms` — required by Discord's
  developer portal and the bot lists.
- The community Discord server link (permanent invite,
  `NEXT_PUBLIC_DISCORD_INVITE_URL`) in the header, footer and `/bot`.

## Database backups

One `pg_dump` a day at 03:30 UTC, the three newest kept
(`src/lib/db-backup.ts`, scheduled with node-cron from
`src/instrumentation.ts`).

- **Where it runs: the site container.** It is the only process holding
  `DATABASE_URL`, it already runs the bot's chores, and the admin panel
  that lists the backups and offers "back up now" lives in it: the list is
  a directory read, the button a direct call, with no new service, network
  route or secret. The image gains `postgresql17-client` (a few MB, Alpine
  package), matching the compose database's major version: an older
  pg_dump refuses a newer server. A dedicated cron container would need
  its own copy of the database password and an API for the panel to read
  its state.
- **Format**: custom (`--format=custom --compress=6 --no-owner
  --no-privileges`), restored with `pg_restore`:
  `pg_restore --clean --if-exists -d "$DATABASE_URL" backups/mlbbdex-….dump`.
- **Where**: `BACKUP_DIR` (`/app/backups` in the image), mounted from
  `./backups` on the host (in `.gitignore` and `.dockerignore`). The host
  folder must belong to the image's user:
  `mkdir -p backups && chown 1001:1001 backups`. Files are named
  `mlbbdex-YYYYMMDD-HHMMSS.dump` (UTC), so name order is date order.
- **Atomic**: the dump is written to a hidden `.….partial` file and renamed
  once pg_dump exits 0 with a non-empty file; a failed dump is deleted.
  Rotation then deletes all but the three newest, and any partial file a
  crash left behind.
- **One at a time**: an in-process flag, plus a lock file created
  exclusively in the folder (two containers sharing it never dump at
  once); a lock older than the dump's 10-minute timeout is a crashed run
  and is taken over.
- **No secret in arguments or logs**: the connection goes to pg_dump as
  `PG*` variables of its own environment (which inherits nothing else of
  the site's, so no bot secret either), never on its command line where
  `ps` would show it. Logs carry file names, sizes and pg_dump's last
  message only.
- **Catch-up**: a site started with no backup of the last 26 hours makes
  one two minutes after startup.
- **Status**: `status.json` in the folder keeps the last run (when, how
  long, which file, or why it failed); the admin panel shows it with the
  list. "Back up now" is `POST /api/discord/admin/backup`, behind the same
  gate as the flush (Origin and `Sec-Fetch-Site`, session, rate limit,
  super admin checked on the request): 409 while a backup runs.
- Only in production, or in development when `BACKUP_DIR` is set.

Three daily dumps on the same disk protect against a bad migration or a
mistaken delete, not against losing the server: copy `./backups`
elsewhere (rsync from another host) for that.

## Listing

- `bot/` posts its server count (and shard count) every 30 minutes to
  top.gg (`TOPGG_TOKEN`), discordbotlist.com (`DBL_TOKEN`) and
  discord.bots.gg (`DBOTSGG_TOKEN`); each is optional — no token, no post.
- The command list goes to discordbotlist.com (`POST
  /api/v1/bots/<id>/commands`, `Authorization: Bot <DBL_TOKEN>`, the very
  array registered with Discord), which shows it on the bot's page: after
  each global `npm run deploy-commands` (skipped with an info line without
  `DBL_TOKEN` or with `DEV_GUILD_ID`; a refusal never fails the Discord
  registration), and once at every start of the manager, with a 10 s
  timeout. The token is never logged.
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
(reverse proxies appending to `X-Forwarded-For`, default 1), `BACKUP_DIR`
(database dumps, `/app/backups` in the image).

Bot: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `BOT_API_SECRET`,
`SITE_URL` (public API) and `SITE_INTERNAL_URL` (`http://mlbb:3001`),
`BOT_HTTP_HOST`, `BOT_HTTP_PORT`, `TOPGG_TOKEN`, `DBL_TOKEN`, `DBOTSGG_TOKEN`,
`SUPPORT_SERVER_URL`, `SUPPORT_GUILD_ID` (the community server's id: no
"Add to your server" button there).

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
  mentions, raid coalescing with fake timers, failing channels, intents),
  and the auto-roles (dangerous permissions, hierarchy and managed roles,
  people and bots apart, pending members, the raid queue, failures).
- Site, against a real Postgres (`tests/functional/bot-database.test.ts`,
  skipped without `TEST_DATABASE_URL`): bulk guild sync and deliveries,
  pending targets, daily servers by hour, leaderboard and admin aggregates,
  the welcome and goodbye settings and the auto-roles (migration
  defaults, signed read, failing flag).
- Both: `npm run typecheck`, `npm run lint`, `npm test`, build.
