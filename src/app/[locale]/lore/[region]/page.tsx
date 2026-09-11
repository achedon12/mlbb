import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditWiki } from "@/components/credit-wiki";
import Link from "@/components/lien";
import { PaireLoreCarte } from "@/components/paire-lore";
import { PortraitHeros } from "@/components/portrait-heros";
import { EnTetePage, TitreSection } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { dateSortie, libelleHeros } from "@/i18n/donnees-heros";
import { donneesListeHeros, metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { histoires, synchro } from "@/lib/donnees";
import { listeNoms } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import {
  nomsHeros,
  regionDe,
  regionParCle,
  regionsLore,
  resumeRegion,
  type PaireLore,
  type RegionLore,
} from "@/lib/lore";

type Params = { params: Promise<{ locale: Langue; region: string }> };

/** Liens montres d'emblee ; les autres se deplient. */
const LIENS_VISIBLES = 10;

export const dynamicParams = false;

export function generateStaticParams() {
  return regionsLore.map((r) => ({ region: r.cle }));
}

/** Heros les plus lies aux autres dans leurs fiches : les figures de la region, pour la description. */
function figures(region: RegionLore, locale: Langue): string[] {
  const resume = resumeRegion(region, locale);
  const liens = new Map<string, number>();
  for (const p of [...resume.internes, ...resume.externes]) {
    for (const s of [p.a, p.b]) liens.set(s, (liens.get(s) ?? 0) + 1);
  }
  return [...region.heros]
    .sort((a, b) => (liens.get(b.slug) ?? 0) - (liens.get(a.slug) ?? 0) || a.nom.localeCompare(b.nom, "en"))
    .slice(0, 3)
    .map((h) => h.nom);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, region } = await params;
  const r = regionParCle.get(region);
  if (!r) return {};
  const t = creerT(locale);
  const nom = libelleHeros(t, "region", r.nom)!;
  return metaPage(locale, {
    titre: t("pages.seo.loreRegion.titre", { region: nom }),
    description: t("pages.seo.loreRegion.description", {
      region: nom,
      n: r.heros.length,
      noms: listeNoms(locale, figures(r, locale)),
    }),
    chemin: `/lore/${r.cle}`,
    motsCles: [`${r.nom} MLBB`, "MLBB lore", "Mobile Legends lore", ...r.heros.slice(0, 5).map((h) => `${h.nom} lore`)],
  });
}

export default async function PageRegion({ params }: Params) {
  const { locale, region } = await params;
  const r = regionParCle.get(region);
  if (!r) notFound();

  const t = creerT(locale);
  const h = histoires(locale);
  const nomRegion = (nom: string) => libelleHeros(t, "region", nom)!;
  const nom = nomRegion(r.nom);
  const resume = resumeRegion(r, locale);
  const libelleDe = (slug: string) => {
    const x = regionParCle.get(regionDe(slug) ?? "");
    return x ? nomRegion(x.nom) : null;
  };

  // Faits tires des donnees, un par ligne : rien n'y est ecrit a la main.
  const faits: string[] = [
    t("pages.lore.region.faitRoles", {
      n: r.heros.length,
      roles: listeNoms(locale, resume.roles.slice(0, 3).map((x) => `${t(`roles.${x.role}`)} (${x.n})`)),
    }),
  ];
  if (resume.premier && resume.dernier) {
    faits.push(
      t("pages.lore.region.faitArrivees", {
        premier: resume.premier.nom,
        datePremier: dateSortie(resume.premier.sortie, locale, t) ?? "",
        dernier: resume.dernier.nom,
        dateDernier: dateSortie(resume.dernier.sortie, locale, t) ?? "",
      }),
    );
  } else if (resume.premier) {
    faits.push(
      t("pages.lore.region.faitArrivee", {
        nom: resume.premier.nom,
        date: dateSortie(resume.premier.sortie, locale, t) ?? "",
      }),
    );
  }
  if (resume.factions.length) {
    faits.push(t("pages.lore.region.faitFactions", { liste: listeNoms(locale, resume.factions.map((f) => `${f.nom} (${f.n})`)) }));
  }
  if (resume.especes.length) {
    faits.push(t("pages.lore.region.faitEspeces", { liste: listeNoms(locale, resume.especes.map((e) => `${e.nom} (${e.n})`)) }));
  }
  faits.push(t("pages.lore.region.faitLiens", { internes: resume.internes.length, externes: resume.externes.length }));
  if (resume.voisines.length) {
    faits.push(
      t("pages.lore.region.faitVoisines", {
        liste: listeNoms(
          locale,
          resume.voisines.slice(0, 3).map((v) => `${nomRegion(regionParCle.get(v.cle)?.nom ?? v.cle)} (${v.n})`),
        ),
      }),
    );
  }

  const listePaires = (paires: PaireLore[], avecRegions: boolean) => (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {paires.map((p) => (
        <li key={`${p.a}-${p.b}`}>
          <PaireLoreCarte paire={p} t={t} regions={avecRegions ? [libelleDe(p.a), libelleDe(p.b)] : undefined} />
        </li>
      ))}
    </ul>
  );

  const ligneLien = (p: PaireLore) => {
    const natures = [p.deA?.nature, p.deB?.nature].filter((x): x is string => !!x);
    const lien = (slug: string) => (
      <a href={`/${locale}/heroes/${slug}#histoire`} className="font-semibold text-chalk-100 hover:text-gold-400">
        {nomsHeros.get(slug) ?? slug}
      </a>
    );
    return (
      <>
        {lien(p.a)} <span aria-hidden>↔</span>
        <span className="sr-only"> {t("pages.lore.et")} </span> {lien(p.b)}
        {natures.length > 0 && <span className="text-chalk-500"> · {natures.join(" / ")}</span>}
      </>
    );
  };

  const donneesStructurees = donneesListeHeros(locale, {
    nom: t("pages.seo.loreRegion.titre", { region: nom }),
    description: faits[0],
    chemin: `/lore/${r.cle}`,
    heros: r.heros.map((x) => ({ nom: x.nom, slug: x.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={nom}
        chapeau={t("pages.lore.region.chapeau", { region: nom, n: r.heros.length })}
        miettes={[
          { nom: t("pages.lore.miette"), href: "/lore" },
          { nom, freres: regionsLore.map((x) => ({ nom: nomRegion(x.nom), href: `/lore/${x.cle}` })) },
        ]}
      />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="en-bref">
          <TitreSection>{t("pages.lore.region.enBrefTitre")}</TitreSection>
          <ul className="max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-chalk-300 marker:text-gold-400">
            {faits.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        <section id="heros">
          <TitreSection chapeau={t("pages.lore.region.herosChapeau")}>{t("pages.lore.region.herosTitre", { region: nom })}</TitreSection>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {r.heros.map((x) => {
              const fiche = h[x.slug]?.fiche;
              const infos = [fiche?.espece, fiche?.age ? t("pages.lore.age", { age: fiche.age }) : null].filter(Boolean);
              return (
                <li key={x.slug} id={x.slug} className="scroll-mt-24">
                  <article className="bevel flex h-full gap-4 border border-night-700/70 bg-night-900/60 p-4">
                    <PortraitHeros source={x.visuels.portrait ?? x.visuels.icone} nom={x.nom} taille="fiche" decoratif />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading text-xl font-bold text-chalk-100">
                        <Link href={`/heroes/${x.slug}`} className="hover:text-gold-400">
                          {x.nom}
                        </Link>
                      </h3>
                      {(fiche?.titre ?? x.titre) && <p className="text-xs text-chalk-500">{fiche?.titre ?? x.titre}</p>}
                      {h[x.slug]?.accroche && (
                        <p className="mt-2 line-clamp-3 text-sm italic leading-relaxed text-chalk-300">{h[x.slug]!.accroche}</p>
                      )}
                      {infos.length > 0 && <p className="mt-2 text-xs text-chalk-400">{infos.join(" · ")}</p>}
                      {fiche?.affiliations.length ? (
                        <ul className="mt-2 flex flex-wrap gap-1">
                          {fiche.affiliations.slice(0, 3).map((a) => (
                            <li
                              key={a}
                              className="bevel-sm border border-night-700/70 bg-night-800/60 px-1.5 py-0.5 text-[0.7rem] text-chalk-300"
                            >
                              {a}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Link
                        href={`/heroes/${x.slug}#histoire`}
                        className="mt-3 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                      >
                        {t("pages.lore.lireHistoire", { nom: x.nom })} →
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="liens">
          <TitreSection chapeau={t("pages.lore.region.liensChapeau")}>{t("pages.lore.region.liensTitre")}</TitreSection>
          {resume.internes.length === 0 ? (
            <p className="text-chalk-500">{t("pages.lore.region.aucunLien", { region: nom })}</p>
          ) : (
            <>
              {listePaires(resume.internes.slice(0, LIENS_VISIBLES), false)}
              {resume.internes.length > LIENS_VISIBLES && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gold-400 hover:text-gold-500">
                    {t("pages.lore.region.autresLiens", { n: resume.internes.length - LIENS_VISIBLES })}
                  </summary>
                  {/* Lignes sans portrait : une grande region compte plus de cent liens. */}
                  <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm leading-relaxed md:grid-cols-2">
                    {resume.internes.slice(LIENS_VISIBLES).map((p) => (
                      <li key={`${p.a}-${p.b}`}>{ligneLien(p)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>

        {resume.externes.length > 0 && (
          <section id="au-dela">
            <TitreSection chapeau={t("pages.lore.region.externesChapeau", { region: nom })}>
              {t("pages.lore.region.externesTitre")}
            </TitreSection>
            {listePaires(resume.externes.slice(0, 8), true)}
          </section>
        )}

        <nav aria-labelledby="autres-regions">
          <h2 id="autres-regions" className="font-heading text-lg font-bold text-chalk-100">
            {t("pages.lore.region.autresRegions")}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {regionsLore
              .filter((x) => x.cle !== r.cle)
              .map((x) => (
                <li key={x.cle}>
                  <Link
                    href={`/lore/${x.cle}`}
                    className="bevel-sm inline-block border border-night-700 px-3 py-1.5 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                  >
                    {nomRegion(x.nom)} <span className="text-chalk-500">· {x.heros.length}</span>
                  </Link>
                </li>
              ))}
          </ul>
          <p className="mt-4">
            <Link href="/lore" className="text-sm font-semibold text-gold-400 hover:text-gold-500">
              ← {t("pages.lore.retourHub")}
            </Link>
          </p>
        </nav>

        <CreditWiki t={t} href={synchro.source} cle="pages.lore.source" />
      </div>
    </>
  );
}
