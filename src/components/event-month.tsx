import { CarteSkin, proprietesCarteSkin, type ProprietesCarteSkin } from "@/components/carte-skin";
import { GrilleSkins } from "@/components/grille-skins";
import { TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { herosParSlug } from "@/lib/donnees";
import { OTHER_MODES, type EventMonth, type EventSkin, type ObtainMode } from "@/lib/events";
import type { ListSource } from "@/lib/events-server";
import { dateLongue, listeNoms, moisAnnee } from "@/lib/fraicheur";
import { RARETE_ORIGINE } from "@/lib/raretes";

/**
 * Content of one month of the events calendar: StarLight skin, Collector
 * skins, then the other releases by obtain mode. Server component, shared by
 * the month timeline and each month's page.
 */

export const heroName = (slug: string) => herosParSlug.get(slug)?.name ?? slug;

/** Month inside a sentence: "septembre 2025", "September 2025", "septiembre de 2025". */
export const monthText = (locale: Langue, month: string) => moisAnnee(locale, `${month}-01`);

/** Month on its own, as a heading or a label: "Septembre 2025". */
export function monthLabel(locale: Langue, month: string): string {
  const text = monthText(locale, month);
  return text.charAt(0).toLocaleUpperCase(LOCALE_HTML[locale]) + text.slice(1);
}

export function eventCard(s: EventSkin, t: T, htmlLang: string, numbers: Intl.NumberFormat): ProprietesCarteSkin {
  const card = proprietesCarteSkin(s, heroName(s.heros), t, htmlLang, numbers);
  // Without a known anchor, the hero gallery opens at the top rather than on an empty anchor.
  if (!s.ancre) card.href = `/heroes/${s.heros}/skins`;
  // The module does not give its rarity yet: say so, rather than showing the default skin's.
  return s.notInCatalogue ? { ...card, couleur: RARETE_ORIGINE.couleur, rarete: t("pages.events.rarityUnknown") } : card;
}

/** Sentences summing up a month, for its lead and meta description. */
export function monthSummary(t: T, locale: Langue, m: EventMonth): string[] {
  const numbers = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const names = (list: EventSkin[]) =>
    listeNoms(
      locale,
      list.map((s) => t("pages.events.skinOf", { skin: s.nom, hero: heroName(s.heros) })),
    );
  const others = OTHER_MODES.filter((k) => m.others[k].length > 0);
  const otherCount = others.reduce((n, k) => n + m.others[k].length, 0);
  return [
    m.starlight.length > 0 && t("pages.events.summary.starlight", { list: names(m.starlight) }),
    m.collector.length > 0
      ? t("pages.events.summary.collector", { list: names(m.collector) })
      : m.noCollector && t("pages.events.summary.noCollector"),
    otherCount > 0 &&
      t(otherCount === 1 ? "pages.events.summary.others1" : "pages.events.summary.others", {
        n: numbers.format(otherCount),
        detail: listeNoms(
          locale,
          others.map((k) => t(`pages.events.modes.${k}.summary`, { n: numbers.format(m.others[k].length) })),
        ),
      }),
  ].filter((x): x is string => !!x);
}

/**
 * Sections of a month. `page`: top-level sections with their explanation;
 * `timeline`: compact subheadings under the month title, groups side by side.
 */
export function MonthContent({
  month: m,
  t,
  locale,
  variant,
}: {
  month: EventMonth;
  t: T;
  locale: Langue;
  variant: "page" | "timeline";
}) {
  const htmlLang = LOCALE_HTML[locale];
  const numbers = new Intl.NumberFormat(htmlLang);
  const skinCount = (n: number) =>
    t(n === 1 ? "pages.skinsCalendar.nSkins1" : "pages.skinsCalendar.nSkins", { n: numbers.format(n) });
  const groups: { mode: ObtainMode; skins: EventSkin[]; empty?: string }[] = [
    { mode: "starlight", skins: m.starlight, empty: t("pages.events.noStarlight") },
    { mode: "collector", skins: m.collector, empty: m.noCollector ? t("pages.events.noCollector") : undefined },
    ...OTHER_MODES.map((mode) => ({ mode, skins: m.others[mode] })),
  ];

  return (
    <div className={variant === "page" ? "space-y-14" : "flex flex-wrap gap-x-10 gap-y-6"}>
      {groups
        .filter((g) => g.skins.length > 0 || g.empty)
        .map(({ mode, skins, empty }) => {
          const title = t(`pages.events.modes.${mode}.title`);
          const count = skins.length > 0 && (
            <span className="text-base font-normal text-chalk-500"> · {skinCount(skins.length)}</span>
          );
          const cards = skins.map((s) => eventCard(s, t, htmlLang, numbers));
          // In the timeline a month's groups share one row: fixed-width cards that wrap.
          const content =
            skins.length === 0 ? (
              <p className="max-w-xs text-sm leading-relaxed text-chalk-400">{empty}</p>
            ) : variant === "page" ? (
              <GrilleSkins cartes={cards} />
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cards.map((c) => (
                  <li key={c.href} className="w-28 sm:w-32">
                    <CarteSkin {...c} />
                  </li>
                ))}
              </ul>
            );
          return variant === "page" ? (
            <section key={mode} id={mode} className="scroll-mt-24">
              <TitreSection chapeau={t(`pages.events.modes.${mode}.desc`)}>
                {title}
                {count}
              </TitreSection>
              {content}
            </section>
          ) : (
            <section key={mode}>
              <h4 className="mb-3 font-heading text-lg font-semibold text-chalk-100">
                {title}
                {count}
              </h4>
              {content}
            </section>
          );
        })}
    </div>
  );
}

/** Wiki pages cited, with their last edit: readers can judge how fresh they are. */
export function SourceList({ sources, t, locale }: { sources: ListSource[]; t: T; locale: Langue }) {
  if (sources.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} rel="noreferrer nofollow" target="_blank" className="font-semibold text-gold-400 hover:underline">
            {t("pages.events.sourcePage", { page: s.title })}
          </a>{" "}
          <span className="text-chalk-500">· {t("pages.events.sourceEdited", { date: dateLongue(locale, s.modified) })}</span>
        </li>
      ))}
    </ul>
  );
}
