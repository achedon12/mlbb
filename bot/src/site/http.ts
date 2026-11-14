import type { z } from "zod";

/**
 * HTTP plumbing shared by the public and internal site clients.
 *
 * Every call has a timeout: an interaction must be answered within Discord's
 * window, and a hung request would otherwise hold a delivery loop forever.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The site did not answer, or answered something unusable. */
export class SiteUnavailableError extends Error {
  override name = "SiteUnavailableError";
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/** The site answered 404: the resource (or the endpoint) does not exist. */
export class NotFoundError extends Error {
  override name = "NotFoundError";
}

export const DEFAULT_TIMEOUT_MS = 5000;
/** A response larger than this is not something the site would send: refuse it. */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export async function requestJson<T>(
  fetchImpl: FetchLike,
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new SiteUnavailableError(`request failed: ${(error as Error).message}`);
  }
  if (response.status === 404) throw new NotFoundError(new URL(url).pathname);
  if (!response.ok) throw new SiteUnavailableError(`HTTP ${response.status}`, response.status);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_RESPONSE_BYTES) throw new SiteUnavailableError("response too large");
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new SiteUnavailableError("invalid JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new SiteUnavailableError(`unexpected response shape: ${parsed.error.issues[0]?.path.join(".") ?? "?"}`);
  }
  return parsed.data;
}
