import Link from "@/components/lien";
import type { Langue } from "@/i18n/config";
import { messagesDe } from "@/i18n/traductions";

type Bloc = { h?: string; p?: string; ul?: string[] };

/**
 * Rend une page de prose depuis le catalogue. Contenu = tableau de blocs :
 * titre `h`, paragraphe `p`, ou liste `ul`. Le texte accepte des liens
 * `[texte](url)`, du code `` `code` `` et des variables `{clef}`.
 */
export function Prose({
  langue,
  cle,
  variables = {},
}: {
  langue: Langue;
  cle: string;
  variables?: Record<string, string>;
}) {
  const arbre = messagesDe(langue) as Record<string, unknown>;
  const proses = arbre.proses as Record<string, { blocs?: Bloc[] }> | undefined;
  const blocs = proses?.[cle]?.blocs ?? [];

  const sub = (texte: string) => texte.replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `{${k}}`);

  const inline = (texte: string, cle: string) => {
    const out: React.ReactNode[] = [];
    // Découpe successive : liens, puis code, sur le texte substitué.
    const re = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
    let dernier = 0;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(texte)) !== null) {
      if (m.index > dernier) out.push(sub(texte.slice(dernier, m.index)));
      if (m[3] !== undefined) {
        out.push(<code key={`${cle}c${n}`}>{sub(m[3])}</code>);
      } else {
        const url = sub(m[2]);
        const externe = /^https?:|^mailto:/.test(url);
        out.push(
          externe ? (
            <a key={`${cle}l${n}`} href={url} rel="noreferrer" target={url.startsWith("mailto:") ? undefined : "_blank"}>
              {sub(m[1])}
            </a>
          ) : (
            <Link key={`${cle}l${n}`} href={url}>{sub(m[1])}</Link>
          ),
        );
      }
      dernier = re.lastIndex;
      n += 1;
    }
    if (dernier < texte.length) out.push(sub(texte.slice(dernier)));
    return out;
  };

  return (
    <div className="prose-mlbb mx-auto max-w-3xl px-4 py-14">
      {blocs.map((b, i) =>
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
