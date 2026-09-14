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
