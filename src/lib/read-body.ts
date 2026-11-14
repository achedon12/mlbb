/**
 * A request body read with a ceiling, before anything parses it.
 *
 * `request.text()` buffers whatever arrives: a `Content-Length` check alone
 * misses a chunked body, which declares no length. Here the declared length
 * is refused first, then the stream is read chunk by chunk and abandoned as
 * soon as it goes past the cap, so an oversized body never sits in memory
 * whole, and JSON.parse never sees it.
 *
 * Null when the body is too large (or the stream fails).
 */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d{1,12}$/.test(declared.trim()) || Number(declared) > max)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks).toString("utf8");
}
