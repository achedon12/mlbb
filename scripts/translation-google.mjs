/**
 * Google Translate call, shared by all translation scripts.
 *
 * A batch of texts goes out in one request. On rate limiting (429), it
 * waits and retries; if the response does not hold as many translations
 * as texts, it falls back to text-by-text processing. A single text
 * whose response stays inconsistent throws an error, rather than
 * retrying forever.
 */
const ENDPOINT = "https://clients5.google.com/translate_a/t";
const UA = "Mozilla/5.0 (compatible; MLBBDex/1.0)";

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Translates a batch of texts from `sl` to `tl`, in order.
 *
 * `tolerant`: in the text-by-text fallback, an untranslatable text keeps its
 * original form instead of aborting the whole batch.
 */
export async function translateBatch(batch, sl, tl, { tolerant: lenient = false } = {}) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("client", "dict-chrome-ex");
  url.searchParams.set("sl", sl);
  url.searchParams.set("tl", tl);
  for (const t of batch) url.searchParams.append("q", t);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const rep = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
      if (rep.ok) {
        const data = await rep.json();
        // A single text returns ["…"]; several return ["…", "…", …].
        const outputs = Array.isArray(data) ? data.flat(Infinity) : [];
        if (outputs.length === batch.length) return outputs.map(String);
        break;
      }
      if (rep.status === 429) await pause(4000 * attempt);
      else throw new Error(`HTTP ${rep.status}`);
    } catch (error) {
      if (attempt === 4) throw error;
      await pause(2000 * attempt);
    }
  }

  if (batch.length === 1) throw new Error("Inconsistent translation response");
  // Fallback: each text alone, slower but reliable.
  const outputs = [];
  for (const t of batch) {
    try {
      outputs.push((await translateBatch([t], sl, tl))[0] ?? t);
    } catch (error) {
      if (!lenient) throw error;
      outputs.push(t);
    }
    await pause(200);
  }
  return outputs;
}
