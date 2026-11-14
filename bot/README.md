# MLBBDex Discord bot

The Discord companion of [mlbbdex.com](https://mlbbdex.com): hero sheets,
measured builds and counters, tier lists, patch notes, announcements, and the
site's daily MLBBdle and quiz, in English, French, Italian, Spanish and
Indonesian. Free, with no paid tier.

Its own package, separate from the site: own `package.json`, lockfile and
Docker image. It has **no database**: game data comes from the site's public
API (`/api/v1/*`), everything stateful (settings, deliveries, results,
statistics) from the site's internal API (`/api/bot/*`), every call signed.

## Architecture

```
src/index.ts      manager process: ShardingManager, internal HTTP server,
                  announcement delivery, daily posts, full guild sync,
                  bot-list stats (all over REST: no gateway needed)
src/shard.ts      one gateway connection per shard: interactions, joins, leaves,
                  welcome and goodbye messages (member events reach shards only)
src/commands/     one file per slash command (+ its buttons and menus)
src/embeds/       pure embed builders, tested without Discord
src/i18n/         one JSON per language: command names, options, replies
src/site/         public API client (cached), internal API client (signed)
src/security/     HMAC signing and verification
src/http/         the internal server the site calls
src/managers/     delivery, daily posts, greetings, command log, bot lists, fleet
src/games/        MLBBdle comparison, quiz rounds, nicknames, server time
```

- **Sharding from day one**: `ShardingManager` with `totalShards: "auto"`.
  The manager asks the shards through `broadcastEval`; posting goes through
  REST from the manager, so it does not matter which shard holds a server.
- **Least privilege**: the `Guilds` intent, plus the privileged
  `GuildMembers` for one thing only, the join and leave events of the
  welcome and goodbye messages (no member list fetched, nothing about
  members stored; never message content), and the invite asks for 8
  permissions, no Administrator (see [LISTING.md](LISTING.md)).
- **Replies within 3 s**: every command is deferred first; autocomplete has
  a 2.5 s deadline. The lists most commands read (heroes, rankings,
  patches, items) are loaded when a shard starts and every 10 minutes, so
  a command rarely waits on the site. The reply language is the server's
  setting, else the member's Discord language, else English.
- **Status line**: rotates every 5 minutes between "Watching /help ·
  mlbbdex.com", "Playing /mlbbdle daily" and, from 25 servers, the server
  count; set again after every reconnect.
- **Memory-light**: caches with a TTL and a size cap, empty message and
  member caches, a 192 MB heap per process in the image.

## Commands

`/hero`, `/build`, `/counter`, `/tierlist`, `/compare`, `/item`, `/emblem`,
`/spell`, `/patch`, `/skins`, `/events`, `/nickname`, `/mlbbdle`, `/quiz`,
`/leaderboard`, `/servertime`, `/setup`, `/help`, `/invite`, `/about`.

Some commands use public API endpoints the site may not serve yet
(`/api/v1/heroes/:slug/counters`, `/builds`, `/emblems`, `/spells`,
`/patches/:version`, `/skins`, `/events`, `/rankings?rank=`): until then they
fall back to the written analysis, or to a link to the page on the site.

## Running it

```bash
cd bot
npm install
cp .env.example .env          # DISCORD_TOKEN and DISCORD_CLIENT_ID at least
npm run deploy-commands       # once, and after any command or translation change
npm run dev                   # build, then start the manager and its shards
```

Without `DISCORD_TOKEN` the bot stops at once with a message saying what to
set. Without `BOT_API_SECRET` it still answers the game-data commands, with
settings, announcements, daily games and the internal API turned off.

For the welcome and goodbye messages, switch on **Server Members Intent**
in the developer portal (Bot > Privileged Gateway Intents). Without it the
bot logs a warning at start, connects with `Guilds` only and runs as usual,
those two messages off.

`npm run deploy-commands` registers the commands globally (up to an hour to
reach every client). With `DEV_GUILD_ID` set, it registers them on that one
server only, where they appear at once.

All variables are documented in [.env.example](.env.example).

## Internal HTTP server

Called by the site only, on `BOT_HTTP_HOST:BOT_HTTP_PORT` (port 3100, never
published on the host).

| Route | |
| --- | --- |
| `GET /health` | Unsigned, for the healthcheck: `{status}` only |
| `GET /internal/guilds/manageable?user=<id>` | Servers where the user has Manage Server and the bot is present |
| `GET /internal/guilds/:id/manageable?user=<id>` | `{manageable}` |
| `GET /internal/guilds/:id/channels` | Channels the bot can post in, and roles, for the dashboard |
| `POST /internal/announcements/flush` | Deliver pending announcements now (answers 202) |
| `POST /internal/test-post` | `{guildId, channelId, locale}`: posts a test embed; with `kind` (`welcome`/`goodbye`), `message`, `member`, `guildName`, `memberCount`: that message, pinging nobody |
| `GET /internal/stats` | Shards, ping, server count, uptime, memory |

Every `/internal/*` request carries `X-MLBBDex-Timestamp` (unix seconds) and
`X-MLBBDex-Signature`, the hex HMAC-SHA256 of
`${timestamp}.${METHOD}.${path with query}.${raw body}` with `BOT_API_SECRET`.
A timestamp more than 300 s away is refused, the comparison is constant-time,
a POST signature is accepted once, bodies are capped at 64 KB, and each
address is rate limited. The bot signs its calls to the site the same way.

## Announcements and daily posts

- Polled every 2 minutes (`GET /api/bot/announcements/pending`), and at once
  when the site calls `/internal/announcements/flush`.
- A post is remembered until the site has its report: a restart or a site
  outage never posts twice.
- A transient failure is retried with exponential backoff (2 min, doubling,
  capped at 6 h), then reported as failed; a lost permission or a deleted
  channel is reported as `forbidden` at once, and the dashboard shows the
  setting as failing.
- Mentions are locked: `allowed_mentions` parses nothing and allows only the
  role the server configured. A payload cannot ping @everyone or @here.
- The daily MLBBdle and quiz posts go out at each server's chosen UTC hour;
  the bot checks its recent messages for today's post before sending one.

## Welcome and goodbye messages

- Posted by the shard on `guildMemberAdd` / `guildMemberRemove`, in the
  channel and with the text the server set on the dashboard (or the default
  text in its language). Placeholders: `{user}`, `{username}`, `{server}`,
  `{count}`; on a goodbye `{user}` is the plain name.
- The owner's text cannot ping: @everyone/@here are broken, role and user
  mentions removed, and `allowed_mentions` lets through the newcomer alone
  (nobody on a goodbye).
- More than 5 joins within 10 s: one summary message instead of one each,
  and one per 10 s while the raid lasts.
- A channel the bot cannot post in is skipped and marked failing on the
  site, until the settings are saved again.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
docker build .
```

The tests run offline: signing (replay, skew, tamper), translation
completeness, option parsing, embed builders, delivery retries and backoff,
the bot-list poster, the internal server, welcome and goodbye messages
(rendering, sanitising, raid coalescing), and parity of the nickname styles
with the site's `src/lib/nicknames.ts`.

## Docker

```bash
docker build -t mlbbdex-bot bot/
```

Multi-stage, production dependencies only, runs as the `node` user and
writes nothing at run time: it works with `read_only: true`. Logs are JSON
lines on stdout, with tokens and secrets redacted.
