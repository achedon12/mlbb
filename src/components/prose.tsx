import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { messagesFor } from "@/i18n/translations";

type Block = { h?: string; p?: string; ul?: string[] };

/**
 * Rend une page de prose depuis le catalogue. Contenu = tableau de blocs :
 * titre `h`, paragraphe `p`, ou liste `ul`. Le texte accepte des liens
 * `[texte](url)`, du code `` `code` `` et des variables `{clef}`.
 */
export function Prose({
  locale,
  messageKey,
  variables = {},
}: {
  locale: Locale;
  messageKey: string;
  variables?: Record<string, string>;
}) {
  const tree = messagesFor(locale) as Record<string, unknown>;
  const prose = tree.prose as Record<string, { blocks?: Block[] }> | undefined;
  const blocks = prose?.[messageKey]?.blocks ?? [];

  const sub = (text: string) => text.replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `{${k}}`);

  const inline = (text: string, key: string) => {
    const out: React.ReactNode[] = [];
    // Découpe successive : liens, puis code, sur le texte substitué.
    const re = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push(sub(text.slice(last, m.index)));
      if (m[3] !== undefined) {
        out.push(<code key={`${key}c${n}`}>{sub(m[3])}</code>);
      } else {
        const url = sub(m[2]);
        const external = /^https?:|^mailto:/.test(url);
        out.push(
          external ? (
            <a key={`${key}l${n}`} href={url} rel="noreferrer" target={url.startsWith("mailto:") ? undefined : "_blank"}>
              {sub(m[1])}
            </a>
          ) : (
            <Link key={`${key}l${n}`} href={url}>{sub(m[1])}</Link>
          ),
        );
      }
      last = re.lastIndex;
      n += 1;
    }
    if (last < text.length) out.push(sub(text.slice(last)));
    return out;
  };

  return (
    <div className="prose-mlbb mx-auto max-w-3xl px-4 py-14">
      {blocks.map((b, i) =>
        b.h ? (
          <h2 key={i}>{sub(b.h)}</h2>
        ) : b.ul ? (
          <ul key={i}>
            {b.ul.map((li, j) => (
              <li key={j}>{inline(li, `${i}-${j}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inline(b.p ?? "", String(i))}</p>
        ),
      )}
    </div>
  );
}
