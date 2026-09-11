import Link from "@/components/lien";
import { donneesLd } from "@/lib/html";
import Image from "next/image";
import { ArrowRight, Rss, Swords, TrendingDown, TrendingUp } from "lucide-react";
import { AccesRoles } from "@/components/acces-roles";
import { AccueilVedette } from "@/components/accueil-vedette";
import { PortraitHeros } from "@/components/portrait-heros";
import { BadgePalier, Carte, TitreSection } from "@/components/ui";
import {
  heros,
  herosAnalyses,
  herosParSlug,
  illustrations,
  nombreSkins,
  patchs,
  patchsDetail,
  synchro,
} from "@/lib/donnees";
import { tousLesArticles } from "@/lib/contenu";
import { tendancesDe } from "@/lib/evolution";
import { decrireEcart, formaterEcart, mouvementsSemaine, SEUIL_NOTABLE, type Mouvement } from "@/lib/tendances";
import { classementComplet } from "@/lib/tier-list";
import { site } from "@/lib/site";
import type { Role } from "@/lib/types";
import { cn, formaterDate } from "@/lib/utils";
import type { Langue } from "@/i18n/config";
import { LOCALE_HTML } from "@/i18n/config";
import { creerT, type T } from "@/i18n/traductions";

/** Donnees structurees de l'accueil, dans la langue de la page. */
const donneesAccueil = (locale: Langue) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#site`,
      url: site.url,
      name: site.nom,
      description: site.description,
      inLanguage: LOCALE_HTML[locale],
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${site.url}/${locale}/heroes?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${site.url}/#editeur`,
      name: site.nom,
      url: site.url,
      logo: `${site.url}/icon.svg`,
      sameAs: [site.depot],
    },
  ],
});

const detail = patchsDetail as unknown as Record<
  string,
  { version: string; sommaire: { titre: string }[] }
>;

/**
 * Heros mis en avant, choisi par le jour de l'annee.
 *
 * Un tirage aleatoire changerait le visuel a chaque rechargement — l'accueil
 * doit rester reconnaissable d'une visite a l'autre dans la journee.
 */
function herosDuJour() {
  const eligibles = heros.filter((h) => illustrations[h.slug]);
  if (eligibles.length === 0) return null;

  const jour = Math.floor(Date.now() / 86_400_000);
  const choisi = eligibles[jour % eligibles.length];
  return { heros: choisi, illustration: Object.values(illustrations[choisi.slug])[0] };
}

export default async function Accueil({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const vedette = herosDuJour();
  const articles = tousLesArticles(locale).slice(0, 3);
  const sommet = classementComplet.slice(0, 5);
  const semaine = mouvementsSemaine(heros.map((h) => ({ slug: h.slug, serie: tendancesDe(h.slug).all })));
  const dernierPatch = patchs.find((p) => detail[p.version]);

  const classe = vedette
    ? classementComplet.find((e) => e.heros.slug === vedette.heros.slug)
    : null;

  const parRole = Object.fromEntries(
    (["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"] as Role[]).map((r) => [
      r,
      heros.filter((h) => h.roles.includes(r)).length,
    ]),
  ) as Record<Role, number>;

  // Quelques skins recents, choisis pour leur illustration : l'accueil doit
  // montrer ce que le site contient, pas seulement l'annoncer.
  const skinsEnAvant = heros
    .filter((h) => illustrations[h.slug] && h.skins.length > 3)
    .slice(0, 6)
    .map((h) => {
      const entrees = Object.entries(illustrations[h.slug]);
      const [nom, image] = entrees[entrees.length - 1];
      return { slug: h.slug, heros: h.nom, skin: nom, image };
    });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesAccueil(locale)) }}
      />

      {/* ── Bandeau d'accroche ─────────────────────────────────────────── */}
      <section className="border-b border-nuit-700/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="font-titre text-sm font-semibold uppercase tracking-[0.2em] text-or-400">
            Mobile Legends: Bang Bang
          </p>
          <h1 className="mt-4 max-w-3xl font-titre text-4xl font-bold leading-tight text-craie-100 sm:text-6xl">
            {t("home.titre1")}{" "}
            <span className="bg-linear-to-r from-or-400 to-or-600 bg-clip-text text-transparent">
              {t("home.titreAccent")}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-craie-300">
            {t("home.lead", { heros: heros.length, skins: nombreSkins })}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/heroes"
              className="biseau-sm flex items-center gap-2 bg-or-500 px-6 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
            >
              {t("home.parcourir")}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/draft"
              className="biseau-sm flex items-center gap-2 border border-nuit-600 px-6 py-3 font-semibold text-craie-100 transition-colors hover:border-or-500/60 hover:text-or-400"
            >
              <Swords size={17} aria-hidden />
              {t("home.aideDraft")}
            </Link>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-6 border-t border-nuit-800 pt-8 sm:grid-cols-4">
            {[
              { valeur: heros.length, label: t("home.statHeros") },
              { valeur: nombreSkins, label: t("home.statSkins") },
              { valeur: patchs.length, label: t("home.statPatchs") },
              { valeur: herosAnalyses.length, label: t("home.statAnalyses") },
            ].map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-titre text-3xl font-bold text-or-400">
                    {s.valeur}
                  </span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-craie-500">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Heros du jour ──────────────────────────────────────────────── */}
      {vedette && (
        <AccueilVedette
          heros={vedette.heros}
          illustration={vedette.illustration}
          palier={classe?.palier ?? null}
          victoire={classe?.victoire ?? null}
          langue={locale}
        />
      )}

      {/* ── Entree par role ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <TitreSection chapeau={t("home.commencerChapeau")}>
          {t("home.commencerTitre")}
        </TitreSection>
        <AccesRoles compte={parRole} langue={locale} />
      </section>

      {/* ── Sommet du classement ───────────────────────────────────────── */}
      <section className="border-y border-nuit-700/70 bg-nuit-900/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection
            chapeau={t("home.classementChapeau")}
            action={{ href: "/tier-list", label: t("home.tierListComplete") }}
          >
            {t("home.classementTitre")}
          </TitreSection>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {sommet.map((e) => (
              <li key={e.heros.slug}>
                <Link
                  href={`/heroes/${e.heros.slug}`}
                  className="biseau flex h-full flex-col items-center gap-2 border border-nuit-700/70 bg-nuit-900/60 p-4 text-center transition-colors hover:border-or-500/60"
                >
                  <span className="biseau-sm relative size-16 overflow-hidden bg-nuit-800">
                    {e.heros.visuels.portrait && (
                      <Image
                        src={e.heros.visuels.portrait}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <BadgePalier palier={e.palier} />
                  <span className="font-titre font-bold text-craie-100">{e.heros.nom}</span>
                  <span className="text-xs text-craie-500">
                    {new Intl.NumberFormat(LOCALE_HTML[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(e.victoire)}{" "}
                    {t("home.pourcentVictoires")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Tendances de la semaine ────────────────────────────────────── */}
      {(semaine.hausses.length > 0 || semaine.baisses.length > 0) && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection
            chapeau={t("home.tendances.chapeau", {
              seuil: new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(SEUIL_NOTABLE),
            })}
            action={{ href: "/tier-list", label: t("home.tierListComplete") }}
          >
            {t("home.tendances.titre")}
          </TitreSection>
          <div className="grid gap-8 md:grid-cols-2">
            <ListeMouvements
              titre={t("home.tendances.hausse")}
              vide={t("home.tendances.aucuneHausse")}
              mouvements={semaine.hausses}
              hausse
              locale={locale}
              t={t}
            />
            <ListeMouvements
              titre={t("home.tendances.baisse")}
              vide={t("home.tendances.aucuneBaisse")}
              mouvements={semaine.baisses}
              hausse={false}
              locale={locale}
              t={t}
            />
          </div>
        </section>
      )}

      {/* ── Skins ──────────────────────────────────────────────────────── */}
      {skinsEnAvant.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection
            chapeau={t("home.skinsChapeau", { skins: nombreSkins })}
            action={{ href: "/heroes", label: t("home.voirHeros") }}
          >
            {t("home.skinsTitre")}
          </TitreSection>

          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {skinsEnAvant.map((s) => (
              <li key={`${s.slug}-${s.skin}`}>
                <Link
                  href={`/heroes/${s.slug}`}
                  className="biseau group relative block aspect-video overflow-hidden border border-nuit-700/70"
                >
                  <Image
                    src={s.image}
                    alt={`${s.heros} — ${s.skin}`}
                    fill
                    sizes="(min-width: 768px) 380px, 45vw"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-nuit-950 to-transparent p-3">
                    <span className="block font-titre text-sm font-bold text-craie-100">
                      {s.skin}
                    </span>
                    <span className="block text-xs text-craie-500">{s.heros}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Patch et articles ──────────────────────────────────────────── */}
      <section className="border-t border-nuit-700/70 bg-nuit-900/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_2fr]">
          {dernierPatch && (
            <div>
              <TitreSection chapeau="">{t("home.derniereMaj")}</TitreSection>
              <Carte>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-or-400">
                  <TrendingUp size={14} aria-hidden />
                  Patch {dernierPatch.version}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {detail[dernierPatch.version].sommaire.slice(0, 5).map((s) => (
                    <li key={s.titre} className="text-sm leading-snug text-craie-300">
                      {s.titre}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/patch-notes/${dernierPatch.version}`}
                  className="mt-5 inline-block text-sm font-semibold text-or-400 hover:text-or-500"
                >
                  {t("home.lireNotes")} →
                </Link>
              </Carte>
            </div>
          )}

          <div>
            <TitreSection
              chapeau=""
              action={{ href: "/news", label: t("home.toutesActualites") }}
            >
              {t("home.derniersArticles")}
            </TitreSection>
            <ul className="space-y-3">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/${a.categorie === "Patch" ? "patch-notes" : "news"}/${a.slug}`}
                    className="biseau block border border-nuit-700/70 bg-nuit-900/60 p-4 transition-colors hover:border-or-500/60"
                  >
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
                        {t(`articleCat.${a.categorie}`)}
                      </span>
                      <time dateTime={a.date} className="text-xs text-craie-500">
                        {formaterDate(a.date, LOCALE_HTML[locale])}
                      </time>
                    </span>
                    <span className="mt-1.5 block font-titre text-lg font-bold leading-snug text-craie-100">
                      {a.titre}
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-craie-500">
                      {a.chapeau}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Fonctionnement ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <TitreSection chapeau={t("home.synchroChapeau", { date: formaterDate(synchro.date, LOCALE_HTML[locale]) })}>
          {t("home.commentFonctionne")}
        </TitreSection>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              titre: t("home.cartes.donneesTitre"),
              texte:
                t("home.cartes.donneesTexte"),
            },
            {
              titre: t("home.cartes.classementTitre"),
              texte:
                t("home.cartes.classementTexte"),
            },
            {
              titre: t("home.cartes.ecritTitre"),
              texte:
                t("home.cartes.ecritTexte"),
            },
          ].map((c) => (
            <Carte key={c.titre}>
              <h3 className="font-titre text-lg font-bold text-craie-100">{c.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-craie-500">{c.texte}</p>
            </Carte>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm text-craie-500">
          <Rss size={15} aria-hidden className="text-or-400" />
          <Link href="/feed.xml" className="hover:text-or-400">
            {t("home.suivreRss")}
          </Link>
        </p>
      </section>
    </>
  );
}

/**
 * Hausses ou baisses de la semaine : portrait, taux actuel et ecart en points.
 * La fleche et la couleur doublent le signe ; les lecteurs d'ecran entendent
 * l'ecart en toutes lettres.
 */
function ListeMouvements({
  titre,
  vide,
  mouvements,
  hausse,
  locale,
  t,
}: {
  titre: string;
  vide: string;
  mouvements: Mouvement[];
  hausse: boolean;
  locale: Langue;
  t: T;
}) {
  const Icone = hausse ? TrendingUp : TrendingDown;
  const pourcent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div>
      <h3
        className={cn(
          "mb-3 flex items-center gap-2 font-titre text-lg font-bold",
          hausse ? "text-emerald-400" : "text-sang-500",
        )}
      >
        <Icone size={18} aria-hidden />
        {titre}
      </h3>
      {mouvements.length === 0 ? (
        <p className="text-sm text-craie-500">{vide}</p>
      ) : (
        <ol className="space-y-2">
          {mouvements.map(({ slug, variation: v }) => {
            const h = herosParSlug.get(slug);
            if (!h) return null;
            return (
              <li key={slug}>
                <Link
                  href={`/heroes/${slug}`}
                  className="biseau-sm group flex items-center gap-3 border border-nuit-700/70 bg-nuit-900/60 p-2.5 transition-colors hover:border-or-500/60"
                >
                  <PortraitHeros source={h.visuels.icone ?? h.visuels.portrait} nom={h.nom} taille="icone" decoratif />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-titre font-bold text-craie-100 transition-colors group-hover:text-or-400">
                      {h.nom}
                    </span>
                    <span className="block text-xs text-craie-500">
                      {pourcent.format(v.actuel)} {t("home.pourcentVictoires")}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 font-semibold tabular-nums",
                      hausse ? "text-emerald-400" : "text-sang-500",
                    )}
                  >
                    <Icone size={15} aria-hidden />
                    <span aria-hidden>
                      {formaterEcart(v.ecart, locale)} {t("contres.pts")}
                    </span>
                    <span className="sr-only">{decrireEcart(t, locale, v.ecart, v.jours)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
