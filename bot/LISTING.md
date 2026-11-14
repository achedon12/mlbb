# MLBBDex: bot list copy

Copy for top.gg, discordbotlist.com and discord.bots.gg, in English. Keep it
in step with the commands (`src/commands/`) and the site's `/bot` page.

## Name

MLBBDex

## Short description

> Mobile Legends: Bang Bang in your server: hero sheets, measured builds and counters, tier lists, patch alerts, and the daily MLBBdle and quiz. Free, in 5 languages.

(164 characters.)

## Long description

```markdown
# MLBBDex

**Mobile Legends: Bang Bang knowledge, right in your Discord server.**
MLBBDex is the companion bot of [mlbbdex.com](https://mlbbdex.com), a free
MLBB knowledge base. Every answer comes from the site's data, refreshed every
night from the game's statistics and the Mobile Legends Wiki, and links back
to the full page.

## What it does

- **Hero sheets**: role, lanes, tier, win, pick and ban rates, best build,
  skills, with buttons for builds, counters and skins.
- **Measured builds and counters**: what players actually win with, and who
  beats whom, by rank bracket, from real match statistics.
- **Tier lists** by rank, lane or role, computed from win and ban rates.
- **Items, emblems and battle spells** at a glance, with autocomplete.
- **Patch notes**: the latest patch, or any version, with its buffs and nerfs.
- **Announcements in your channels**: new patches, new skins, events,
  advance server and esports results, with an optional role ping. You choose
  the channel and the role per type on the dashboard.
- **Daily games**: today's **MLBBdle** (guess the hero, classic or skill
  mode) and the **daily quiz**, the very same puzzles as on mlbbdex.com, with
  a server leaderboard and an optional daily post at the hour you pick.
- **Nickname generator**: write your in-game name in 21 stylish fonts.
- **Server time**: game server clock and countdowns to the daily and weekly
  resets.

## Commands

| Command | What it does |
| --- | --- |
| `/hero <name>` | A hero's sheet, with Build · Counters · Skins buttons |
| `/build <hero> [rank]` | The builds players win with |
| `/counter <hero> [rank]` | Who beats the hero, and whom it beats |
| `/tierlist [rank] [lane] [role]` | The current tier list |
| `/compare <hero> <hero>` | Two heroes head to head |
| `/item`, `/emblem`, `/spell` | Item, emblem and battle spell details |
| `/patch [version]` | Patch summary |
| `/skins [hero]` | Newest skins, or a hero's skins |
| `/events` | Current and upcoming events |
| `/nickname <text> [style]` | Stylish nickname |
| `/mlbbdle [guess] [mode]` | Today's MLBBdle |
| `/quiz` | Today's quiz |
| `/leaderboard [game] [period]` | This server's rankings |
| `/servertime` | Server time and resets |
| `/setup` | This server's dashboard (Manage Server only) |
| `/help`, `/invite`, `/about` | Help, invite link, about |

## Completely free

No premium tier, no vote lock, no paywall: every command and every feature is
free for every server.

## Five languages

English, French, Italian, Spanish and Indonesian. Commands appear in your
Discord language; replies follow the language chosen for the server, or each
member's own.

## Privacy and permissions

- Only the permissions it uses: view channels, send messages (and in
  threads), embed links, attach files, read message history, use external
  emojis, add reactions. **No Administrator.**
- **No privileged intents**: the bot does not read your messages and does
  not download your member list.
- It stores your server's settings and, for the leaderboards, the Discord id
  and name of players of the daily games. Command statistics are counts only,
  with no user id. Details: [mlbbdex.com/en/bot/privacy](https://mlbbdex.com/en/bot/privacy).
- Open source: [github.com/achedon12/mlbb](https://github.com/achedon12/mlbb).
```

## Suggested tags

Mobile Legends, MLBB, Gaming, MOBA, Tier List, Game Stats, Utility, Fun,
Leaderboard, Multilingual

(top.gg allows a limited number of tags: keep the first five.)

## Invite

Scopes: `bot applications.commands`.

Permissions, least privilege:

| Permission | Bit | Value |
| --- | --- | --- |
| Add Reactions | 1 << 6 | 64 |
| View Channels | 1 << 10 | 1024 |
| Send Messages | 1 << 11 | 2048 |
| Embed Links | 1 << 14 | 16384 |
| Attach Files | 1 << 15 | 32768 |
| Read Message History | 1 << 16 | 65536 |
| Use External Emojis | 1 << 18 | 262144 |
| Send Messages in Threads | 1 << 38 | 274877906944 |
| **Total** | | **274878286912** |

```
https://discord.com/oauth2/authorize?client_id=<DISCORD_CLIENT_ID>&permissions=274878286912&scope=bot+applications.commands
```

`tests/embeds.test.ts` checks that `INVITE_PERMISSIONS` (in `src/links.ts`)
still equals this total.

## Links for the listing forms

- Website: https://mlbbdex.com/en/bot
- Privacy policy: https://mlbbdex.com/en/bot/privacy
- Terms of service: https://mlbbdex.com/en/bot/terms
- Support server: the `SUPPORT_SERVER_URL` invite
- Source code: https://github.com/achedon12/mlbb
