# Security policy

## Supported versions

Only the `main` branch, which runs in production, is maintained. Security fixes
are applied to it directly.

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Use the repository's **Security → Report a vulnerability** tab
([direct link](https://github.com/achedon12/mlbb/security/advisories/new)). The
report stays private until a fix is released.

Otherwise, contact the maintainer through their GitHub profile:
[achedon12](https://github.com/achedon12).

### What helps

- What you got, and what you should have got.
- The minimal steps to reproduce.
- The affected version: commit or deployment date.

You will get an answer within **72 hours**. A fix is targeted within **7 days**
for a vulnerability exploitable remotely without authentication, within 30 days
otherwise.

### Please do not

- Test destructively against the public instance: no denial of service, no data
  deletion, no access to other people's accounts.
- Disclose publicly before a fix is available.

## Scope

**In scope:** the code in this repository and the instance at
<https://mlbbdex.com>: authentication, sessions, injection, exposure of other
users' data, XSS, path traversal.

**Out of scope:**

- Mobile Legends: Bang Bang itself and Moonton's services. This project has no
  connection with them; contact the publisher.
- The community wiki and the community stats API the data comes from.
- Missing headers on purely static resources, with no demonstrable impact.
- The volume of outgoing requests to the aggregated public sources.

## Stored data

The site has no user database and never asks for a password. Signing in uses
the game's official verification code: the site only receives a temporary game
token, kept in an httpOnly cookie. Favorite heroes live in the browser. The only
data the server keeps is the optional patch notification subscriptions
(notification service address, encryption keys, language, favorite heroes), in
a JSON file. No trackers, no third-party analytics, nothing sold: audience
measurement, when enabled, is a self-hosted Matomo instance without cookies. A
vulnerability exposing any of this is treated as high priority.
