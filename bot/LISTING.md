# MLBBDex: bot list copy

Copy and visuals for top.gg, discordbotlist.com and discord.bots.gg, in
English. Keep it in step with the commands (`src/commands/`) and the site's
`/bot` page.

## Visuals

In [`listing/`](listing/), generated from the bot's own embed builders and
the live public API (`npm run build && node listing/render.mjs`, which also
writes the WebP copies the site serves under `/bot/`). Each file is under
1 MB.

| File | Size | Use |
| --- | --- | --- |
| `listing/banner.png` | 1200×630 | top.gg banner / background, social card |
| `listing/screenshot-hero.png` | 1440 wide | `/hero`: sheet, artwork, buttons |
| `listing/screenshot-build.png` | 1440 wide | `/build` |
| `listing/screenshot-counter.png` | 1440 wide | `/counter` |
| `listing/screenshot-tierlist.png` | 1440 wide | `/tierlist` |
| `listing/screenshot-mlbbdle.png` | 1440 wide | `/mlbbdle`, a solved grid |
| `listing/screenshot-patch.png` | 1440 wide | `/patch`, the latest patch |

The descriptions below link the WebP copies on the site
(`https://mlbbdex.com/bot/<name>.webp`), live once the site is deployed:
bot lists only show images by URL.

## Name

MLBBDex

## Short description

One version for every list (top.gg caps it at 200 characters,
discordbotlist.com and discord.bots.gg at less in their cards: the second
one is for those).

> The Mobile Legends (MLBB) Discord bot: hero builds and counters from ranked games, live tier list, patch notes, skin alerts and a daily MLBBdle. 100% free, 5 languages.

(168 characters.)

> Mobile Legends bot: MLBB builds, counters, tier list, patch notes and daily MLBBdle. Free, 5 languages.

(103 characters.)

## Long description: top.gg

top.gg renders Markdown (and some HTML). Paste as is:

```markdown
# MLBBDex — the Mobile Legends Discord bot

**Everything a Mobile Legends: Bang Bang player looks up, answered in your server.**
Hero builds, counters, the tier list and patch notes, measured on real ranked games
and refreshed every day by [mlbbdex.com](https://mlbbdex.com/en/bot?utm_source=topgg),
plus a daily hero-guessing game for your community.

![A hero sheet in Discord](https://mlbbdex.com/bot/screenshot-hero.webp)

## ✨ Features

- 🛡️ **Hero sheets**: role, lanes, tier, win, pick and ban rates, best build, emblem,
  spell and skills, with the hero's artwork and Build · Counters · Skins buttons.
- ⚔️ **Builds and counters**: the items players win with, and who beats whom.
- 📊 **Live tier list** by rank (Epic to Mythical Glory), lane or role.
- 📰 **Patch notes**: buffs, nerfs and changed heroes of the latest patch, or any version.
- 🔔 **Automatic announcements** in the channels you choose: new patches, new skins,
  events, Advance Server, esports results, with an optional role ping.
- 🎮 **Daily MLBBdle and quiz**: guess today's hero (classic or skill mode), the same
  puzzle as on mlbbdex.com, with a server leaderboard and an optional daily post.
- 👋 **Welcome and goodbye messages**, raid-safe (one message for a burst, not a flood).
- 🎭 **Auto-roles** (optional): roles for new members and for bots, only ones the manager could give.
- 🏅 **Role menus** (optional): a message where members pick their own roles, their rank for instance (one at a time or several), with your server's emojis.
- 🧰 **Tools**: stylish nickname generator (21 fonts), server time and reset countdowns.
- 🔎 **Autocomplete everywhere** and "did you mean…?" when a name has a typo.

![Tier list](https://mlbbdex.com/bot/screenshot-tierlist.webp)

## 📋 Commands

| Command | What it does |
| --- | --- |
| `/hero name:Layla` | Hero sheet: role, lanes, tier, rates, best build, skills |
| `/build hero:Chou` | The builds players win with, by rank |
| `/counter hero:Ling` | Who beats the hero, and whom it beats |
| `/tierlist rank:Mythic` | The current meta, by rank, lane or role |
| `/compare first:Chou second:Paquito` | Two heroes head to head |
| `/item`, `/emblem`, `/spell` | Item, emblem and battle spell details |
| `/patch` | Latest patch notes, or any version |
| `/skins`, `/events` | Newest skins, a hero's skins, current events |
| `/mlbbdle`, `/quiz`, `/leaderboard` | Daily games and this server's rankings |
| `/nickname`, `/servertime` | Stylish nickname, server time and resets |
| `/setup` | This server's dashboard (Manage Server only) |
| `/help`, `/invite`, `/about` | Help by category, invite link, about |

![Counters](https://mlbbdex.com/bot/screenshot-counter.webp)
![Daily MLBBdle](https://mlbbdex.com/bot/screenshot-mlbbdle.webp)
![Patch notes](https://mlbbdex.com/bot/screenshot-patch.webp)

## 💸 100% free

No premium tier, no vote lock, no paywall: every command and every feature is free for
every server.

## 🌍 Five languages

English, French, Italian, Spanish and Indonesian. Commands appear in your Discord
language; replies follow the language set for the server, or each member's own.

## 🔒 Privacy and permissions

- Only the permissions it uses. **No Administrator**, never reads your messages.
- One privileged intent (Server Members), only for the welcome and goodbye messages
  and the auto-roles; nothing about your members is stored.
- Auto-roles and role menus need Manage Roles, which the invite does not ask for:
  you grant it if you use them, and the bot never gives a role with moderation permissions.
- Details: [mlbbdex.com/en/bot/privacy](https://mlbbdex.com/en/bot/privacy).
  Open source: [github.com/achedon12/mlbb](https://github.com/achedon12/mlbb).

## 🤝 Support

Questions, ideas, bugs: [join the MLBBDex server](https://discord.gg/mw5RzvkkU3).
Website and dashboard: [mlbbdex.com/en/bot](https://mlbbdex.com/en/bot).
```

## Long description: discordbotlist.com

discordbotlist.com renders Markdown but shows a narrower column: shorter,
images kept to two.

```markdown
## MLBBDex — the Mobile Legends Discord bot

Hero **builds**, **counters**, the **tier list** and **patch notes** for Mobile Legends:
Bang Bang, measured on ranked games and refreshed every day by
[mlbbdex.com](https://mlbbdex.com/en/bot?utm_source=dbl). Plus the daily **MLBBdle**
and quiz, with a leaderboard for your server.

![Hero sheet](https://mlbbdex.com/bot/screenshot-hero.webp)

**What you get**

- `/hero`, `/build`, `/counter`, `/compare`: everything about a hero, with autocomplete.
- `/tierlist`: the meta by rank, lane or role.
- `/patch`, `/skins`, `/events`: the news, and automatic announcements in your channels.
- `/mlbbdle`, `/quiz`, `/leaderboard`: daily games for your community.
- Welcome and goodbye messages, nickname generator, server time.

![Tier list](https://mlbbdex.com/bot/screenshot-tierlist.webp)

**100% free** (no premium, no vote lock) · **5 languages** (EN, FR, IT, ES, ID) ·
**No Administrator permission** · [Support server](https://discord.gg/mw5RzvkkU3) ·
[Privacy](https://mlbbdex.com/en/bot/privacy)
```

The command list itself is sent by the bot (see `postCommandsToDbl` in
`src/managers/listing.ts`): no need to type it in the form.

## Long description: discord.bots.gg

discord.bots.gg renders Markdown, without tables in some themes: lists only.

```markdown
# MLBBDex — Mobile Legends Discord bot

The free Mobile Legends: Bang Bang knowledge bot, companion of
[mlbbdex.com](https://mlbbdex.com/en/bot?utm_source=dbotsgg).

**Heroes & builds** — `/hero`, `/build`, `/skins`, `/item`, `/emblem`, `/spell`
**Meta** — `/tierlist`, `/counter`, `/compare`
**Patch & news** — `/patch`, `/events`, plus automatic announcements of patches, skins,
events, Advance Server and esports results
**Games** — `/mlbbdle` (guess today's hero), `/quiz`, `/leaderboard`
**Tools** — `/nickname` (21 fonts), `/servertime`
**Server setup** — `/setup` (dashboard on mlbbdex.com), `/help`, `/invite`, `/about`

![Hero sheet](https://mlbbdex.com/bot/screenshot-hero.webp)

- Builds and counters measured on ranked games, refreshed daily
- 100% free, in English, French, Italian, Spanish and Indonesian
- No Administrator permission, never reads messages
- Support: https://discord.gg/mw5RzvkkU3 · Privacy: https://mlbbdex.com/en/bot/privacy
```

## Tags

Each list has its own fixed list of tags: pick from it. "(verify)" marks a
tag not confirmed to exist on that list; check the form before saving.

| List | Tags, in order |
| --- | --- |
| top.gg (up to 20, the first ones weigh most) | Game, Fun, Utility, Social, Mobile Legends (verify), MLBB (verify), MOBA (verify), Esports (verify), Leaderboard (verify), Multilingual (verify), Stats (verify), Tier List (verify), Gaming (verify) |
| discordbotlist.com | games, fun, utility, social, leaderboard (verify), stats (verify), multilingual (verify) |
| discord.bots.gg | no tags: the category is "Games" (verify) |

Keywords to keep in the copy, since lists search the text too: Mobile
Legends, MLBB, Bang Bang, build, counter, tier list, meta, patch notes,
MLBBdle, Moonton.

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
https://discord.com/oauth2/authorize?client_id=1571083624789581834&permissions=274878286912&scope=bot+applications.commands
```

`tests/embeds.test.ts` checks that `INVITE_PERMISSIONS` (in `src/links.ts`)
still equals this total.

**Manage Roles is deliberately not in the invite.** Auto-roles and role
menus need it: a server's admin who turns them on grants it to MLBBDex
(Server Settings > Roles) and drags MLBBDex's role above the roles to give. The dashboard says
so when it is missing.

## Privileged intent

Developer portal: Bot > Privileged Gateway Intents > **Server Members
Intent** on (Presence and Message Content stay off). Without it the bot
still runs, with the welcome and goodbye messages and the auto-roles off. Text for Discord's
verification form, once the bot passes 100 servers:

> MLBBDex uses the Server Members intent only to receive the member join
> and leave events (GUILD_MEMBER_ADD, GUILD_MEMBER_REMOVE), to post the
> welcome and goodbye messages a server's managers turn on in its
> dashboard, and to give the roles they chose to newcomers
> (GUILD_MEMBER_UPDATE tells it when a member passes membership
> screening). It never requests the member list, keeps no member cache and
> stores nothing about members: the event is read (id, username, avatar),
> the message posted or the roles given, and the data dropped. Both
> features are off by default.

## Links for the listing forms

- Website: https://mlbbdex.com/en/bot
- Vote: https://discordbotlist.com/bots/mlbbdex/upvote (top.gg: https://top.gg/bot/1571083624789581834/vote once approved)
- Privacy policy: https://mlbbdex.com/en/bot/privacy
- Terms of service: https://mlbbdex.com/en/bot/terms
- Support server: https://discord.gg/mw5RzvkkU3
- Source code: https://github.com/achedon12/mlbb
