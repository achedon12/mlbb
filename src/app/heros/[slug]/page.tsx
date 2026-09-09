import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert, Swords, TriangleAlert } from "lucide-react";
import { BoutonFavori } from "@/components/bouton-favori";
import { BadgeRole, Carte, Difficulte } from "@/components/ui";
import { detailParSlug } from "@/data/heros";
import { roster, rosterParSlug } from "@/data/roster";
import { tierList } from "@/data/tier-list";
import { site } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

/** Une page par heros du roster, generee au build. */
export function generateStaticParams() {
  return roster.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const base = rosterParSlug.get(slug);
  if (!base) return {};

  const detail = detailParSlug.get(slug);
  const description =
    detail?.resume ??
    `${base.nom}, ${base.roles.join(" et ")} de Mobile Legends: Bang Bang. Position ${base.lanes.join(", ")}, difficulte ${base.difficulte} sur 10.`;

  return {
    title: detail ? `${base.nom} — ${detail.titre}` : base.nom,
    description,
    alternates: { canonical: `/heros/${slug}` },
    openGraph: {
      type: "article",
      title: `${base.nom} — ${site.nom}`,
      description,
      url: `/heros/${slug}`,
    },
  };
}

export default async function PageHeros({ params }: Params) {
  const { slug } = await params;
  const base = rosterParSlug.get(slug);
  if (!base) notFound();

  const detail = detailParSlug.get(slug);
  const palier = tierList.entrees.find((e) => e.heros === slug);

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: detail ? `${base.nom} — ${detail.titre}` : base.nom,
    description: detail?.resume,
    inLanguage: "fr-FR",
    author: { "@type": "Person", name: site.auteur },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/heros/${slug}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />

      {/* ── En-tete ────────────────────────────────────────────────────── */}
      <div className="border-b border-nuit-700/70 bg-nuit-900/30">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <Link
            href="/heros"
            className="inline-flex items-center gap-1.5 text-sm text-craie-500 transition-colors hover:text-or-400"
          >
            <ArrowLeft size={15} aria-hidden />
            Tous les heros
          </Link>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="font-titre text-4xl font-bold text-craie-100">{base.nom}</h1>
              {detail && <p className="mt-1 text-lg text-or-400">{detail.titre}</p>}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {base.roles.map((r) => (
                  <BadgeRole key={r} role={r} />
                ))}
              </div>
              <div className="mt-5">
                <BoutonFavori heros={base.slug} />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Position</dt>
                <dd className="mt-1 text-craie-100">{base.lanes.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Sortie</dt>
                <dd className="mt-1 text-craie-100">{base.sortie}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Difficulte</dt>
                <dd className="mt-1.5"><Difficulte valeur={base.difficulte} /></dd>
              </div>
              {palier && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-craie-500">Tier list</dt>
                  <dd className="mt-1 font-titre font-bold text-or-400">
                    Palier {palier.palier}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-wide text-craie-500">Specialites</dt>
                <dd className="mt-1 text-craie-100">{base.specialites.join(", ")}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-14">
        {detail ? (
          <div className="space-y-16">
            {/* ── Analyse ──────────────────────────────────────────────── */}
            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Analyse</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-5 space-y-4 leading-relaxed text-craie-300">
                {detail.analyse.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            {/* ── Competences ──────────────────────────────────────────── */}
            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Competences</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-6 space-y-3">
                {detail.competences.map((c) => (
                  <Carte key={c.type}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="biseau-sm bg-nuit-700 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-or-400">
                        {c.type}
                      </span>
                      <h3 className="font-titre text-lg font-bold text-craie-100">{c.nom}</h3>
                    </div>
                    <p className="mt-3 leading-relaxed text-craie-300">{c.description}</p>
                    {(c.recharge || c.cout) && (
                      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-nuit-800 pt-3 text-sm">
                        {c.recharge && (
                          <div className="flex gap-2">
                            <dt className="text-craie-500">Recharge</dt>
                            <dd className="text-craie-100">{c.recharge.join(" / ")} s</dd>
                          </div>
                        )}
                        {c.cout && (
                          <div className="flex gap-2">
                            <dt className="text-craie-500">Cout</dt>
                            <dd className="text-craie-100">{c.cout.join(" / ")}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </Carte>
                ))}
              </div>
            </section>

            {/* ── Forces et faiblesses ─────────────────────────────────── */}
            <section className="grid gap-4 md:grid-cols-2">
              <Carte className="border-emerald-500/25">
                <h2 className="flex items-center gap-2 font-titre text-lg font-bold text-emerald-400">
                  <Swords size={18} aria-hidden />
                  Forces
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {detail.forces.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-craie-300">
                      <span aria-hidden className="mt-2 size-1 shrink-0 bg-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Carte>
              <Carte className="border-sang-500/25">
                <h2 className="flex items-center gap-2 font-titre text-lg font-bold text-sang-500">
                  <TriangleAlert size={18} aria-hidden />
                  Faiblesses
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {detail.faiblesses.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-craie-300">
                      <span aria-hidden className="mt-2 size-1 shrink-0 bg-sang-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Carte>
            </section>

            {/* ── Contres ──────────────────────────────────────────────── */}
            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Contres</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ListeContres titre={`${base.nom} est a l'aise contre`} slugs={detail.fortContre} ton="bon" />
                <ListeContres titre={`${base.nom} est en difficulte contre`} slugs={detail.faibleContre} ton="mauvais" />
              </div>
            </section>

            {/* ── Builds ───────────────────────────────────────────────── */}
            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Builds</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-6 space-y-4">
                {detail.builds.map((b) => (
                  <Carte key={b.nom}>
                    <h3 className="font-titre text-lg font-bold text-or-400">{b.nom}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-craie-500">{b.contexte}</p>
                    <ol className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {b.objets.map((o, i) => (
                        <li
                          key={o}
                          className="biseau-sm border border-nuit-700 bg-nuit-850 p-2.5 text-center text-xs leading-tight text-craie-300"
                        >
                          <span className="block font-titre text-sm font-bold text-or-500">{i + 1}</span>
                          {o}
                        </li>
                      ))}
                    </ol>
                    <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-nuit-800 pt-4 text-sm">
                      <div className="flex gap-2">
                        <dt className="text-craie-500">Embleme</dt>
                        <dd className="text-craie-100">{b.embleme}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-craie-500">Talent</dt>
                        <dd className="text-craie-100">{b.talent}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-craie-500">Sort</dt>
                        <dd className="text-craie-100">{b.sort}</dd>
                      </div>
                    </dl>
                  </Carte>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* Pas de fiche : on le dit, plutot que d'afficher du vide ou du faux. */
          <Carte className="border-or-500/30">
            <h2 className="flex items-center gap-2 font-titre text-xl font-bold text-or-400">
              <ShieldAlert size={20} aria-hidden />
              Fiche en cours de redaction
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-craie-300">
              {base.nom} est repertorie avec ses attributs verifies, mais son
              analyse detaillee — competences, builds et contres — n&apos;a pas
              encore ete redigee. Le parti pris du site est de ne rien publier
              qui n&apos;ait ete verifie en jeu.
            </p>
            <a
              href={`${site.depot}/blob/main/CONTRIBUTING.md`}
              rel="noreferrer"
              className="mt-5 inline-block text-sm font-semibold text-or-400 underline underline-offset-4 hover:text-or-500"
            >
              Contribuer a cette fiche →
            </a>
          </Carte>
        )}
      </div>
    </>
  );
}

function ListeContres({
  titre,
  slugs,
  ton,
}: {
  titre: string;
  slugs: string[];
  ton: "bon" | "mauvais";
}) {
  return (
    <Carte>
      <h3 className="text-sm font-semibold text-craie-100">{titre}</h3>
      <ul className="mt-4 flex flex-wrap gap-2">
        {slugs.map((s) => {
          const cible = rosterParSlug.get(s);
          return (
            <li key={s}>
              <Link
                href={`/heros/${s}`}
                className={`biseau-sm border px-2.5 py-1 text-sm transition-colors ${
                  ton === "bon"
                    ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    : "border-sang-500/30 text-sang-500 hover:bg-sang-500/10"
                }`}
              >
                {cible?.nom ?? s}
              </Link>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
