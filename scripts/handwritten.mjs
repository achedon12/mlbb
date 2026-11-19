/**
 * A translated article written by hand: its front matter carries
 * `handwritten: true`. `translate-articles.mjs` then leaves that language's
 * file alone instead of regenerating it from the French. Remove the flag to
 * let the machine translation take over again.
 */
export function isHandWritten(raw) {
  const header = String(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return Boolean(header && /^handwritten:\s*["']?true["']?\s*$/m.test(header[1]));
}
