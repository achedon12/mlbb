import { proprietesCarteSkin, type ProprietesCarteSkin } from "@/components/carte-skin";
import { GrilleSkins } from "@/components/grille-skins";
import { TitreSection } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { herosParSlug } from "@/lib/donnees";
import { MODES_AUTRES, type ModeObtention, type MoisEvenements, type SkinEvenement } from "@/lib/evenements";
import type { SourceListe } from "@/lib/evenements-serveur";
import { dateLongue, listeNoms, moisAnnee } from "@/lib/fraicheur";
import { RARETE_ORIGINE } from "@/lib/raretes";

/**
 * Contenu d'un mois du calendrier des evenements : skin StarLight, skins
 * Collector, puis les autres sorties selon leur mode d'obtention. Composant
 * serveur, partage par la frise des mois et la page de chaque mois.
 */

export const nomHeros = (slug: string) => herosParSlug.get(slug)?.nom ?? slug;

/** Mois dans une phrase : « septembre 2025 », « September 2025 », « septiembre de 2025 ». */
export const moisTexte = (locale: Langue, mois: string) => moisAnnee(locale, `${mois}-01`);

/** Mois seul en titre ou en etiquette : « Septembre 2025 ». */
export function nomMois(locale: Langue, mois: string): string {
  const texte = moisTexte(locale, mois);
  return texte.charAt(0).toLocaleUpperCase(LOCALE_HTML[locale]) + texte.slice(1);
}

export function carteEvenement(
  s: SkinEvenement,
  t: T,
  langueHtml: string,
  nombre: Intl.NumberFormat,
): ProprietesCarteSkin {
  const carte = proprietesCarteSkin(s, nomHeros(s.heros), t, langueHtml, nombre);
  // Sans ancre connue, la galerie du heros s'ouvre en haut plutot que sur une ancre vide.
  if (!s.ancre) carte.href = `/heroes/${s.heros}/skins`;
  // Le module ne donne pas encore sa rarete : le dire, plutot que d'afficher celle du skin d'origine.
  return s.horsCatalogue
    ? { ...carte, couleur: RARETE_ORIGINE.couleur, rarete: t("pages.evenements.rareteInconnue") }
    : carte;
}

/** Phrases qui resument un mois, pour son chapeau et sa description. */
export function resumeMois(t: T, locale: Langue, m: MoisEvenements): string[] {
  const nombre = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const noms = (liste: SkinEvenement[]) =>
    listeNoms(
      locale,
      liste.map((s) => t("pages.evenements.skinDe", { skin: s.nom, heros: nomHeros(s.heros) })),
    );
  const autres = MODES_AUTRES.filter((k) => m.autres[k].length > 0);
  const nAutres = autres.reduce((n, k) => n + m.autres[k].length, 0);
  return [
    m.starlight.length > 0 && t("pages.evenements.resume.starlight", { liste: noms(m.starlight) }),
    m.collector.length > 0
      ? t("pages.evenements.resume.collector", { liste: noms(m.collector) })
      : m.sansCollector && t("pages.evenements.resume.sansCollector"),
    nAutres > 0 &&
      t(nAutres === 1 ? "pages.evenements.resume.autres1" : "pages.evenements.resume.autres", {
        n: nombre.format(nAutres),
        detail: listeNoms(
          locale,
          autres.map((k) => t(`pages.evenements.modes.${k}.resume`, { n: nombre.format(m.autres[k].length) })),
        ),
      }),
  ].filter((x): x is string => !!x);
}

/**
 * Sections d'un mois. `page` : sections de premier rang, avec leur
 * explication ; `frise` : sous-titres compacts, sous le titre du mois.
 */
export function ContenuMois({
  m,
  t,
  locale,
  niveau,
}: {
  m: MoisEvenements;
  t: T;
  locale: Langue;
  niveau: "page" | "frise";
}) {
  const langueHtml = LOCALE_HTML[locale];
  const nombre = new Intl.NumberFormat(langueHtml);
  const nSkins = (n: number) =>
    t(n === 1 ? "pages.calendrierSkins.nSkins1" : "pages.calendrierSkins.nSkins", { n: nombre.format(n) });
  const blocs: { mode: ModeObtention; skins: SkinEvenement[]; vide?: string }[] = [
    { mode: "starlight", skins: m.starlight, vide: t("pages.evenements.sansStarlight") },
    { mode: "collector", skins: m.collector, vide: m.sansCollector ? t("pages.evenements.sansCollector") : undefined },
    ...MODES_AUTRES.map((mode) => ({ mode, skins: m.autres[mode] })),
  ];

  return (
    <div className={niveau === "page" ? "space-y-14" : "space-y-8"}>
      {blocs
        .filter((b) => b.skins.length > 0 || b.vide)
        .map(({ mode, skins, vide }) => {
          const titre = t(`pages.evenements.modes.${mode}.titre`);
          const compte = skins.length > 0 && (
            <span className="text-base font-normal text-craie-500"> · {nSkins(skins.length)}</span>
          );
          const contenu =
            skins.length > 0 ? (
              <GrilleSkins cartes={skins.map((s) => carteEvenement(s, t, langueHtml, nombre))} />
            ) : (
              <p className="max-w-2xl text-sm leading-relaxed text-craie-400">{vide}</p>
            );
          return niveau === "page" ? (
            <section key={mode} id={mode} className="scroll-mt-24">
              <TitreSection chapeau={t(`pages.evenements.modes.${mode}.desc`)}>
                {titre}
                {compte}
              </TitreSection>
              {contenu}
            </section>
          ) : (
            <section key={mode}>
              <h4 className="mb-3 font-titre text-lg font-semibold text-craie-100">
                {titre}
                {compte}
              </h4>
              {contenu}
            </section>
          );
        })}
    </div>
  );
}

/** Pages du wiki citees, avec leur derniere modification : le lecteur juge de leur fraicheur. */
export function ListeSources({ sources, t, locale }: { sources: SourceListe[]; t: T; locale: Langue }) {
  if (sources.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} rel="noreferrer nofollow" target="_blank" className="font-semibold text-or-400 hover:underline">
            {t("pages.evenements.sourcePage", { page: s.titre })}
          </a>{" "}
          <span className="text-craie-500">
            · {t("pages.evenements.sourceModifiee", { date: dateLongue(locale, s.modifie) })}
          </span>
        </li>
      ))}
    </ul>
  );
}
