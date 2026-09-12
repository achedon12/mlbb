import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconeObjet } from "@/components/fiche-objet";
import { ListeLiens, PartsChoix, TableauRangs, TableauUsage } from "@/components/fiche-usage";
import { LigneFraicheur } from "@/components/fraicheur";
import { Carte, EnTetePage, TitreSection } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT } from "@/i18n/traductions";
import { herosParSlug } from "@/lib/donnees";
import {
  donneesFiche,
  emblemesFiches,
  partsAvec,
  resumeRangs,
  sortsFiches,
  texteChoix,
  usage,
} from "@/lib/fiches-usage";
import { dateLongue, listeNoms, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

/** Une page par sort de combat, generee au build ; toute autre adresse est une 404. */
export const dynamicParams = false;
export function generateStaticParams() {
  return sortsFiches.map((s) => ({ slug: s.slug }));
}

const nomHeros = (slug: string) => herosParSlug.get(slug)?.name ?? slug;

/**
 * Ce que la page et ses metadonnees disent d'un sort : son effet quand il est
 * decrit (aucune description n'est inventee), et les heros qui le prennent.
 */
function fiche(locale: Langue, slug: string) {
  const s = sortsFiches.find((x) => x.slug === slug);
  if (!s) return null;
  const t = creerT(locale);
  const nom = texteChoix(t, slug, "nom", s.nom)!;
  const effet = texteChoix(t, slug, "description");
  const pourQui = texteChoix(t, slug, "pourQui");
  const heros = usage("sort", slug);
  const premier = heros[0];
  const phrases = [
    ...(effet ? [t("pages.spellDetail.descEffet", { nom, effet })] : []),
    premier
      ? premier.victoire === null
        ? t("pages.fiches.descHerosSimple", { heros: listeNoms(locale, heros.slice(0, 3).map((h) => nomHeros(h.slug))) })
        : t("pages.fiches.descHeros", {
            heros: listeNoms(locale, heros.slice(0, 3).map((h) => nomHeros(h.slug))),
            premier: nomHeros(premier.slug),
            taux: pourcentage(locale, premier.victoire),
          })
      : t("pages.spellDetail.descAucun", { nom }),
  ];
  return {
    s,
    t,
    nom,
    effet,
    pourQui,
    heros,
    titre: t("pages.spellDetail.titre", { nom, v: patchActuel?.version ?? "" }),
    chapeau: phrases.join(" "),
    description: [...phrases, t("pages.fiches.descMaj", { date: dateLongue(locale) })].join(" "),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const f = fiche(locale, slug);
  if (!f) return {};
  return metaPage(locale, { titre: f.titre, description: f.description, chemin: `/spells/${slug}` });
}

export default async function PageSort({ params }: Params) {
  const { locale, slug } = await params;
  const fi = fiche(locale, slug);
  if (!fi) notFound();
  const { s, t, nom, heros } = fi;

  const emblemesParSlug = new Map(emblemesFiches.map((e) => [e.slug, e]));
  const emblemes = partsAvec("sort", slug, "embleme")
    .slice(0, 4)
    .flatMap((p) => {
      const e = emblemesParSlug.get(p.cle);
      return e
        ? [{
            cle: p.cle,
            nom: texteChoix(t, e.embleme.key, "nom", e.embleme.name)!,
            image: e.image,
            part: p.part,
            href: `/emblems/${e.slug}`,
          }]
        : [];
    });

  const titreHeros = t("pages.fiches.herosTitre");
  const donnees = donneesFiche(locale, {
    titre: fi.titre,
    description: fi.description,
    chemin: `/spells/${slug}`,
    nom,
    resume: fi.effet,
    image: s.image,
    listeNom: t("pages.fiches.listeLd", { nom }),
    heros: heros.slice(0, 10).map((h) => ({ nom: nomHeros(h.slug), slug: h.slug })),
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }} />
      <EnTetePage
        titre={nom}
        chapeau={fi.chapeau}
        icone={s.image ? <IconeObjet image={s.image} taille={64} /> : undefined}
        miettes={[
          { nom: t("nav.emblems.label"), href: "/emblems" },
          {
            nom,
            freres: sortsFiches.map((x) => ({ nom: texteChoix(t, x.slug, "nom", x.nom)!, href: `/spells/${x.slug}` })),
          },
        ]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <Carte>
          <dl className="grid gap-4 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.spellDetail.effet")}</dt>
              <dd className="mt-1 leading-relaxed text-chalk-100">
                {fi.effet ?? <span className="text-chalk-500">{t("pages.spellDetail.sansDescription")}</span>}
              </dd>
            </div>
            {s.recharge !== null && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.spellDetail.recharge")}</dt>
                <dd className="mt-1 font-heading tabular-nums text-gold-400">{t("pages.spellDetail.secondes", { n: s.recharge })}</dd>
              </div>
            )}
            {fi.pourQui && (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.fiches.pourQui")}</dt>
                <dd className="mt-1 leading-relaxed text-chalk-300">{fi.pourQui}</dd>
              </div>
            )}
          </dl>
        </Carte>

        <section>
          <TitreSection chapeau={t("pages.fiches.aide")}>{titreHeros}</TitreSection>
          {heros.length > 0 ? (
            <TableauUsage lignes={heros} legende={titreHeros} t={t} langue={locale} />
          ) : (
            <p className="text-sm text-chalk-500">{t("pages.fiches.aucun")}</p>
          )}
        </section>

        {emblemes.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.spellDetail.emblemesIntro")}>{t("pages.spellDetail.emblemesTitre")}</TitreSection>
            <div className="max-w-md">
              <PartsChoix langue={locale} entrees={emblemes} />
            </div>
          </section>
        )}

        {heros.length > 0 && (
          <section>
            <TitreSection chapeau={t("pages.fiches.parRangIntro")}>{t("pages.fiches.parRang")}</TitreSection>
            <TableauRangs resume={resumeRangs("sort", slug)} legende={t("pages.fiches.parRang")} t={t} langue={locale} />
          </section>
        )}

        <section>
          <TitreSection>{t("pages.spellDetail.autres")}</TitreSection>
          <ListeLiens
            liens={sortsFiches
              .filter((x) => x.slug !== slug)
              .map((x) => {
                const n = usage("sort", x.slug).length;
                return {
                  href: `/spells/${x.slug}`,
                  nom: texteChoix(t, x.slug, "nom", x.nom)!,
                  image: x.image,
                  detail: n ? t("pages.fiches.nHeros", { n }) : undefined,
                };
              })}
          />
        </section>
      </div>
    </>
  );
}
