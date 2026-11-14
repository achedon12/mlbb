# Editorial data

Three small files in `src/data/editorial/` are written **by hand**. The sync
never touches them (it only writes `src/data/game/` and `public/visuels/`), so
nothing refreshes them for you: each one says on its page when it was last
checked, and the tests check its shape on every run.

| File | Page | How often |
| --- | --- | --- |
| `free-rotation.json` | `/heroes/free-rotation`, teasers on `/heroes` and the home page | Every Monday |
| `seasons.json` | `/tools/server-time` (season card and schedule) | When a patch note dates a season |
| `account-value.json` | `/tools/account-value` | Every few months |

After any edit: `npm test`, then commit. The pages are prerendered, so the
change goes live with the next build (the nightly sync triggers one).

## Free hero rotation, every Monday

The weekly free heroes change at the weekly reset, Monday 00:00 server time
(UTC−8, so Monday 08:00 UTC).

1. Open the game and read the week's free heroes in the hero list, or take
   them from an official Moonton post. **Never from memory, never guessed**:
   an empty list is better than a wrong one.
2. Find each hero's exact `slug` in `src/data/game/heroes.json`.
3. Edit `src/data/editorial/free-rotation.json`:

   ```json
   {
     "weekStart": "2026-11-16",
     "updated": "2026-11-16",
     "source": null,
     "heroes": ["miya", "balmond", "saber"]
   }
   ```

   - `weekStart`: the Monday the rotation starts on (`YYYY-MM-DD`).
   - `updated`: the day you edit the file.
   - `source`: the `https://` address of the official post you copied, or
     `null` when you read the list in the game.
   - Keep the `$comment` line as it is.
4. `npx vitest run tests/unit/free-rotation.test.ts`: it fails on a slug that
   is not in the roster, a repeated hero, or a `weekStart` that is not a
   Monday.

If nobody updates the file, nothing breaks: 10 days after `weekStart` the
page says the rotation is not available yet, with the date of the last list,
and the teasers on `/heroes` and the home page disappear. To take a list down
on purpose, empty `heroes`.

## Ranked seasons

`seasons.json` lists the recent seasons with their start and end in **server
time**, written the way the patch notes write them
(`"2026-09-16T00:00:00"`). The patch notes announce both bounds, for example
"S42 will start from 00:00:00 on September 16 (Server Time)".

- When a patch note dates the end of the current season, set its `end`.
- When it dates the next season's start, add an entry for that season with
  `"end": null`.
- `source`: the patch note's wiki page.
- `checked`: the day you checked.
- Never estimate a date: a season lasts about three months, but the page shows
  "not announced yet" rather than a guess.

The page also reads the season announcements of the synced patch notes, for
the seasons after the last one listed here, so a new season can show up before
anyone edits the file. It never relies on the patch pages' own dates, which the
wiki sometimes gets wrong: the year of an announcement is deduced from the
season it follows. The file stays the reference; old seasons can be removed
once the table no longer shows them (it shows the last four).

## Account value assumptions

`account-value.json` holds every figure the estimator uses that the game data
does not give. The page prints all of them in its method section.

- `usdPerDiamond`: the price of a diamond at the usual top-up pack, without
  first-purchase bonus (`usdPerDiamondNote` says which pack).
- `drawCost`: the typical diamond cost of a skin that no shop sells
  (StarLight, Collector, collabs and premium events, Legend). The shop tiers
  are costed from the synced shop prices and need no edit.
- `resale`: the fraction of the cost a comparable account is offered for, and
  the four factors (rank, heroes owned, emblems, binding).
- `rates`, `ratesDate`, `ratesSource`, `ratesNote`: fixed exchange rates, one
  US dollar in each currency. Refresh them every few months from a public
  source, round them, and update `ratesDate`.
- `checked`: the day you last reviewed the assumptions.

The page always presents the result as an indicative order of magnitude and
warns that account trading breaks Moonton's terms of service. Keep it that way.
