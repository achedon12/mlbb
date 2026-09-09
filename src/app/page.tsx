import Link from "next/link";
import { ArrowRight, BookOpen, Rss, Users } from "lucide-react";
import { CarteHeros } from "@/components/carte-heros";
import { BadgePalier, Carte, TitreSection } from "@/components/ui";
import { herosDetails } from "@/data/heros";
import { roster, rosterParSlug } from "@/data/roster";
import { tierList } from "@/data/tier-list";
import { tousLesArticles } from "@/lib/contenu";
import { site } from "@/lib/site";
import { formaterDate } from "@/lib/utils";

/**
 * Accueil.
 *
 * Les donnees structurees decrivent le site lui-meme et exposent la recherche
 * interne : c'est ce que Google attend pour afficher une boite de recherche
 * dans les resultats.
 */
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
        target: { "@type": "EntryPoint", urlTemplate: `${site.url}/heros?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${site.url}/#editeur`,
      name: site.nom,
      url: site.url,
      sameAs: [site.depot],
    },
  ],
};

export default function Accueil() {
  const articles = tousLesArticles().slice(0, 3);
  const misEnAvant = ["khufra", "melissa", "yu-zhong", "kagura"]
    .map((s) => rosterParSlug.get(s))
    .filter((h): h is NonNullable<typeof h> => Boolean(h));
  const hautPalier = tierList.entrees.filter((e) => e.palier === "S+" || e.palier === "S");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />

      {/* ── Bandeau ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-nuit-700/70">
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(115deg, transparent 40%, rgba(224,169,46,0.07) 50%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
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
            {roster.length} heros, des builds argumentes, une tier list qui
            justifie chaque placement, les objets, les emblemes et les patch
            notes. Sans liste sans contexte, ni classement sans explication.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/heros"
              className="biseau-sm flex items-center gap-2 bg-or-500 px-6 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
            >
              Parcourir les heros
              <ArrowRight size={18} aria-hidden />
            </Link>
            <Link
              href="/tier-list"
              className="biseau-sm border border-nuit-600 px-6 py-3 font-semibold text-craie-100 transition-colors hover:border-or-500/60 hover:text-or-400"
            >
              Voir la tier list
            </Link>
          </div>

          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-6 border-t border-nuit-800 pt-8">
            {[
              { valeur: roster.length, label: "heros repertories" },
              { valeur: herosDetails.length, label: "fiches completes" },
              { valeur: tierList.patch, label: "patch couvert" },
            ].map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-titre text-3xl font-bold text-or-400">{s.valeur}</span>
                  <span className="mt-1 block text-xs uppercase tracking-wide text-craie-500">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Heros mis en avant ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <TitreSection
          chapeau="Les heros qui pesent le plus sur le patch courant, avec leur fiche complete."
          action={{ href: "/heros", label: "Tous les heros" }}
        >
          A connaitre en ce moment
        </TitreSection>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {misEnAvant.map((h) => (
            <CarteHeros key={h.slug} heros={h} />
          ))}
        </div>
      </section>

      {/* ── Tier list ──────────────────────────────────────────────────── */}
      <section className="border-y border-nuit-700/70 bg-nuit-900/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <TitreSection
            chapeau={`Haut de la tier list du patch ${tierList.patch}. Chaque placement est argumente.`}
            action={{ href: "/tier-list", label: "Tier list complete" }}
          >
            Le meilleur du patch
          </TitreSection>
          <ul className="grid gap-3 md:grid-cols-2">
            {hautPalier.map((e) => {
              const h = rosterParSlug.get(e.heros);
              return (
                <li key={e.heros}>
                  <Link
                    href={`/heros/${e.heros}`}
                    className="biseau flex items-start gap-4 border border-nuit-700/70 bg-nuit-900/60 p-4 transition-colors hover:border-or-500/60"
                  >
                    <BadgePalier palier={e.palier} />
                    <div className="min-w-0">
                      <p className="font-titre font-bold text-craie-100">
                        {h?.nom ?? e.heros}
                        <span className="ml-2 text-xs font-medium uppercase tracking-wide text-craie-500">
                          {e.lane}
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-craie-500">{e.note}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Actualites ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <TitreSection
          chapeau="Analyses de patch, guides de fond et lecture du meta."
          action={{ href: "/actualites", label: "Toutes les actualites" }}
        >
          Derniers articles
        </TitreSection>
        <div className="grid gap-4 md:grid-cols-3">
          {articles.map((a) => (
            <Link
              key={a.slug}
              href={`/${a.categorie === "Patch" ? "patch-notes" : "actualites"}/${a.slug}`}
              className="biseau flex flex-col border border-nuit-700/70 bg-nuit-900/60 p-5 transition-colors hover:border-or-500/60"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-or-400">
                {a.categorie}
              </span>
              <h3 className="mt-2 font-titre text-lg font-bold leading-snug text-craie-100">
                {a.titre}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-craie-500">{a.chapeau}</p>
              <time dateTime={a.date} className="mt-4 text-xs text-craie-500">
                {formaterDate(a.date)}
              </time>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Ce que fait le site ────────────────────────────────────────── */}
      <section className="border-t border-nuit-700/70 bg-nuit-900/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <TitreSection chapeau="Un projet ouvert, sans compte obligatoire ni collecte inutile.">
            Comment ce site fonctionne
          </TitreSection>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icone: BookOpen,
                titre: "Des fiches argumentees",
                texte:
                  "Une fiche n'est publiee que si ses competences et ses contres ont ete verifies. Un heros sans fiche est signale comme tel, plutot que rempli de donnees approximatives.",
              },
              {
                icone: Users,
                titre: "Un compte facultatif",
                texte:
                  "Le site fonctionne entierement sans compte. En creer un sert uniquement a garder ses heros favoris et a lier un identifiant de jeu verifie.",
              },
              {
                icone: Rss,
                titre: "Un flux a suivre",
                texte:
                  "Toutes les publications sont disponibles en RSS, sans inscription et sans pistage. Le flux contient le resume complet de chaque article.",
              },
            ].map((c) => (
              <Carte key={c.titre}>
                <c.icone size={22} className="text-or-400" aria-hidden />
                <h3 className="mt-4 font-titre text-lg font-bold text-craie-100">{c.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-craie-500">{c.texte}</p>
              </Carte>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
