import Link from "@/components/link";
import type { Locale } from "@/i18n/config";
import { createT, messagesFor } from "@/i18n/translations";
import { AsideBlock, ReadingLayout } from "@/components/reading-layout";
import { anchorOf } from "@/lib/guides";
import { FOOTER } from "@/lib/sections";

type Block = { h?: string; p?: string; ul?: string[] };

const substitute = (text: string, variables: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => variables[k] ?? `{${k}}`);

/**
 * One line of prose: links `[text](url)` and code `` `code` ``, with the
 * `{key}` variables substituted. Also used by pages that lay out their
 * prose by hand (the bot's privacy page).
 */
export function inlineProse(text: string, variables: Record<string, string> = {}, key = "p"): React.ReactNode[] {
  const sub = (t: string) => substitute(t, variables);
  const out: React.ReactNode[] = [];
  // Successive split: links, then code, on the substituted text.
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
}

/**
 * Renders a prose page from the catalogue. Content = array of blocks:
 * heading `h`, paragraph `p`, or list `ul`. Text accepts links
 * `[text](url)`, code `` `code` `` and variables `{key}`.
 */
export function Prose({
  locale,
  messageKey,
  variables = {},
  extraToc = [],
  children,
}: {
  locale: Locale;
  messageKey: string;
  variables?: Record<string, string>;
  /** Headings of `children`, appended to the table of contents. */
  extraToc?: { title: string; anchor: string }[];
  /** More prose after the catalogue's, in the same column (privacy's push and forum sections). */
  children?: React.ReactNode;
}) {
  const t = createT(locale);
  const tree = messagesFor(locale) as Record<string, unknown>;
  const prose = tree.prose as Record<string, { blocks?: Block[] }> | undefined;
  const blocks = prose?.[messageKey]?.blocks ?? [];

  const inline = (text: string, key: string) => inlineProse(text, variables, key);
  const sub = (text: string) => substitute(text, variables);
  const toc = [
    ...blocks.flatMap((b) => (b.h ? [{ level: 2, title: sub(b.h), anchor: anchorOf(sub(b.h)) }] : [])),
    ...extraToc.map((e) => ({ level: 2, ...e })),
  ];
  // The site's other fixed pages, beside the text: the one shown is left out.
  const others = (FOOTER.find((c) => c.key === "site")?.links ?? []).filter(
    (l) => l.href !== `/${messageKey}` && l.href !== "/account",
  );

  return (
    <ReadingLayout
      toc={toc}
      tocLabel={t("common.contents")}
      className="py-10 sm:py-14"
      aside={
        <AsideBlock id="prose-pages" title={t("footer.columns.site")}>
          <ul className="space-y-1.5">
            {others.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-chalk-300 transition-colors hover:text-gold-400">
                  {t(l.label)}
                </Link>
              </li>
            ))}
          </ul>
        </AsideBlock>
      }
    >
      <div className="prose-mlbb">
        {blocks.map((b, i) =>
          b.h ? (
            <h2 key={i} id={anchorOf(sub(b.h))} className="scroll-mt-24">
              {sub(b.h)}
            </h2>
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
        {children}
      </div>
    </ReadingLayout>
  );
}
