#!/bin/sh
# Deploys a release without taking the site down.
#
# The site runs in one of two slots of docker-compose.yml, the same image:
# `mlbb` on port 3003 and `mlbb-b` on port 3004. nginx proxies to both, the
# primary first, and uses whichever answers. This script builds the image,
# starts the release in the free slot, waits until it answers on
# /api/health, then stops the slot that was serving. If the new release
# never answers, it is stopped and the running one keeps serving.
#
#   sh scripts/deploy.sh             build, then swap slots (a release)
#   sh scripts/deploy.sh --no-build  swap slots only (after a .env change)
#
# The database and the bot, when the `bot` profile is on, are updated with a
# plain `up -d`: the bot reconnects on its own and Postgres only restarts
# when its definition changes.
set -eu

cd "$(dirname "$0")/.."

BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

PORT_A="${PORT:-3003}"
PORT_B="${PORT_B:-3004}"
WAIT_SECONDS="${DEPLOY_WAIT_SECONDS:-180}"

running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo false)" = "true" ]
}

answers() {
  curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$1/api/health"
}

if [ "$BUILD" = 1 ]; then
  docker compose build mlbb
fi

# The other services of the active profiles (the database and the bot with
# COMPOSE_PROFILES=bot) follow the usual way: `up -d` only recreates what
# changed.
OTHERS="$(docker compose config --services | grep -vx -e mlbb -e mlbb-b || true)"
if [ -n "$OTHERS" ]; then
  if [ "$BUILD" = 1 ]; then
    # shellcheck disable=SC2086
    docker compose up -d --build $OTHERS
  else
    # shellcheck disable=SC2086
    docker compose up -d $OTHERS
  fi
fi

# The slot serving now; the other one receives the release. With both
# running (an interrupted earlier run), the release goes to `mlbb-b`.
if running mlbb && ! running mlbb-b; then
  OLD=mlbb NEW=mlbb-b NEW_PORT="$PORT_B"
elif running mlbb-b && ! running mlbb; then
  OLD=mlbb-b NEW=mlbb NEW_PORT="$PORT_A"
elif running mlbb && running mlbb-b; then
  OLD=mlbb NEW=mlbb-b NEW_PORT="$PORT_B"
else
  # Nothing running (first start, or after a reboot without restart): start
  # the primary slot and stop there.
  docker compose up -d --no-deps mlbb
  echo "Started mlbb (no slot was running)."
  exit 0
fi

echo "Serving: $OLD. Starting the release in $NEW (port $NEW_PORT)."
docker compose up -d --no-deps --force-recreate "$NEW"

elapsed=0
until answers "$NEW_PORT"; do
  if ! running "$NEW" || [ "$elapsed" -ge "$WAIT_SECONDS" ]; then
    echo "The release in $NEW does not answer: it is stopped, $OLD keeps serving." >&2
    docker compose logs --tail 60 "$NEW" >&2 || true
    docker compose stop "$NEW" >/dev/null 2>&1 || true
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done
echo "$NEW answers after ${elapsed}s."

# A few seconds for nginx to send new requests there (it retries the
# primary every 2 s) and for the requests the old slot is serving to finish.
sleep 5
docker compose stop -t 20 "$OLD"
echo "Done: $NEW serves, $OLD is stopped."
