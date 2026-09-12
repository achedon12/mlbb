import type { Metadata } from "next";
import { TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/lien";
import { LigneFraicheur } from "@/components/fraicheur";
import { PortraitHeros } from "@/components/portrait-heros";
import { BadgePalier, EnTetePage, TitreSection } from "@/components/ui";
import { heros, herosParSlug } from "@/lib/donnees";
import { LANES } from "@/lib/draft";
import { tendancesDe } from "@/lib/evolution";
import { cheminFiltre } from "@/lib/filtres-tier-list";
import { dateLongue, dateMesure, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import {
  changementsDePalier,
  grouperAjustements,
  premiersSelon,
  SENS_AJUSTEMENT,
  type ChangementPalier,
  type SensAjustement,
} from "@/lib/rapport-meta";
import { site } from "@/lib/site";
import { decrireEcart, formaterEcart, mouvementsSemaine, SEUIL_NOTABLE, type Mouvement } from "@/lib/tendances";
import { classementComplet, regleTierList, type EntreeClassee } from "@/lib/tier-list";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { creerT, type T } from "@/i18n/traductions";
import { metaPage } from "@/i18n/seo";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue }> };

/**
 * Rapport meta de la semaine.
 *
 * Page generee au build a partir des donnees synchronisees, et donc refaite a
 * chaque synchronisation quotidienne : hausses et baisses du taux de victoire,
 * changements de palier, heros les plus bannis et les plus joues, dernier
 * patch, meilleurs heros par lane. Aucune prose inventee : chaque phrase est
 * un gabarit rempli par les chiffres du releve, et une rubrique sans donnees
 * le dit plutot que de broder.
 */
const CHEMIN = "/meta";
/** Lignes par liste : assez pour voir le mouvement, sans refaire la tier list. */
const NOMBRE = 5;
const NOMBRE_PALIERS = 8;

const RELEVE = (() => {
  const semaine = mouvementsSemaine(
    heros.map((h) => ({ slug: h.slug, serie: tendancesDe(h.slug).all })),
    NOMBRE,
  );
  const paliers = changementsDePalier(
    classementComplet.map((e) => ({ slug: e.hero.slug, serie: tendancesDe(e.hero.slug).all, palierActuel: e.tier })),
    regleTierList,
  );
  return {
    semaine,
    paliers,
    bannis: premiersSelon(classementComplet, (e) => e.banRate, NOMBRE),
    joues: premiersSelon(classementComplet, (e) => e.pickRate, NOMBRE),
    patch: patchActuel ? grouperAjustements(patchActuel.adjustments) : null,
    parLane: LANES.map((lane) => ({
      lane,
      entrees: classementComplet.filter((e) => e.hero.lanes.includes(lane)).slice(0, 3),
    })),
  };
})();

const version = () => patchActuel?.version ?? "—";

const titreSeo = (t: T, locale: Langue) => t("pages.seo.meta.title", { date: dateLongue(locale), v: version() });

function descriptionRapport(t: T, locale: Langue): string {
  const premier = classementComplet[0];
  const banni = RELEVE.bannis[0];
  if (!premier || !banni) {
    return t("pages.meta.lead", { date: dateLongue(locale), n: classementComplet.length, v: version() });
  }
  return t("pages.seo.meta.description", {
    date: dateLongue(locale),
    v: version(),
    premier: premier.hero.name,
    banni: banni.hero.name,
    ban: pourcentage(locale, banni.banRate),
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: titreSeo(t, locale),
    description: descriptionRapport(t, locale),
    chemin: CHEMIN,
    type: "article",
    publie: dateMesure,
  });
}

const COULEUR: Record<SensAjustement, string> = {
  amelioration: "text-emerald-400",
  affaiblissement: "text-blood-500",
  ajustement: "text-azure-400",
};

export default async function PageRapportMeta({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const { semaine, paliers, bannis, joues, patch, parLane } = RELEVE;
  const date = dateLongue(locale);
  const seuil = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(SEUIL_NOTABLE);
  const nom = (slug: string) => herosParSlug.get(slug)?.name ?? slug;
  const premier = classementComplet[0];
  const hausse = semaine.hausses[0];
  const baisse = semaine.baisses[0];
  const changements = paliers.montees.length + paliers.descentes.length;

  // Le resume : des phrases-gabarits remplies par les chiffres, rien d'autre.
  const resume = [
    premier &&
      t("pages.meta.summary.top", {
        nom: premier.hero.name,
        palier: premier.tier,
        victoire: pourcentage(locale, premier.winRate),
        ban: pourcentage(locale, premier.banRate),
      }),
    hausse &&
      t("pages.meta.summary.rise", {
        nom: nom(hausse.slug),
        avant: pourcentage(locale, hausse.variation.avant),
        actuel: pourcentage(locale, hausse.variation.actuel),
        jours: hausse.variation.jours,
      }),
    baisse &&
      t("pages.meta.summary.fall", {
        nom: nom(baisse.slug),
        avant: pourcentage(locale, baisse.variation.avant),
        actuel: pourcentage(locale, baisse.variation.actuel),
        jours: baisse.variation.jours,
      }),
    changements > 0 &&
      t("pages.meta.summary.tiers", { montees: paliers.montees.length, descentes: paliers.descentes.length }),
    bannis[0] && t("pages.meta.summary.banned", { nom: bannis[0].hero.name, ban: pourcentage(locale, bannis[0].banRate) }),
  ].filter((p): p is string => typeof p === "string");

  // Article date du releve : c'est lui qui change le contenu, chaque jour.
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: titreSeo(t, locale),
    description: descriptionRapport(t, locale),
    datePublished: dateMesure,
    dateModified: dateMesure,
    inLanguage: LOCALE_HTML[locale],
    image: `${site.url}/opengraph-image`,
    author: { "@type": "Organization", name: site.nom, url: site.url },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}${CHEMIN}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <EnTetePage
        titre={t("pages.meta.title", { date })}
        chapeau={t("pages.meta.lead", { date, n: classementComplet.length, v: version() })}
      >
        <LigneFraicheur langue={locale} className="mt-6" />
        {resume.length > 0 && (
          <ul className="mt-6 max-w-2xl space-y-1.5 text-sm leading-relaxed text-chalk-300">
            {resume.map((phrase) => (
              <li key={phrase} className="flex gap-2">
                <span aria-hidden className="text-gold-400">
                  •
                </span>
                {phrase}
              </li>
            ))}
          </ul>
        )}
      </EnTetePage>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        {/* ── Hausses et baisses ─────────────────────────────────────────── */}
        <section>
          <TitreSection chapeau={t("home.trends.lead", { seuil })}>{t("home.trends.title")}</TitreSection>
          <div className="grid gap-8 md:grid-cols-2">
            <Mouvements
              titre={t("home.trends.rise")}
              vide={t("home.trends.noRise")}
              mouvements={semaine.hausses}
              hausse
              langue={locale}
              t={t}
            />
            <Mouvements
              titre={t("home.trends.fall")}
              vide={t("home.trends.noFall")}
              mouvements={semaine.baisses}
              hausse={false}
              langue={locale}
              t={t}
            />
          </div>
        </section>

        {/* ── Changements de palier ──────────────────────────────────────── */}
        <section>
          <TitreSection chapeau={t("pages.meta.tiers.lead")}>{t("pages.meta.tiers.title")}</TitreSection>
          <div className="grid gap-8 md:grid-cols-2">
            <Paliers
              titre={t("pages.meta.tiers.promotions")}
              vide={t("pages.meta.tiers.noPromotion")}
              changements={paliers.montees.slice(0, NOMBRE_PALIERS)}
              hausse
              t={t}
            />
            <Paliers
              titre={t("pages.meta.tiers.demotions")}
              vide={t("pages.meta.tiers.noDemotion")}
              changements={paliers.descentes.slice(0, NOMBRE_PALIERS)}
              hausse={false}
              t={t}
            />
          </div>
        </section>

        {/* ── Bans et picks ──────────────────────────────────────────────── */}
        <section>
          <TitreSection chapeau={t("pages.meta.bansPicks.lead", { date })}>
            {t("pages.meta.bansPicks.title")}
          </TitreSection>
          <div className="grid gap-8 md:grid-cols-2">
            <Classement
              titre={t("pages.meta.bansPicks.banned")}
              entrees={bannis}
              valeur={(e) => pourcentage(locale, e.banRate)}
            />
            <Classement
              titre={t("pages.meta.bansPicks.played")}
              entrees={joues}
              valeur={(e) => pourcentage(locale, e.pickRate)}
            />
          </div>
        </section>

        {/* ── Dernier patch ──────────────────────────────────────────────── */}
        {patchActuel && patch && (
          <section>
            <TitreSection
              chapeau={
                patchActuel.date
                  ? t("pages.patchNotes.publishedOn", { date: dateLongue(locale, patchActuel.date) })
                  : undefined
              }
              action={{ href: `/patch-notes/${patchActuel.version}`, label: t("home.readNotes") }}
            >
              {t("pages.meta.patch.title", { v: patchActuel.version })}
            </TitreSection>
            <div className="space-y-6">
              {patchActuel.newHeroes.length > 0 && (
                <GroupeHeros titre={t("pages.meta.patch.newcomers")} liste={patchActuel.newHeroes} couleur="text-gold-400" />
              )}
              {SENS_AJUSTEMENT.map((sens) =>
                patch[sens].length > 0 ? (
                  <GroupeHeros
                    key={sens}
                    titre={t(`patchHeroes.plural.${sens}`)}
                    liste={patch[sens]}
                    couleur={COULEUR[sens]}
                  />
                ) : null,
              )}
              {patchActuel.newHeroes.length === 0 && SENS_AJUSTEMENT.every((s) => patch[s].length === 0) && (
                <p className="text-sm text-chalk-500">{t("pages.meta.patch.none")}</p>
              )}
            </div>
          </section>
        )}

        {/* ── Meilleurs heros par lane ───────────────────────────────────── */}
        <section>
          <TitreSection chapeau={t("pages.meta.lanes.lead")}>{t("pages.meta.lanes.title")}</TitreSection>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {parLane.map(({ lane, entrees }) => (
              <div key={lane} className="bevel flex flex-col border border-night-700/70 bg-night-900/60 p-4">
                <h3 className="font-heading text-lg font-bold text-gold-400">{t(`lanes.${lane}`)}</h3>
                <ol className="mt-3 flex-1 space-y-2.5">
                  {entrees.map((e) => (
                    <li key={e.hero.slug}>
                      <Link href={`/heroes/${e.hero.slug}`} className="group flex items-center gap-2.5">
                        <PortraitHeros
                          source={e.hero.images.icon ?? e.hero.images.portrait}
                          nom={e.hero.name}
                          taille="petite"
                          decoratif
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                            {e.hero.name}
                          </span>
                          <span className="block text-xs text-chalk-500">
                            {t("pages.meta.lanes.row", { palier: e.tier, victoire: pourcentage(locale, e.winRate) })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <Link
                  href={cheminFiltre({ type: "lane", valeur: lane })}
                  className="mt-4 text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
                >
                  {t("pages.meta.lanes.see", { lane: t(`pages.tierList.laneSeo.${lane}`) })} →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500">
          {t("pages.meta.method", { date, seuil })}
        </p>
      </div>
    </>
  );
}

/** Ligne d'un heros : portrait, nom, un detail sous le nom, une valeur a droite. */
function LigneHeros({ slug, detail, children }: { slug: string; detail?: string; children?: React.ReactNode }) {
  const h = herosParSlug.get(slug);
  if (!h) return null;
  return (
    <Link
      href={`/heroes/${slug}`}
      className="bevel-sm group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2.5 transition-colors hover:border-gold-500/60"
    >
      <PortraitHeros source={h.images.icon ?? h.images.portrait} nom={h.name} taille="icone" decoratif />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
          {h.name}
        </span>
        {detail && <span className="block text-xs text-chalk-500">{detail}</span>}
      </span>
      {children}
    </Link>
  );
}

/** Hausses ou baisses : taux d'il y a sept jours et du jour, ecart en points. */
function Mouvements({
  titre,
  vide,
  mouvements,
  hausse,
  langue,
  t,
}: {
  titre: string;
  vide: string;
  mouvements: Mouvement[];
  hausse: boolean;
  langue: Langue;
  t: T;
}) {
  const Icone = hausse ? TrendingUp : TrendingDown;
  const pourcent = new Intl.NumberFormat(langue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div>
      <h3
        className={cn(
          "mb-3 flex items-center gap-2 font-heading text-lg font-bold",
          hausse ? "text-emerald-400" : "text-blood-500",
        )}
      >
        <Icone size={18} aria-hidden />
        {titre}
      </h3>
      {mouvements.length === 0 ? (
        <p className="text-sm text-chalk-500">{vide}</p>
      ) : (
        <ol className="space-y-2">
          {mouvements.map(({ slug, variation: v }) => (
            <li key={slug}>
              <LigneHeros
                slug={slug}
                detail={`${pourcent.format(v.avant)} → ${pourcent.format(v.actuel)} ${t("home.winPercent")}`}
              >
                <span
                  className={cn("shrink-0 font-semibold tabular-nums", hausse ? "text-emerald-400" : "text-blood-500")}
                >
                  <span aria-hidden>
                    {formaterEcart(v.ecart, langue)} {t("counters.pts")}
                  </span>
                  <span className="sr-only">{decrireEcart(t, langue, v.ecart, v.jours)}</span>
                </span>
              </LigneHeros>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Montees ou descentes de palier : ancien et nouveau palier. */
function Paliers({
  titre,
  vide,
  changements,
  hausse,
  t,
}: {
  titre: string;
  vide: string;
  changements: ChangementPalier[];
  hausse: boolean;
  t: T;
}) {
  const Icone = hausse ? TrendingUp : TrendingDown;
  return (
    <div>
      <h3
        className={cn(
          "mb-3 flex items-center gap-2 font-heading text-lg font-bold",
          hausse ? "text-emerald-400" : "text-blood-500",
        )}
      >
        <Icone size={18} aria-hidden />
        {titre}
      </h3>
      {changements.length === 0 ? (
        <p className="text-sm text-chalk-500">{vide}</p>
      ) : (
        <ol className="space-y-2">
          {changements.map((c) => (
            <li key={c.slug}>
              <LigneHeros slug={c.slug}>
                <span aria-hidden className="flex shrink-0 items-center gap-1.5">
                  <BadgePalier palier={c.avant} />
                  <span className="text-chalk-500">→</span>
                  <BadgePalier palier={c.apres} />
                </span>
                <span className="sr-only">{t("pages.meta.tiers.sr", { avant: c.avant, apres: c.apres })}</span>
              </LigneHeros>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Les premiers selon un taux (ban, selection), avec la valeur. */
function Classement({
  titre,
  entrees,
  valeur,
}: {
  titre: string;
  entrees: EntreeClassee[];
  valeur: (e: EntreeClassee) => string;
}) {
  return (
    <div>
      <h3 className="mb-3 font-heading text-lg font-bold text-chalk-100">{titre}</h3>
      <ol className="space-y-2">
        {entrees.map((e) => (
          <li key={e.hero.slug}>
            <LigneHeros slug={e.hero.slug}>
              <span className="shrink-0 font-semibold tabular-nums text-gold-400">{valeur(e)}</span>
            </LigneHeros>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Heros d'un patch, en pastilles : lien vers la fiche quand elle existe. */
function GroupeHeros({
  titre,
  liste,
  couleur,
}: {
  titre: string;
  liste: { slug: string; name: string }[];
  couleur: string;
}) {
  return (
    <div>
      <h3 className={cn("font-heading text-lg font-bold", couleur)}>
        {titre} <span className="text-sm font-medium text-chalk-500">{liste.length}</span>
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {liste.map((a) => {
          const h = herosParSlug.get(a.slug);
          const contenu = (
            <>
              <PortraitHeros
                source={h?.images.icon ?? h?.images.portrait ?? null}
                nom={h?.name ?? a.name}
                taille="micro"
                decoratif
              />
              <span className="font-medium text-chalk-100">{h?.name ?? a.name}</span>
            </>
          );
          const classes = "bevel-sm flex items-center gap-2 border border-night-700/70 bg-night-900/60 py-1 pl-1 pr-2.5 text-sm";
          return (
            <li key={a.slug}>
              {h ? (
                <Link href={`/heroes/${a.slug}`} className={cn(classes, "transition-colors hover:border-gold-500/60")}>
                  {contenu}
                </Link>
              ) : (
                <span className={classes}>{contenu}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
