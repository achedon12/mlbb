import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert, Swords, TriangleAlert } from "lucide-react";
import { BoutonFavori } from "@/components/bouton-favori";
import { GalerieSkins } from "@/components/galerie-skins";
import { PortraitHeros } from "@/components/portrait-heros";
import { BadgeRole, Carte, Jauge } from "@/components/ui";
import { heros, herosParSlug } from "@/lib/donnees";
import { raretesPresentes } from "@/lib/raretes";
import { classementComplet } from "@/lib/tier-list";
import { site } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

/** Une page par heros, generee au build. */
export function generateStaticParams() {
  return heros.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) return {};

  const description =
    h.analyse?.resume ??
    `${h.nom}${h.titre ? `, ${h.titre}` : ""} : ${h.roles.join(" et ")} de Mobile Legends: Bang Bang. Position ${h.lanes.join(", ") || "variable"}, ${h.skins.length} skins.`;

  return {
    title: h.titre ? `${h.nom} — ${h.titre}` : h.nom,
    description,
    alternates: { canonical: `/heros/${slug}` },
    openGraph: {
      type: "article",
      title: `${h.nom} — ${site.nom}`,
      description,
      url: `/heros/${slug}`,
      images: h.visuels.portrait ? [{ url: h.visuels.portrait }] : undefined,
    },
  };
}

export default async function PageHeros({ params }: Params) {
  const { slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) notFound();

  const classe = classementComplet.find((e) => e.heros.slug === slug);
  const analyse = h.analyse;

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h.titre ? `${h.nom} — ${h.titre}` : h.nom,
    description: analyse?.resume,
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
        <div className="relative mx-auto max-w-5xl px-4 py-10">
          <Link
            href="/heros"
            className="inline-flex items-center gap-1.5 text-sm text-craie-500 transition-colors hover:text-or-400"
          >
            <ArrowLeft size={15} aria-hidden />
            Tous les heros
          </Link>

          <div className="mt-6 flex flex-wrap items-start gap-6">
            <PortraitHeros
              source={h.visuels.portrait}
              nom={h.nom}
              taille="fiche"
              priorite
            />

            <div className="min-w-0 flex-1 basis-64">
              <h1 className="font-titre text-4xl font-bold text-craie-100">{h.nom}</h1>
              {h.titre && <p className="mt-1 text-lg text-or-400">{h.titre}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {h.roles.map((r) => (
                  <BadgeRole key={r} role={r} />
                ))}
                {h.specialites.map((s) => (
                  <span
                    key={s}
                    className="biseau-sm border border-nuit-600 px-2 py-0.5 text-[0.7rem] uppercase tracking-wide text-craie-500"
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-5">
                <BoutonFavori heros={h.slug} />
              </div>
            </div>

            {/* Notes du jeu, en jauges plutot qu'en chiffres nus. */}
            <dl className="grid min-w-0 flex-1 basis-56 gap-2.5">
              {[
                ["Offensive", h.notes.offensive],
                ["Resistance", h.notes.resistance],
                ["Effets", h.notes.effets],
                ["Difficulte", h.notes.difficulte],
              ].map(([label, valeur]) =>
                valeur === null ? null : (
                  <div key={String(label)} className="flex items-center gap-3">
                    <dt className="w-24 shrink-0 text-xs uppercase tracking-wide text-craie-500">
                      {label}
                    </dt>
                    <dd className="flex-1">
                      <Jauge valeur={Number(valeur)} />
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </div>

          {/* ── Faits ────────────────────────────────────────────────── */}
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-nuit-800 pt-6 text-sm sm:grid-cols-4 lg:grid-cols-6">
            {[
              ["Position", h.lanes.join(", ")],
              ["Sortie", h.sortie],
              ["Ressource", h.ressource],
              ["Degats", h.typeDegats],
              ["Portee", h.typeAttaque],
              ["Region", h.region],
              ["Skins", h.skins.length || null],
              ["Tier list", classe ? `Palier ${classe.palier}` : null],
              ["Taux de victoire", classe ? `${classe.victoire.toFixed(1)} %` : null],
              ["Taux de ban", classe ? `${classe.ban.toFixed(1)} %` : null],
            ].map(([label, valeur]) =>
              !valeur ? null : (
                <div key={String(label)}>
                  <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
                  <dd className="mt-1 text-craie-100">{valeur}</dd>
                </div>
              ),
            )}
          </dl>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-16 px-4 py-14">
        {/* ── Analyse ──────────────────────────────────────────────────── */}
        {analyse ? (
          <>
            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Analyse</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-5 space-y-4 leading-relaxed text-craie-300">
                {analyse.analyse.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Competences</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-6 space-y-3">
                {analyse.competences.map((c) => (
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

            <section className="grid gap-4 md:grid-cols-2">
              <Carte className="border-emerald-500/25">
                <h2 className="flex items-center gap-2 font-titre text-lg font-bold text-emerald-400">
                  <Swords size={18} aria-hidden />
                  Forces
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {analyse.forces.map((f) => (
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
                  {analyse.faiblesses.map((f) => (
                    <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-craie-300">
                      <span aria-hidden className="mt-2 size-1 shrink-0 bg-sang-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Carte>
            </section>

            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Contres</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ListeContres titre={`${h.nom} est a l'aise contre`} slugs={analyse.fortContre} ton="bon" />
                <ListeContres titre={`${h.nom} est en difficulte contre`} slugs={analyse.faibleContre} ton="mauvais" />
              </div>
            </section>

            <section>
              <h2 className="font-titre text-2xl font-bold text-craie-100">Builds</h2>
              <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
              <div className="mt-6 space-y-4">
                {analyse.builds.map((b) => (
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
                      {[["Embleme", b.embleme], ["Talent", b.talent], ["Sort", b.sort]].map(([c, v]) => (
                        <div key={c} className="flex gap-2">
                          <dt className="text-craie-500">{c}</dt>
                          <dd className="text-craie-100">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </Carte>
                ))}
              </div>
            </section>
          </>
        ) : (
          <Carte className="border-or-500/30">
            <h2 className="flex items-center gap-2 font-titre text-xl font-bold text-or-400">
              <ShieldAlert size={20} aria-hidden />
              Analyse en cours de redaction
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-craie-300">
              Les donnees de {h.nom} sont a jour — elles viennent directement du
              wiki. Ce qui manque, c&apos;est le commentaire : ce que le heros
              fait vraiment, ses builds et ses contres. Cela ne s&apos;extrait
              pas, cela s&apos;ecrit.
            </p>
            <a
              href={`${site.depot}/blob/main/CONTRIBUTING.md`}
              rel="noreferrer"
              className="mt-5 inline-block text-sm font-semibold text-or-400 underline underline-offset-4 hover:text-or-500"
            >
              Contribuer a cette analyse →
            </a>
          </Carte>
        )}

        {/* ── Skins ────────────────────────────────────────────────────── */}
        {h.skins.length > 0 && (
          <section>
            <div className="flex items-baseline gap-3">
              <h2 className="font-titre text-2xl font-bold text-craie-100">Skins</h2>
              <span className="text-sm text-craie-500">{h.skins.length}</span>
            </div>
            <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

            {/* Legende : le contour code la rarete, encore faut-il le dire. */}
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {raretesPresentes(h.skins.map((s) => s.rarete)).map((r) => (
                <li key={r.nom} className="flex items-center gap-1.5 text-xs text-craie-500">
                  <span
                    aria-hidden
                    className="size-2.5 border-2"
                    style={{ borderColor: r.couleur }}
                  />
                  {r.nom}
                </li>
              ))}
            </ul>

            <GalerieSkins nom={h.nom} skins={h.skins} visuels={h.visuels.skins} />
          </section>
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
        {slugs.map((s) => (
          <li key={s}>
            <Link
              href={`/heros/${s}`}
              className={`biseau-sm border px-2.5 py-1 text-sm transition-colors ${
                ton === "bon"
                  ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  : "border-sang-500/30 text-sang-500 hover:bg-sang-500/10"
              }`}
            >
              {herosParSlug.get(s)?.nom ?? s}
            </Link>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
