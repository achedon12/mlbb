import Link from "next/link";
import { donneesLd } from "@/lib/html";
import Image from "next/image";
import { ArrowRight, Rss, Swords, TrendingUp } from "lucide-react";
import { AccesRoles } from "@/components/acces-roles";
import { AccueilVedette } from "@/components/accueil-vedette";
import { BadgePalier, Carte, TitreSection } from "@/components/ui";
import { heros, herosAnalyses, illustrations, nombreSkins, patchs, patchsDetail, synchro } from "@/lib/donnees";
import { tousLesArticles } from "@/lib/contenu";
import { classementComplet } from "@/lib/tier-list";
import { site } from "@/lib/site";
import type { Role } from "@/lib/types";
import { formaterDate } from "@/lib/utils";

const donneesStructurees = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#site`,
      url: site.url,
      name: site.nom,
      description: site.description,
      inLanguage: "fr-FR",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${site.url}/heroes?q={search_term_string}` },
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
};

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

export default function Accueil() {
  const vedette = herosDuJour();
  const articles = tousLesArticles().slice(0, 3);
  const sommet = classementComplet.slice(0, 5);
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
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />

      {/* ── Bandeau d'accroche ─────────────────────────────────────────── */}
      <section className="border-b border-nuit-700/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="font-titre text-sm font-semibold uppercase tracking-[0.2em] text-or-400">
            Mobile Legends: Bang Bang
          </p>
          <h1 className="mt-4 max-w-3xl font-titre text-4xl font-bold leading-tight text-craie-100 sm:text-6xl">
            Tout le jeu, explique{" "}
            <span className="bg-linear-to-r from-or-400 to-or-600 bg-clip-text text-transparent">
              en francais
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-craie-300">
            {heros.length} heros et leurs {nombreSkins} skins, une tier list
            calculee sur les taux du jeu, une aide au draft, les objets, les
            emblemes et les patch notes. Les donnees se synchronisent seules ;
            l&apos;analyse s&apos;ecrit a la main.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/heroes"
              className="biseau-sm flex items-center gap-2 bg-or-500 px-6 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
            >
              Parcourir les heros
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/draft"
              className="biseau-sm flex items-center gap-2 border border-nuit-600 px-6 py-3 font-semibold text-craie-100 transition-colors hover:border-or-500/60 hover:text-or-400"
            >
              <Swords size={17} aria-hidden />
              Aide au draft
            </Link>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-6 border-t border-nuit-800 pt-8 sm:grid-cols-4">
            {[
              { valeur: heros.length, label: "heros" },
              { valeur: nombreSkins, label: "skins" },
              { valeur: patchs.length, label: "patchs" },
              { valeur: herosAnalyses.length, label: "analyses redigees" },
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
        />
      )}

      {/* ── Entree par role ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <TitreSection chapeau="Vous jouez un role, pas un catalogue. Entrez par la.">
          Par ou commencer
        </TitreSection>
        <AccesRoles compte={parRole} />
      </section>

      {/* ── Sommet du classement ───────────────────────────────────────── */}
      <section className="border-y border-nuit-700/70 bg-nuit-900/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection
            chapeau="Calcule a partir des taux de victoire et de ban remontes par le jeu, pas d'une opinion."
            action={{ href: "/tier-list", label: "Tier list complete" }}
          >
            En tete du patch
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
                    {e.victoire.toFixed(1)} % de victoires
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Skins ──────────────────────────────────────────────────────── */}
      {skinsEnAvant.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <TitreSection
            chapeau={`Les ${nombreSkins} skins du jeu, avec leur illustration pleine taille, leur rarete et leur prix.`}
            action={{ href: "/heroes", label: "Voir les heros" }}
          >
            Galeries de skins
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
              <TitreSection chapeau="">Derniere mise a jour</TitreSection>
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
                  Lire les notes →
                </Link>
              </Carte>
            </div>
          )}

          <div>
            <TitreSection
              chapeau=""
              action={{ href: "/news", label: "Toutes les actualites" }}
            >
              Derniers articles
            </TitreSection>
            <ul className="space-y-3">
              {articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/${a.categorie === "Patch" ? "patch-notes" : "actualites"}/${a.slug}`}
                    className="biseau block border border-nuit-700/70 bg-nuit-900/60 p-4 transition-colors hover:border-or-500/60"
                  >
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
                        {a.categorie}
                      </span>
                      <time dateTime={a.date} className="text-xs text-craie-500">
                        {formaterDate(a.date)}
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
        <TitreSection chapeau={`Derniere synchronisation le ${formaterDate(synchro.date)}.`}>
          Comment ce site fonctionne
        </TitreSection>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              titre: "Les donnees se mettent a jour seules",
              texte:
                "Heros, skins, objets, patchs et visuels sont extraits du wiki chaque semaine. Un nouveau heros apparait ici sans que personne le saisisse.",
            },
            {
              titre: "Le classement ne donne pas d'avis",
              texte:
                "La tier list est calculee sur les taux de victoire et de ban remontes par le jeu. La regle du calcul est affichee sur la page.",
            },
            {
              titre: "Ce qui s'ecrit reste ecrit",
              texte:
                "Analyses, builds et guides sont rediges a la main. Aucune extraction ne dira pourquoi un heros est fort ; c'est la que les contributions comptent.",
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
            Suivre les publications en RSS
          </Link>
        </p>
      </section>
    </>
  );
}
