/**
 * Container entry point.
 *
 * With `DATABASE_URL` set (the Discord bot is deployed), the pending Prisma
 * migrations are applied first: `prisma migrate deploy`, which only runs the
 * migration files committed in `prisma/migrations`, never a schema push. The
 * Prisma command line lives in `./migrate`, apart from the standalone server.
 *
 * The container is read-only: the command line gets `/tmp` (a tmpfs) as its
 * home for whatever it caches, and its update check is turned off.
 *
 * A database that does not answer must not take the site down with it: the
 * migration is retried for about half a minute, then the server starts
 * anyway, logs the failure, and only the bot features fail until the next
 * start. The server is then loaded in this same process, so it stays PID 1
 * and receives the container's SIGTERM itself.
 */
import { spawnSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const ATTEMPTS = 6;
const PAUSE_MS = 5_000;

function migrate() {
  const result = spawnSync("node", ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    cwd: "migrate",
    stdio: "inherit",
    env: {
      ...process.env,
      HOME: "/tmp",
      XDG_CACHE_HOME: "/tmp",
      CHECKPOINT_DISABLE: "1",
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
  });
  return result.status === 0;
}

if (process.env.DATABASE_URL?.trim()) {
  let done = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !done; attempt += 1) {
    done = migrate();
    if (!done && attempt < ATTEMPTS) await wait(PAUSE_MS);
  }
  if (!done) {
    console.error(
      JSON.stringify({
        t: new Date().toISOString(),
        level: "error",
        message: "database migrations not applied: the bot features stay unavailable until the next start",
      }),
    );
  }
}

await import("./server.js");
