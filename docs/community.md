# Community — forum and teammate finder

A lightweight community area on mlbbdex.com: a forum in six categories and
a "looking for teammates" board. Reading is public and server-rendered;
writing needs the game account login the site already has (`/login`).

## Pages

- `/community` — categories with their activity, the latest threads, the
  teammate finder and the Discord server (`NEXT_PUBLIC_DISCORD_INVITE_URL`).
- `/community/<category>` — `general`, `heroes-builds`, `ranked-help`,
  `esports`, `guides`, `site-feedback`. `?sort=latest|top`, `?page=n` (20 a
  page, pinned first). Only the first page in the default order is indexed.
- `/community/<category>/<id>-<slug>` — a thread and its replies (30 a
  page), with `DiscussionForumPosting` structured data. A wrong category or
  slug redirects (308) to the right address.
- `/community/search?q=&category=` — Postgres full text (`websearch_to_tsquery`,
  "simple" configuration), over titles, bodies and replies. Not indexed.
- `/community/teammates` — cards filtered by region, rank, lane, language.
- `/community/moderation` — the moderators' queue (not indexed).

## Data (Prisma, `prisma/migrations/20261114200000_community`)

`CommunityMember`, `ForumThread`, `ForumPost`, `ForumVote`, `CommunityReport`,
`ModerationLog`, `TeammateCard` (see `prisma/schema.prisma`). Authors are kept
as the account hash of `src/lib/community-builds-server.ts`, never the in-game
id. The migration adds two GIN expression indexes for the search, which the
queries in `src/lib/community/store.ts` match exactly.

## Writing rules

- Markdown, rendered on the server (`src/lib/community/markdown.ts`): raw HTML
  escaped by the renderer, then sanitize-html with a short allowlist; links
  http(s) only, `rel="nofollow ugc noopener noreferrer"`, no images.
- Sizes: title 5–120, thread 10–10,000, reply 2–5,000, report note 300,
  card note 200 characters; 5 hero tags on a thread, 6 on a card.
- Authors may edit for an hour and delete for a day; a deleted post's text
  is erased.
- Word and link filter (`src/lib/community/filter.ts`): slurs, scam bait,
  link shorteners, chat invites other than the site's own Discord, more than
  5 links. `COMMUNITY_BLOCKED_WORDS` adds terms (comma-separated).
- New accounts (first seen in the community less than 3 days ago): 2 threads
  and 15 replies a day, no links. Others: 6 threads and 80 replies a day.
- Per account and minute: 2 threads, 6 replies, 10 edits, 30 votes, 10
  reports, 6 card saves; 40 mutating requests per address and minute. The
  same text twice within ten minutes is refused.
- Teammate cards: one per account, listed for 7 days from each save. The
  in-game id and the Discord handle are only rendered for signed-in players.

## Requests

Mutating routes (`/api/community/*`) check, in order: database configured,
`Origin` against `NEXT_PUBLIC_SITE_URL` (required, plus `Sec-Fetch-Site`
when sent), the address's rate, the game session, the account's rate, then
the body (48 KB cap while reading, JSON, zod, strict keys). Every answer is
`no-store`.

## Moderation

Moderators are the bot's super admins: a Discord login whose id is in
`BOT_SUPER_ADMIN_IDS`, checked on every request (the Discord bot
configuration must be complete for the login to exist). They sign in at
`/community/moderation`, which lists:

- open reports, one entry per target, the most reported first; three
  reports from different accounts hide a target until someone decides;
- actions: hide / show again, delete, lock / unlock and pin / unpin (threads),
  ban the author (1, 7 or 30 days, or for good, with a reason), dismiss;
  each one closes the target's reports and is written to `ModerationLog`;
- the banned accounts, with "lift the ban";
- the last 40 decisions.

On a thread page a moderator also sees these buttons on the thread and, folded,
on each reply. A banned account can no longer post, vote, report or list a
card; its card is removed.
