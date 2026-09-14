/**
 * Plain text of a string that may carry HTML: wiki captions,
 * descriptions from the stats API.
 *
 * A single-pass regular expression replacement would let a nested tag
 * re-form (« <scr<b>ipt> » yields « <script> »). Here,
 * a character-by-character walk strips each tag, and starts over
 * until nothing changes: no « < » followed by a letter, « / »,
 * « ! » or « ? » ever gets out. A text angle bracket (« HP < 30 % ») stays.
 */
export function removeTags(text) {
  let previous;
  let current = String(text);
  do {
    previous = current;
    current = unPassage(current);
  } while (current !== previous);
  return current;
}

const OPEN_TAG = /[a-z/!?]/i;

function unPassage(text) {
  let output = "";
  let inTag = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inTag) {
      if (c === ">") inTag = false;
    } else if (c === "<" && OPEN_TAG.test(text[i + 1] ?? "")) {
      inTag = true;
    } else {
      output += c;
    }
  }
  return output;
}

/**
 * Wikitext without its HTML comments (`<!-- … -->`).
 *
 * Same trap as tags: removing comments in a single pass lets one re-form
 * from the pieces around a removed one (« <!<!---->-- x --> » yields
 * « <!-- x --> »). The text is scanned, then scanned again until nothing
 * changes. An unclosed comment runs to the end of the text, as MediaWiki
 * reads it.
 */
export function removeComments(text) {
  let previous;
  let current = String(text);
  do {
    previous = current;
    current = commentPass(current);
  } while (current !== previous);
  return current;
}

function commentPass(text) {
  let output = "";
  let from = 0;
  for (;;) {
    const start = text.indexOf("<!--", from);
    if (start === -1) return output + text.slice(from);
    output += text.slice(from, start);
    const end = text.indexOf("-->", start + 4);
    if (end === -1) return output;
    from = end + 3;
  }
}
