/**
 * Text carried whole by a shared link: compressed (deflate-raw), then
 * base64url, so it travels in an address without escaping. Used by the tier
 * list maker (`?l=`) and the strategy planner (`#plan=`); nothing is stored
 * on a server.
 *
 * The first character tells the two forms apart: "2" + compressed text, or
 * "1" + raw text when compression is unavailable or gains nothing (a short
 * text).
 */

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const o of bytes) binary += String.fromCharCode(o);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(code: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(code)) return null;
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Pipes bytes through a (de)compression stream, stopping beyond `max`. */
async function transform(
  bytes: Uint8Array,
  feed: CompressionStream | DecompressionStream,
  max = Infinity,
): Promise<Uint8Array | null> {
  try {
    const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(feed).getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > max) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const output = new Uint8Array(total);
    let i = 0;
    for (const m of chunks) {
      output.set(m, i);
      i += m.length;
    }
    return output;
  } catch {
    return null;
  }
}

const compressionAvailable = () => typeof CompressionStream !== "undefined";

export async function encodeText(text: string, compress = true): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const raw = `1${toBase64Url(bytes)}`;
  if (!compress || !compressionAvailable()) return raw;
  const compressed = await transform(bytes, new CompressionStream("deflate-raw"));
  const code = compressed ? `2${toBase64Url(compressed)}` : raw;
  return code.length < raw.length ? code : raw;
}

/**
 * The text of a link code; null when it is malformed or larger than the
 * limits (a decompression bomb stops at `textMax` bytes).
 */
export async function decodeText(code: string, { codeMax, textMax }: { codeMax: number; textMax: number }): Promise<string | null> {
  if (!code || code.length > codeMax) return null;
  const bytes = fromBase64Url(code.slice(1));
  if (!bytes) return null;
  let text: Uint8Array | null = null;
  if (code[0] === "1") text = bytes;
  else if (code[0] === "2" && typeof DecompressionStream !== "undefined") {
    text = await transform(bytes, new DecompressionStream("deflate-raw"), textMax);
  }
  if (!text || text.length > textMax) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(text);
  } catch {
    return null;
  }
}
