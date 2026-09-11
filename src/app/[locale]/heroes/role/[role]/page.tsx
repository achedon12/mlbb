import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/lien";
import { LigneFraicheur } from "@/components/fraicheur";
import { PortraitHeros } from "@/components/portrait-heros";
import { classesPuce } from "@/components/puce";
import { BadgePalier, EnTetePage } from "@/components/ui";
import { heros } from "@/lib/donnees";
import { ROLES } from "@/lib/draft";
import { cheminFiltre, cheminRole, roleDuSlug, SLUGS_ROLE } from "@/lib/filtres-tier-list";
import { dateLongue, dateMesure, listeNoms, patchActuel } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { classementComplet } from "@/lib/tier-list";
import type { Role } from "@/lib/types";
import type { Langue } from "@/i18n/config";
import { creerT, type T } from "@/i18n/traductions";
import { donneesListeHeros, metaPage } from "@/i18n/seo";

type Params = { params: Promise<{ locale: Langue; role: string }> };

/**
 * Page d'un role : ses heros, du plus fort au plus faible, avec palier, taux de
 * victoire et lanes. Elle remplace `/heroes?role=…` comme cible du fil
 * d'Ariane des fiches : cette adresse-la se canonise sur le catalogue entier,
 * alors qu'une page de role peut etre indexee pour elle-meme.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(SLUGS_ROLE).map((role) => ({ role }));
}

/**
 * Heros du role, principal ou secondaire, dans l'ordre de la tier list (tous
 * rangs) ; ceux que le jeu ne mesure pas encore ferment la liste, par nom.
 */
function herosDuRole(role: Role) {
  const classes = classementComplet.filter((e) => e.heros.roles.includes(role));
  const mesures = new Set(classes.map((e) => e.heros.slug));
  const autres = heros
    .filter((h) => h.roles.includes(role) && !mesures.has(h.slug))
    .sort((a, b) => a.nom.localeCompare(b.nom));
  return [
    ...classes.map((e) => ({ heros: e.heros, palier: e.palier, victoire: e.victoire as number | null })),
    ...autres.map((h) => ({ heros: h, palier: null, victoire: null })),
  ];
}

const reperes = (t: T, role: Role, n: number) => ({
  role: t(`roles.${role}`),
  pluriel: t(`pages.tierList.rolePluriel.${role}`),
  n,
});

/** Description en donnees : effectif, trois premiers, date du releve et patch. */
function description(locale: Langue, role: Role): string {
  const t = creerT(locale);
  const liste = herosDuRole(role);
  return t("pages.seo.heroesRole.description", {
    ...reperes(t, role, liste.length),
    top: listeNoms(locale, liste.filter((e) => e.palier).slice(0, 3).map((e) => e.heros.nom)),
    date: dateLongue(locale),
    v: patchActuel.version,
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, role: slug } = await params;
  const role = roleDuSlug(slug);
  if (!role) return {};
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.heroesRole.titre", { ...reperes(t, role, herosDuRole(role).length), v: patchActuel.version }),
    description: description(locale, role),
    chemin: cheminRole(role),
  });
}

export default async function PageRole({ params }: Params) {
  const { locale, role: slug } = await params;
  const role = roleDuSlug(slug);
  if (!role) notFound();
  const t = creerT(locale);
  const liste = herosDuRole(role);
  const r = reperes(t, role, liste.length);
  const titre = t("pages.heroesRole.titre", r);
  const pourcent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const donneesStructurees = donneesListeHeros(locale, {
    nom: titre,
    description: description(locale, role),
    chemin: cheminRole(role),
    heros: liste.map((e) => ({ nom: e.heros.nom, slug: e.heros.slug })),
    modifie: dateMesure,
    classe: true,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <EnTetePage
        titre={titre}
        chapeau={t("pages.heroesRole.chapeau", r)}
        miettes={[
          { nom: t("nav.heroes.label"), href: "/heroes" },
          { nom: r.role, freres: ROLES.map((x) => ({ nom: t(`roles.${x}`), href: cheminRole(x) })) },
        ]}
      >
        <LigneFraicheur langue={locale} avant={t("pages.heroesRole.nHeros", r)} className="mt-6" />
      </EnTetePage>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <Link
          href={cheminFiltre({ type: "role", valeur: role })}
          className="bevel-sm inline-flex items-center gap-2 bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("pages.heroesRole.voirTierList", r)} →
        </Link>

        <nav aria-label={t("pages.heroesRole.autresRoles")} className="mb-8 mt-6 flex flex-wrap items-center gap-2">
          <span aria-hidden className="mr-1 text-xs uppercase tracking-wide text-chalk-500">
            {t("pages.heroesRole.autresRoles")}
          </span>
          {ROLES.map((x) => (
            <Link
              key={x}
              href={cheminRole(x)}
              aria-current={x === role ? "page" : undefined}
              className={classesPuce(x === role)}
            >
              {t(`roles.${x}`)}
            </Link>
          ))}
        </nav>

        <ul className="space-y-1.5">
          {liste.map((e) => (
            <li key={e.heros.slug}>
              <Link href={`/heroes/${e.heros.slug}`} className="tier-row">
                <PortraitHeros
                  source={e.heros.visuels.icone ?? e.heros.visuels.portrait}
                  nom={e.heros.nom}
                  taille="icone"
                  decoratif
                />
                <div className="tier-row-identity sm:w-auto sm:flex-1">
                  <span className="tier-row-name">{e.heros.nom}</span>
                  <span className="tier-row-lanes">
                    {e.heros.lanes.map((l) => t(`lanes.${l}`)).join(" · ") || "—"}
                  </span>
                </div>
                {e.palier ? (
                  <>
                    <span className="sr-only">{t("pages.tierList.palier", { p: e.palier })}</span>
                    <span aria-hidden>
                      <BadgePalier palier={e.palier} />
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-chalk-500">{t("pages.heroesRole.nonMesure")}</span>
                )}
                <dl className="tier-row-rates">
                  <div>
                    <dt>{t("pages.tierList.victoire")}</dt>
                    <dd>{e.victoire === null ? "—" : `${pourcent.format(e.victoire)} %`}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
