import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "@/components/link";
import { LightImage } from "@/components/light-image";
import { Dex } from "@/components/mascot";
import { usualIcon } from "@/lib/tier-list-filters";
import { heroesBySlug } from "@/lib/data";
import { describeGap, formatGap, type Motion } from "@/lib/trends";
import type { PatchChange } from "@/lib/tier-list-extras";
import type { Locale } from "@/i18n/config";
import type { T } from "@/i18n/translations";
import { cn } from "@/lib/utils";

/**
 * The blocks around the ranking of a tier list page, rendered by the server:
 * the short answer under the poster, what moved since last week above the
 * tiers, and where to go next under them. Their links carry `data-track`,
 * counted by `TierTrack`.
 */

const iconOf = (slug: string) => {
  const h = heroesBySlug.get(slug);
  return h?.images.icon ?? h?.images.portrait ?? usualIcon(slug);
};
const nameOf = (slug: string) => heroesBySlug.get(slug)?.name ?? slug;
const portraitOf = (slug: string) => {
  const h = heroesBySlug.get(slug);
  return h?.images.portrait ?? h?.images.icon ?? null;
};

/**
 * The question the page is searched for, and its answer in one plain
 * sentence, before any figure: what a search engine quotes and an assistant
 * repeats ("Best jungle heroes right now: Ling, Fanny and Nolan").
 */
export function ShortAnswer({ question, answer, detail }: { question: string; answer: string; detail: string }) {
  return (
    <section aria-labelledby="tier-answer" className="mb-8 max-w-3xl">
      <h2 id="tier-answer" className="font-heading text-lg font-bold text-chalk-100 sm:text-xl">
        {question}
      </h2>
      <p className="mt-1.5 text-base leading-relaxed text-chalk-200">
        <strong className="font-semibold text-gold-300">{answer}</strong> {detail}
      </p>
    </section>
  );
}

/**
 * What changed: the week's biggest win rate rises and drops among the
 * page's heroes, then the ones the live patch touched, with the way to its
 * notes. Nothing when nothing moved and the patch spared them all.
 */
export function PatchChanges({
  t,
  locale,
  rises,
  drops,
  changes,
  version,
}: {
  t: T;
  locale: Locale;
  rises: Motion[];
  drops: Motion[];
  changes: PatchChange[];
  version: string | null;
}) {
  if (rises.length === 0 && drops.length === 0 && changes.length === 0) return null;
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const SHOWN = 8;

  const column = (list: Motion[], rise: boolean) =>
    list.length > 0 && (
      <div className="min-w-0">
        <h3 className={cn("flex items-center gap-1.5 font-heading text-sm font-bold uppercase tracking-wide", rise ? "text-azure-400" : "text-blood-400")}>
          {rise ? <ArrowUpRight aria-hidden className="size-4" /> : <ArrowDownRight aria-hidden className="size-4" />}
          {t(rise ? "pages.tierList.patch.rises" : "pages.tierList.patch.drops")}
        </h3>
        <ul className="mt-2 space-y-1.5">
          {list.map((m) => (
            <li key={m.slug}>
              <Link
                href={`/heroes/${m.slug}`}
                data-track="Mover opened"
                data-track-name={m.slug}
                className="group flex items-center gap-2.5 bg-night-900 p-1.5 pr-3 transition-colors hover:bg-night-850"
              >
                <LightImage src={iconOf(m.slug)} alt="" width={36} height={36} className="bevel-sm size-9 shrink-0 object-cover" />
                <span className="min-w-0 flex-1 truncate font-heading font-bold text-chalk-100 group-hover:text-gold-300">
                  {nameOf(m.slug)}
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span aria-hidden className={cn("block font-heading text-sm font-bold", rise ? "text-azure-400" : "text-blood-400")}>
                    {formatGap(m.variation.gap, locale)}
                  </span>
                  <span className="sr-only">{describeGap(t, locale, m.variation.gap, m.variation.days)}, </span>
                  <span className="block text-xs text-chalk-400">{percent.format(m.variation.current)} %</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section aria-labelledby="tier-changes" className="bevel-lg mb-10 bg-night-950/60 p-4 ring-1 ring-night-700 sm:p-5">
      <h2 id="tier-changes" className="display-caps text-[1.75rem] text-chalk-100 sm:text-[2rem]">
        {t("pages.tierList.patch.title")}
      </h2>
      <p className="mt-1 text-sm text-chalk-400">
        {t("pages.tierList.patch.lead")}
      </p>

      {(rises.length > 0 || drops.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {column(rises, true)}
          {column(drops, false)}
        </div>
      )}

      {version && (
        <div className="mt-5 border-t border-night-700 pt-4">
          {changes.length > 0 && (
            <>
              <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-chalk-300">
                {t("pages.tierList.patch.adjusted", { v: version, n: changes.length })}
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {changes.slice(0, SHOWN).map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/heroes/${c.slug}`}
                      data-track="Patch hero opened"
                      data-track-name={c.slug}
                      className="group flex items-center gap-2 bg-night-900 p-1 pr-2.5 transition-colors hover:bg-night-850"
                    >
                      <LightImage src={iconOf(c.slug)} alt="" width={32} height={32} className="bevel-sm size-8 object-cover" />
                      <span className="font-heading text-sm font-bold text-chalk-100 group-hover:text-gold-300">{nameOf(c.slug)}</span>
                      {c.type && (
                        <span
                          className={cn(
                            "text-[0.7rem] font-semibold uppercase",
                            c.type === "buff" ? "text-azure-400" : c.type === "nerf" ? "text-blood-400" : "text-chalk-400",
                          )}
                        >
                          {t(`patchHeroes.${c.type}`)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
                {changes.length > SHOWN && (
                  <li className="self-center text-sm text-chalk-400">+{changes.length - SHOWN}</li>
                )}
              </ul>
            </>
          )}
          <Link
            href={`/patch-notes/${version}`}
            data-track="Patch notes opened"
            data-track-name={version}
            className="mt-3 inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
          >
            {t("patchHeroes.seePatch", { version })}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      )}
    </section>
  );
}

export interface PickNext {
  slug: string;
  /** Heroes it loses to the most. */
  counters: string[];
  /** Its core items, resolved: name, picture, page. */
  items: { slug: string; name: string; image: string | null }[];
}

export interface ListNext {
  href: string;
  name: string;
  emblem?: string;
  /** The list's n°1, whose face the card shows. */
  top?: string;
}

/**
 * "You play jungle? Also see": the next step for whoever read the ranking.
 * Who beats the top picks, what they build, the tools to put them to use,
 * and the other lists — pictures to tap, not a column of links.
 */
export function AlsoSee({
  t,
  title,
  picks,
  lists,
  guide,
}: {
  t: T;
  title: string;
  picks: PickNext[];
  lists: ListNext[];
  /** The lane's guide, when the page is a lane's. */
  guide?: { href: string; title: string };
}) {
  const withCounters = picks.filter((p) => p.counters.length > 0);
  const withItems = picks.filter((p) => p.items.length > 0);
  const heading = "display-caps text-[1.5rem] text-chalk-100 sm:text-[1.75rem]";
  const top = picks[0]?.slug;

  return (
    <section aria-labelledby="tier-next" className="mt-14">
      <h2 id="tier-next" className="type-section text-chalk-100">
        {title}
      </h2>
      <div aria-hidden className="eclat mt-3 h-[3px] w-24" />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {withCounters.length > 0 && (
          <div>
            <h3 className={heading}>{t("pages.tierList.next.counters")}</h3>
            <p className="mt-1 text-sm text-chalk-400">{t("pages.tierList.next.countersLead")}</p>
            <ul className="mt-3 space-y-2">
              {withCounters.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/heroes/${p.slug}#counters`}
                    data-track="Also see"
                    data-track-name={`counters/${p.slug}`}
                    className="group bevel-sm flex items-center gap-3 bg-night-900 p-2 pr-3 transition-colors hover:bg-night-850"
                  >
                    <LightImage src={iconOf(p.slug)} alt="" width={48} height={48} className="bevel-sm size-12 shrink-0 object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-heading text-lg font-bold text-chalk-100 group-hover:text-gold-300">
                        {nameOf(p.slug)}
                      </span>
                      <span className="block text-xs text-chalk-500">{t("pages.tierList.peek.counters")}</span>
                    </span>
                    <span className="flex shrink-0 items-center">
                      {p.counters.map((c) => (
                        <LightImage
                          key={c}
                          src={iconOf(c)}
                          alt={nameOf(c)}
                          width={36}
                          height={36}
                          className="bevel-sm -ml-1.5 size-9 object-cover ring-2 ring-night-900 first:ml-0"
                        />
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {withItems.length > 0 && (
          <div>
            <h3 className={heading}>{t("pages.tierList.next.builds")}</h3>
            <p className="mt-1 text-sm text-chalk-400">{t("pages.tierList.next.buildsLead")}</p>
            <ul className="mt-3 space-y-2">
              {withItems.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/heroes/${p.slug}#builds`}
                    data-track="Also see"
                    data-track-name={`builds/${p.slug}`}
                    className="group bevel-sm flex items-center gap-3 bg-night-900 p-2 pr-3 transition-colors hover:bg-night-850"
                  >
                    <LightImage src={iconOf(p.slug)} alt="" width={48} height={48} className="bevel-sm size-12 shrink-0 object-cover" />
                    <span className="min-w-0 flex-1 truncate font-heading text-lg font-bold text-chalk-100 group-hover:text-gold-300">
                      {nameOf(p.slug)}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {p.items.map((o) =>
                        o.image ? (
                          <LightImage key={o.slug} src={o.image} alt={o.name} width={36} height={36} className="size-9 bg-night-800 object-contain" />
                        ) : null,
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {guide && (
              <Link
                href={guide.href}
                data-track="Also see"
                data-track-name="guide"
                className="mt-3 inline-flex items-center gap-1.5 font-heading text-base font-bold uppercase text-gold-400 transition-colors hover:text-gold-300"
              >
                {guide.title}
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            )}
          </div>
        )}
      </div>

      <h3 className={cn(heading, "mt-10")}>{t("pages.tierList.next.tools")}</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        <li>
          <Link
            href="/draft"
            data-track="Also see"
            data-track-name="draft"
            className="group bevel-lg flex h-full flex-col justify-between gap-3 bg-night-900 p-4 transition-colors hover:bg-night-850"
          >
            <span className="flex">
              {picks.slice(0, 5).map((p) => (
                <LightImage
                  key={p.slug}
                  src={iconOf(p.slug)}
                  alt=""
                  width={40}
                  height={40}
                  className="bevel-sm -ml-2 size-10 object-cover ring-2 ring-night-900 first:ml-0"
                />
              ))}
            </span>
            <span>
              <span className="block font-heading text-lg font-bold text-chalk-100 group-hover:text-gold-300">{t("nav.draft.label")}</span>
              <span className="block text-sm text-chalk-400">{t("pages.tierList.next.draft")}</span>
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/mlbbdle"
            data-track="Also see"
            data-track-name="mlbbdle"
            className="group bevel-lg flex h-full items-end justify-between gap-3 bg-night-900 p-4 transition-colors hover:bg-night-850"
          >
            <span>
              <span className="block font-heading text-lg font-bold text-chalk-100 group-hover:text-gold-300">{t("nav.mlbbdle.label")}</span>
              <span className="block text-sm text-chalk-400">{t("nav.mlbbdle.desc")}</span>
            </span>
            {/* The silhouette of the list's n°1: the game is guessing who it is. */}
            {top && portraitOf(top) && (
              <LightImage src={portraitOf(top)!} alt="" width={56} height={90} className="h-[90px] w-14 shrink-0 object-cover object-top brightness-0 invert-[.25]" />
            )}
          </Link>
        </li>
        <li>
          <Link
            href="/quiz"
            data-track="Also see"
            data-track-name="quiz"
            className="group bevel-lg flex h-full items-end justify-between gap-3 bg-night-900 p-4 transition-colors hover:bg-night-850"
          >
            <span>
              <span className="block font-heading text-lg font-bold text-chalk-100 group-hover:text-gold-300">{t("nav.quiz.label")}</span>
              <span className="block text-sm text-chalk-400">{t("nav.quiz.desc")}</span>
            </span>
            <Dex pose="idee" height={90} still className="shrink-0" />
          </Link>
        </li>
      </ul>

      {lists.length > 0 && (
        <>
          <h3 className={cn(heading, "mt-10")}>{t("pages.tierList.next.lists")}</h3>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {lists.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  data-track="Also see"
                  data-track-name={l.href}
                  className="group bevel-sm flex items-center gap-2.5 bg-night-900 p-2 transition-colors hover:bg-night-850"
                >
                  {l.emblem && <LightImage src={l.emblem} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading font-bold text-chalk-100 group-hover:text-gold-300">{l.name}</span>
                    {l.top && (
                      <span className="block truncate text-xs text-chalk-500">
                        {t("pages.tierList.next.top", { name: nameOf(l.top) })}
                      </span>
                    )}
                  </span>
                  {l.top && (
                    <LightImage src={iconOf(l.top)} alt="" width={36} height={36} className="bevel-sm size-9 shrink-0 object-cover" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
