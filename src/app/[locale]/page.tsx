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
import { LOCALE_HTML, estLangue } from "@/i18n/config";
import { notFound } from "next/navigation";
import { BASE } from "@/lib/rubriques";
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
  { version: string; toc: { title: string }[] }
>;

/**
 * Heros mis en avant, choisi par le jour de l'annee.
 *
 * Un tirage aleatoire changerait le visuel a chaque rechargement — l'accueil
 * doit rester reconnaissable d'une visite a l'autre dans la journee.
 */
/** Outils interactifs du menu, repris en grille sur l'accueil. */
const OUTILS = BASE.filter((e) => e.href.startsWith("/tools/") || ["/draft", "/compare", "/quiz", "/mlbbdle"].includes(e.href));

function herosDuJour() {
  const eligibles = heros.filter((h) => illustrations[h.slug]);
  if (eligibles.length === 0) return null;

  const jour = Math.floor(Date.now() / 86_400_000);
  const choisi = eligibles[jour % eligibles.length];
  return { heros: choisi, illustration: Object.values(illustrations[choisi.slug])[0] };
}

export default async function Accueil({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  // /inexistant.txt arrive ici avec « inexistant.txt » pour langue : la page
  // se rend en meme temps que la mise en page, et ses nombres formates dans
  // cette langue invalide la faisaient echouer en 500 avant la 404.
  if (!estLangue(locale)) notFound();
  const t = creerT(locale);
  const vedette = herosDuJour();
  const articles = tousLesArticles(locale).slice(0, 3);
  const sommet = classementComplet.slice(0, 5);
  const semaine = mouvementsSemaine(heros.map((h) => ({ slug: h.slug, serie: tendancesDe(h.slug).all })));
  const dernierPatch = patchs.find((p) => detail[p.version]);

  const classe = vedette
    ? classementComplet.find((e) => e.hero.slug === vedette.heros.slug)
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
      return { slug: h.slug, heros: h.name, skin: nom, image };
    });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesAccueil(locale)) }}
      />

      {/* ── Bandeau d'accroche ─────────────────────────────────────────── */}
      <section className="border-b border-night-700/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
            Mobile Legends: Bang Bang
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-bold leading-tight text-chalk-100 sm:text-6xl">
            {t("home.title1")}{" "}
            <span className="bg-linear-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent">
              {t("home.titleAccent")}
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk-300">
            {t("home.lead", { heros: heros.length, skins: nombreSkins })}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/heroes"
              className="bevel-sm flex items-center gap-2 bg-gold-500 px-6 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400"
            >
              {t("home.browse")}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/draft"
              className="bevel-sm flex items-center gap-2 border border-night-600 px-6 py-3 font-semibold text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400"
            >
              <Swords size={17} aria-hidden />
              {t("home.draftHelp")}
            </Link>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-6 border-t border-night-800 pt-8 sm:grid-cols-4">
            {[
              { valeur: heros.length, label: t("home.statHeroes") },
              { valeur: nombreSkins, label: t("home.statSkins") },
              { valeur: patchs.length, label: t("home.statPatches") },
              { valeur: herosAnalyses.length, label: t("home.statAnalyses") },
            ].map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-heading text-3xl font-bold text-gold-400">
                    {s.valeur}
                  </span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-chalk-500">
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
          palier={classe?.tier ?? null}
          victoire={classe?.winRate ?? null}
          langue={locale}
        />
      )}

      {/* ── Entree par role ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <TitreSection chapeau={t("home.startLead")}>
          {t("home.startTitle")}
        </TitreSection>
        <AccesRoles compte={parRole} langue={locale} />
      </section>

      {/* ── Outils ─────────────────────────────────────────────────────── */}
      {/*
        Tires du menu : un outil ajoute aux rubriques apparait ici sans autre
        changement.
      */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <TitreSection chapeau={t("home.toolsLead")}>{t("home.toolsTitle")}</TitreSection>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OUTILS.map(({ href, cle, icone: Icone }) => (
            <li key={href}>
              <Link
                href={href}
                className="bevel group flex h-full items-start gap-3 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
              >
                <Icone size={20} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
                <span className="min-w-0">
                  <span className="block font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                    {t(`nav.${cle}.label`)}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-chalk-500">{t(`nav.${cle}.desc`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Sommet du classement ───────────────────────────────────────── */}
      <section className="border-y border-night-700/70 bg-night-900/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection
            chapeau={t("home.rankingLead")}
            action={{ href: "/tier-list", label: t("home.fullTierList") }}
          >
            {t("home.rankingTitle")}
          </TitreSection>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {sommet.map((e) => (
              <li key={e.hero.slug}>
                <Link
                  href={`/heroes/${e.hero.slug}`}
                  className="bevel flex h-full flex-col items-center gap-2 border border-night-700/70 bg-night-900/60 p-4 text-center transition-colors hover:border-gold-500/60"
                >
                  <span className="bevel-sm relative size-16 overflow-hidden bg-night-800">
                    {e.hero.images.portrait && (
                      <Image
                        src={e.hero.images.portrait}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <BadgePalier palier={e.tier} />
                  <span className="font-heading font-bold text-chalk-100">{e.hero.name}</span>
                  <span className="text-xs text-chalk-500">
                    {new Intl.NumberFormat(LOCALE_HTML[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(e.winRate)}{" "}
                    {t("home.winPercent")}
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
            chapeau={t("home.trends.lead", {
              seuil: new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(SEUIL_NOTABLE),
            })}
            action={{ href: "/tier-list", label: t("home.fullTierList") }}
          >
            {t("home.trends.title")}
          </TitreSection>
          <div className="grid gap-8 md:grid-cols-2">
            <ListeMouvements
              titre={t("home.trends.rise")}
              vide={t("home.trends.noRise")}
              mouvements={semaine.hausses}
              hausse
              locale={locale}
              t={t}
            />
            <ListeMouvements
              titre={t("home.trends.fall")}
              vide={t("home.trends.noFall")}
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
            chapeau={t("home.skinsLead", { skins: nombreSkins })}
            action={{ href: "/heroes", label: t("home.seeHeroes") }}
          >
            {t("home.skinsTitle")}
          </TitreSection>

          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {skinsEnAvant.map((s) => (
              <li key={`${s.slug}-${s.skin}`}>
                <Link
                  href={`/heroes/${s.slug}`}
                  className="bevel group relative block aspect-video overflow-hidden border border-night-700/70"
                >
                  <Image
                    src={s.image}
                    alt={`${s.heros} — ${s.skin}`}
                    fill
                    sizes="(min-width: 768px) 380px, 45vw"
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-night-950 to-transparent p-3">
                    <span className="block font-heading text-sm font-bold text-chalk-100">
                      {s.skin}
                    </span>
                    <span className="block text-xs text-chalk-500">{s.heros}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Patch et articles ──────────────────────────────────────────── */}
      <section className="border-t border-night-700/70 bg-night-900/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_2fr]">
          {dernierPatch && (
            <div>
              <TitreSection chapeau="">{t("home.lastUpdate")}</TitreSection>
              <Carte>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gold-400">
                  <TrendingUp size={14} aria-hidden />
                  Patch {dernierPatch.version}
                </p>
                <ul className="mt-4 space-y-1.5">
                  {detail[dernierPatch.version].toc.slice(0, 5).map((s) => (
                    <li key={s.title} className="text-sm leading-snug text-chalk-300">
                      {s.title}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/patch-notes/${dernierPatch.version}`}
                  className="mt-5 inline-block text-sm font-semibold text-gold-400 hover:text-gold-500"
                >
                  {t("home.readNotes")} →
                </Link>
              </Carte>
            </div>
          )}

          <div>
            <TitreSection
              chapeau=""
              action={{ href: "/news", label: t("home.allNews") }}
            >
              {t("home.latestArticles")}
            </TitreSection>
            <ul className="space-y-3">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/${a.category === "Patch" ? "patch-notes" : "news"}/${a.slug}`}
                    className="bevel block border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                  >
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold-400">
                        {t(`articleCategory.${a.category}`)}
                      </span>
                      <time dateTime={a.date} className="text-xs text-chalk-500">
                        {formaterDate(a.date, LOCALE_HTML[locale])}
                      </time>
                    </span>
                    <span className="mt-1.5 block font-heading text-lg font-bold leading-snug text-chalk-100">
                      {a.title}
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-chalk-500">
                      {a.summary}
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
        <TitreSection chapeau={t("home.syncLead", { date: formaterDate(synchro.date, LOCALE_HTML[locale]) })}>
          {t("home.howItWorks")}
        </TitreSection>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              titre: t("home.cards.dataTitle"),
              texte:
                t("home.cards.dataText"),
            },
            {
              titre: t("home.cards.rankingTitle"),
              texte:
                t("home.cards.rankingText"),
            },
            {
              titre: t("home.cards.writtenTitle"),
              texte:
                t("home.cards.writtenText"),
            },
          ].map((c) => (
            <Carte key={c.titre}>
              <h3 className="font-heading text-lg font-bold text-chalk-100">{c.titre}</h3>
              <p className="mt-2 text-sm leading-relaxed text-chalk-500">{c.texte}</p>
            </Carte>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm text-chalk-500">
          <Rss size={15} aria-hidden className="text-gold-400" />
          <Link href="/feed.xml" className="hover:text-gold-400">
            {t("home.followRss")}
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
          {mouvements.map(({ slug, variation: v }) => {
            const h = herosParSlug.get(slug);
            if (!h) return null;
            return (
              <li key={slug}>
                <Link
                  href={`/heroes/${slug}`}
                  className="bevel-sm group flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2.5 transition-colors hover:border-gold-500/60"
                >
                  <PortraitHeros source={h.images.icon ?? h.images.portrait} nom={h.name} taille="icone" decoratif />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
                      {h.name}
                    </span>
                    <span className="block text-xs text-chalk-500">
                      {pourcent.format(v.actuel)} {t("home.winPercent")}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 font-semibold tabular-nums",
                      hausse ? "text-emerald-400" : "text-blood-500",
                    )}
                  >
                    <Icone size={15} aria-hidden />
                    <span aria-hidden>
                      {formaterEcart(v.ecart, locale)} {t("counters.pts")}
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
