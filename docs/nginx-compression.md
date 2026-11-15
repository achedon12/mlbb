# Compression and caching behind nginx

The site runs in its container behind nginx (`TRUSTED_PROXY_HOPS=1`). This
page is the nginx side of the response weight: what the app already does,
what it leaves to the proxy, and a snippet to paste into the server block.
Nothing here is applied automatically; the server configuration is not in
this repository.

## What the app sends

Measured on a production build (`npm run build`, `PORT=3009 npm start`):

| Response | Compressed by Next | `Cache-Control` | `Vary` |
| --- | --- | --- | --- |
| Pages (HTML) and their `.rsc` payload | gzip (`compress: true`) | `s-maxage=31536000` | `rsc, next-router-…, Accept-Encoding` |
| `/_next/static/*` (JS, CSS, fonts) | gzip | `public, max-age=31536000, immutable` | `Accept-Encoding` |
| `/_next/image` | no (images) | `public, max-age=2592000, must-revalidate` | `Accept` |
| `/visuels/*` | no (WebP) | `public, max-age=2592000` | none |
| Route handlers: `/fr/search.json` (220 KB), `skins.json`, `/trends/*.json`, `/matchups/*.json`, sitemaps, `feed.xml`, `/api/v1/*` | **no** | per route | no `Accept-Encoding` |

Two things follow:

- Next only compresses with gzip, at a fixed level. Brotli at level 5 takes
  another 25 to 35 % off a page (a hero page: 61 KB in gzip, 40 KB in
  brotli; the home page: 43 KB and 29 KB).
- The JSON and XML of the route handlers leave the app uncompressed. nginx
  compresses only `text/html` unless told otherwise: `search.json`, which
  the global search downloads, travels at 220 KB instead of about 30.

So the proxy should do the compression, for every text type, and ask the app
for uncompressed responses (otherwise it receives gzip and cannot re-encode
in brotli).

## The snippet

`ngx_brotli` is a third-party module: check that it is there before enabling
the `brotli` lines (`nginx -V 2>&1 | grep -o brotli`, or the
`libnginx-mod-http-brotli-filter` package on Debian and Ubuntu). Without it,
keep the gzip part alone: it already fixes the uncompressed JSON.

```nginx
# In the server block of mlbbdex.com (or in http {} for every site).

# Text types: nginx always compresses text/html, the rest must be listed.
# text/x-component is the RSC payload of client navigations.
gzip on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_proxied any;
gzip_vary on;
gzip_types text/plain text/css text/xml text/x-component application/javascript
           application/json application/manifest+json application/xml
           application/rss+xml application/atom+xml image/svg+xml;

# Brotli, when ngx_brotli is installed. Level 5: close to the size of level 11
# for a fraction of its CPU, which matters for responses compressed on the fly.
brotli on;
brotli_comp_level 5;
brotli_min_length 1024;
brotli_types text/plain text/css text/xml text/x-component application/javascript
             application/json application/manifest+json application/xml
             application/rss+xml application/atom+xml image/svg+xml;

location / {
    proxy_pass http://127.0.0.1:3003;
    # Ask the app for identity: nginx compresses, in brotli when the browser
    # accepts it. Without this line nginx receives Next's gzip and passes it on.
    proxy_set_header Accept-Encoding "";
    # ... the existing proxy_set_header lines (Host, X-Forwarded-For…) stay.
}
```

`gzip_vary on` also covers brotli: ngx_brotli adds `Vary: Accept-Encoding`
through the same setting. The pages already send it themselves; the route
handlers do not, which is why it must be on.

## Optional: serving `/_next/static` from disk

The build's static assets never change under a given name (`immutable`).
nginx can serve them itself, precompressed once, instead of compressing them
on every request. This needs the files outside the container, for example
copied at deployment:

```bash
docker compose cp mlbb:/app/.next/static ./static-next
find ./static-next -type f \( -name '*.js' -o -name '*.css' -o -name '*.svg' \) \
  -exec gzip -k -9 {} \; -exec brotli -k -q 11 {} \;
```

```nginx
location /_next/static/ {
    alias /srv/mlbb/static-next/;
    gzip_static on;      # serves file.js.gz when the browser accepts gzip
    brotli_static on;    # serves file.js.br when it accepts brotli (ngx_brotli)
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
}
```

The folder must be refreshed at each deployment (the names change with every
build; old names can stay a while for visitors on an open tab). If that step
is not automated, keep the proxy: on-the-fly brotli at level 5 is cheap on
these files.

## Checking

```bash
curl -sI -H 'Accept-Encoding: br' https://mlbbdex.com/fr | grep -i '^content-encoding'        # br
curl -sI -H 'Accept-Encoding: gzip' https://mlbbdex.com/fr/search.json | grep -i '^content-encoding'  # gzip
curl -sI -H 'Accept-Encoding: br' https://mlbbdex.com/fr/search.json | grep -i '^vary'        # Accept-Encoding
```
