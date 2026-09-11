import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { canPublish, toggleVote, type Publication, type PublishLimit, type StoredBuild } from "./community-builds";

/**
 * Community build storage.
 *
 * Same approach as the push subscriptions (`src/lib/push-serveur.ts`): no
 * database, one JSON file in the `DONNEES_DIR` folder (the `donnees` Docker
 * volume), rewritten whole on each change - temporary file then rename, so a
 * crash never leaves half a file. Writes go one after another through a
 * queue, the server being a single process. The list is kept in memory
 * between writes: pages read it on every request.
 *
 * Size limits: the file never grows past `MAX_FILE_BYTES`; the number of
 * builds is capped by `LIMITS.totalBuilds` (`src/lib/community-builds.ts`).
 */

const MAX_FILE_BYTES = 12 * 1024 * 1024;

const folder = () => process.env.DONNEES_DIR?.trim() || "donnees-serveur";
const storeFile = () => join(folder(), "community-builds.json");

export class StorageError extends Error {}

interface Registry {
  builds: StoredBuild[];
}

let cache: { file: string; builds: StoredBuild[] } | null = null;

async function readBuilds(): Promise<StoredBuild[]> {
  const file = storeFile();
  if (cache?.file === file) return cache.builds;
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      cache = { file, builds: [] };
      return cache.builds;
    }
    throw new StorageError(`cannot read ${file}`, { cause: error });
  }
  let registry: Registry;
  try {
    registry = JSON.parse(raw) as Registry;
  } catch (error) {
    // Never start again from an empty list: the next write would erase everything.
    throw new StorageError(`unreadable file: ${file}`, { cause: error });
  }
  if (!Array.isArray(registry?.builds)) throw new StorageError(`unexpected content: ${file}`);
  cache = { file, builds: registry.builds };
  return cache.builds;
}

async function writeBuilds(builds: StoredBuild[]): Promise<void> {
  const file = storeFile();
  const content = JSON.stringify({ builds } satisfies Registry) + "\n";
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new StorageError("community builds file would exceed its size limit");
  await mkdir(folder(), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw new StorageError(`cannot write ${file}`, { cause: error });
  }
  cache = { file, builds };
}

/** Queue: one read-modify-write at a time. */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

function modify<R>(change: (builds: StoredBuild[]) => { builds: StoredBuild[] | null; result: R }): Promise<R> {
  return serial(async () => {
    const { builds, result } = change(await readBuilds());
    if (builds) await writeBuilds(builds);
    return result;
  });
}

/** Every stored build. Waits for pending writes, so a page sees its own vote. */
export const listBuilds = (): Promise<StoredBuild[]> => serial(readBuilds);

export async function getBuild(id: string): Promise<StoredBuild | null> {
  return (await listBuilds()).find((b) => b.id === id) ?? null;
}

const newId = () => randomBytes(9).toString("base64url");

export type PublishResult = { ok: true; build: StoredBuild } | { ok: false; reason: Exclude<PublishLimit, "ok"> };
export type VoteResult = { ok: true; votes: number; voted: boolean } | { ok: false; reason: "unknown" | "own" };
export type DeleteResult = "ok" | "unknown" | "forbidden";

export function publishBuild(
  publication: Publication,
  author: { id: string; name: string },
  now = Date.now(),
): Promise<PublishResult> {
  return modify<PublishResult>((builds) => {
    const limit = canPublish(builds, author.id, now);
    if (limit !== "ok") return { builds: null, result: { ok: false, reason: limit } };
    let id = newId();
    while (builds.some((b) => b.id === id)) id = newId();
    const build: StoredBuild = { id, ...publication, author, createdAt: new Date(now).toISOString(), votes: [] };
    return { builds: [...builds, build], result: { ok: true, build } };
  });
}

export function voteBuild(
  id: string,
  voter: string,
  now = Date.now(),
): Promise<VoteResult> {
  return modify<VoteResult>((builds) => {
    const current = builds.find((b) => b.id === id);
    if (!current) return { builds: null, result: { ok: false, reason: "unknown" } };
    // Voting for one's own build would only inflate it.
    if (current.author.id === voter) return { builds: null, result: { ok: false, reason: "own" } };
    const { build, voted } = toggleVote(current, voter, now);
    return {
      builds: builds.map((b) => (b === current ? build : b)),
      result: { ok: true, votes: build.votes.length, voted },
    };
  });
}

/** Deletion by its author, or by the administrator (`admin`). */
export function deleteBuild(id: string, requester: { authorId: string | null; admin: boolean }): Promise<DeleteResult> {
  return modify<DeleteResult>((builds) => {
    const current = builds.find((b) => b.id === id);
    if (!current) return { builds: null, result: "unknown" };
    if (!requester.admin && current.author.id !== requester.authorId) return { builds: null, result: "forbidden" };
    return { builds: builds.filter((b) => b !== current), result: "ok" };
  });
}
