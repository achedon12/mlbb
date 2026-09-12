import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconeObjet } from "@/components/fiche-objet";
import { ListeLiens, PartsChoix, TableauRangs, TableauUsage } from "@/components/fiche-usage";
import { LigneFraicheur } from "@/components/fraicheur";
import { Carte, EnTetePage, TitreSection } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import type { T } from "@/i18n/t";
import { creerT } from "@/i18n/traductions";
import { herosParSlug } from "@/lib/donnees";
import {
  donneesFiche,
  emblemesFiches,
  imageTalent,
  nomTalent,
  partsAvec,
  resumeRangs,
  sortsFiches,
  talentsAvecEmbleme,
  texteChoix,
  usage,
} from "@/lib/fiches-usage";
import { dateLongue, listeNoms, patchActuel } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

/** Une page par embleme, generee au build ; toute autre adresse est une 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return emblemesFiches.map((e) => ({ slug: e.slug }));
}

const nomHeros = (slug: string) => herosParSlug.get(slug)?.name ?? slug;
const nomEmbleme = (t: T, f: (typeof emblemesFiches)[number]) =>
  texteChoix(t, f.embleme.key, "name", f.embleme.name)!;

/**
 * Ce que la page et ses metadonnees disent d'un embleme : ses bonus, les heros
 * qui le prennent dans leurs builds les plus joues, et les talents choisis avec.
 */
function fiche(locale: Langue, slug: string) {
  const f = emblemesFiches.find((e) => e.slug === slug);
  if (!f) return null;
  const t = creerT(locale);
  const nom = nomEmbleme(t, f);
  const bonus = texteChoix(t, f.embleme.key, "bonus", f.embleme.bonus)!;
  const pourQui = texteChoix(t, f.embleme.key, "bestFor", f.embleme.bestFor)!;
  const heros = usage("embleme", slug);
  const talents = talentsAvecEmbleme(slug);
  const premier = heros[0];
  const phrases = premier
    ? [
        t("pages.emblemDetail.desc", {
          nom,
          bonus,
          n: heros.length,
          heros: listeNoms(locale, heros.slice(0, 3).map((h) => nomHeros(h.slug))),
        }),
        ...(talents[2].length
          ? [t("pages.emblemDetail.talentsDesc", { talents: listeNoms(locale, talents[2].slice(0, 2).map((p) => nomTalent(t, p.cle))) })]
          : []),
      ]
    : [t("pages.emblemDetail.descWithout", { nom, bonus, pourQui })];
  return {
    f,
    t,
    nom,
    bonus,
    pourQui,
    heros,
    talents,
    titre: t("pages.emblemDetail.title", { nom, v: patchActuel?.version ?? "" }),
    chapeau: phrases.join(" "),
    description: [...phrases, t("pages.sheets.updateDesc", { date: dateLongue(locale) })].join(" "),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const f = fiche(locale, slug);
  if (!f) return {};
  return metaPage(locale, { titre: f.titre, description: f.description, chemin: `/emblems/${slug}` });
}

export default async function PageEmbleme({ params }: Params) {
  const { locale, slug } = await params;
  const fi = fiche(locale, slug);
  if (!fi) notFound();
  const { f, t, nom, heros, talents } = fi;

  const sortsParSlug = new Map(sortsFiches.map((s) => [s.slug, s]));
  const sorts = partsAvec("embleme", slug, "sort")
    .slice(0, 4)
    .map((p) => {
      const s = sortsParSlug.get(p.cle);
      return {
        cle: p.cle,
        nom: texteChoix(t, p.cle, "name", s?.nom ?? p.cle)!,
        image: s?.image ?? null,
        part: p.part,
        href: s ? `/spells/${p.cle}` : undefined,
      };
    });
  const etages = [
    t("pages.emblemDetail.tier", { n: 1 }),
    t("pages.emblemDetail.tier", { n: 2 }),
    t("emblemsUI.talents"),
  ];

  const titreHeros = t("pages.sheets.heroesTitle");
  const donnees = donneesFiche(locale, {
    titre: fi.titre,
    description: fi.description,
    chemin: `/emblems/${slug}`,
    nom,
    resume: fi.bonus,
    image: f.image,
    listeNom: t("pages.sheets.listLd", { nom }),
    heros: heros.slice(0, 10).map((h) => ({ nom: nomHeros(h.slug), slug: h.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }} />
      <EnTetePage
        titre={nom}
        chapeau={fi.chapeau}
        icone={f.image ? <IconeObjet image={f.image} taille={64} /> : undefined}
        miettes={[
          { nom: t("nav.emblems.label"), href: "/emblems" },
          { nom, freres: emblemesFiches.map((e) => ({ nom: nomEmbleme(t, e), href: `/emblems/${e.slug}` })) },
        ]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <Carte>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.emblemDetail.bonus")}</dt>
              <dd className="mt-1 text-chalk-100">{fi.bonus}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.sheets.bestFor")}</dt>
              <dd className="mt-1 leading-relaxed text-chalk-300">{fi.pourQui}</dd>
            </div>
          </dl>
        </Carte>

        <section>
          <TitreSection chapeau={t("pages.sheets.help")}>{titreHeros}</TitreSection>
          {heros.length > 0 ? (
            <TableauUsage lignes={heros} legende={titreHeros} t={t} langue={locale} />
          ) : (
            <p className="text-sm text-chalk-500">{t("pages.sheets.none")}</p>
          )}
        </section>

        {talents.some((e) => e.length > 0) && (
          <section>
            <TitreSection chapeau={t("pages.emblemDetail.talentsIntro")}>{t("pages.emblemDetail.talentsTitle")}</TitreSection>
            <div className="grid gap-8 md:grid-cols-3">
              {talents.map((parts, i) => (
                <div key={etages[i]}>
                  <h3 className="mb-3 font-heading font-bold text-chalk-100">{etages[i]}</h3>
                  <PartsChoix
                    langue={locale}
                    entrees={parts.slice(0, 4).map((p) => ({
                      cle: p.cle,
                      nom: nomTalent(t, p.cle),
                      image: imageTalent(p.cle),
                      part: p.part,
                    }))}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {sorts.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.emblemDetail.spellsIntro")}>{t("pages.emblemDetail.spellsTitle")}</TitreSection>
            <div className="max-w-md">
              <PartsChoix langue={locale} entrees={sorts} />
            </div>
          </section>
        )}

        {heros.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.sheets.byRankIntro")}>{t("pages.sheets.byRank")}</TitreSection>
            <TableauRangs
              resume={resumeRangs("embleme", slug)}
              legende={t("pages.sheets.byRank")}
              t={t}
              langue={locale}
            />
          </section>
        )}

        <section>
          <TitreSection>{t("pages.emblemDetail.others")}</TitreSection>
          <ListeLiens
            liens={emblemesFiches
              .filter((e) => e.slug !== slug)
              .map((e) => {
                const n = usage("embleme", e.slug).length;
                return {
                  href: `/emblems/${e.slug}`,
                  nom: nomEmbleme(t, e),
                  image: e.image,
                  detail: n ? t("pages.sheets.nHeroes", { n }) : undefined,
                };
              })}
          />
        </section>
      </div>
    </>
  );
}
