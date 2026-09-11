# Public API

MLBBDex exposes its data as JSON, read-only and without a key: enough to build
a Discord bot, a dashboard or another site without redoing the extraction.

- **Base**: `https://mlbbdex.com`
- **Methods**: `GET` (and `OPTIONS` for CORS)
- **On the site**: the same documentation, with clickable examples, at
  [mlbbdex.com/en/api-doc](https://mlbbdex.com/en/api-doc)

Route, parameter and field names are in French, as in the code: `heros`
(heroes), `objets` (items), `patchs` (patches), `classement` (ranking), `sante`
(health), `donnees` (data).

## Routes

| Route | Content | Parameters |
| --- | --- | --- |
| `GET /api/v1/heros` | The roster: a summary of each hero (roles, lanes, ratings, skills…) | `role`: Tank, Fighter, Assassin, Mage, Marksman, Support · `lane`: Or (gold), Jungle, Milieu (mid), Experience, Roam |
| `GET /api/v1/heros/{slug}` | A hero's full page: base stats, ratings, skills, skins… | — |
| `GET /api/v1/objets` | The item catalogue: price, bonuses, passive, active, recipe | `categorie`: Attack, Magic, Defense, Movement (exact match, case-insensitive) |
| `GET /api/v1/patchs` | The list of patch notes, with a link to each one | — |
| `GET /api/v1/classement` | The computed tier list: tier, win, ban and pick rates, score | — |
| `GET /api/sante` | Service health check (`{ "etat": "ok" }`) | — |

Examples:

```sh
curl "https://mlbbdex.com/api/v1/heros?role=Tank&lane=Roam"
curl "https://mlbbdex.com/api/v1/heros/khufra"
curl "https://mlbbdex.com/api/v1/objets?categorie=Defense"
```

Parameters can be combined: `?role=Tank&lane=Roam` returns the tanks played in
the roam position.

## Response format

Every response wraps its data the same way:

```json
{
  "donnees": [],
  "total": 18,
  "source": {
    "nom": "Mobile Legends Wiki",
    "url": "https://mobilelegends.fandom.com",
    "licence": "CC BY-SA"
  }
}
```

- `donnees`: an array for a list, an object for a single entry. For
  `/api/v1/classement`, an object `{ mesureLe, heros }`: `mesureLe` is the date
  the rates were measured, which is separate from the sync.
- `total`: present on lists, the number of items returned.
- `source`: where the data comes from and its license, repeated in the
  `X-Data-License` header.

An unknown identifier (`/api/v1/heros/inconnu`) returns `404` and
`{ "erreur": "… introuvable" }` ("not found").

## Limits and fair use

- **Rate**: 90 requests per minute per IP address, in a fixed window. Beyond
  that, the response is `429 Too Many Requests`, with a `Retry-After` header in
  seconds. The health check is not limited.
- **Cache**: `Cache-Control: public, max-age=3600, s-maxage=86400,
  stale-while-revalidate=604800`. The data only changes with the weekly sync
  (see [Data and sync](Data-and-sync)): there is no point querying it more
  than once an hour.
- **CORS**: open (`Access-Control-Allow-Origin: *`), so the API can be called
  directly from a browser.
- **License**: the data comes from the Mobile Legends wiki, under the CC BY-SA
  license. Republishing it requires crediting the source and sharing under the
  same terms.

## In the code

The routes live in `src/app/api/v1/`, the shared envelope in `src/lib/api.ts`
and rate limiting in `src/proxy.ts`. A new route goes through `reponseApi()` to
inherit the format, the cache and the source credit.
