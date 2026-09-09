import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert, Swords, TriangleAlert } from "lucide-react";
import { BoutonFavori } from "@/components/bouton-favori";
import { CompetencesHeros } from "@/components/competences-heros";
import { FilAriane } from "@/components/fil-ariane";

import { ContresChiffres } from "@/components/contres-chiffres";
import { ObjetBuild } from "@/components/objet-build";
import { PresentationVideo } from "@/components/presentation-video";
import { Onglets } from "@/components/onglets";

import {
  PortraitVitrine,
  VitrineProvider,
  VitrineSkins,
  type SkinComplet,
} from "@/components/vitrine-skins";
import { BadgeRole, Carte, Jauge } from "@/components/ui";
import {
  competences,
  contres,
  heros,
  herosParSlug,
  illustrations,
  videos,
  visuelsCompetences,
} from "@/lib/donnees";
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
  const competencesWiki = competences[h.slug] ?? [];
  const iconesCompetences = visuelsCompetences[h.slug] ?? {};
  const illustrationsHeros = illustrations[h.slug] ?? {};
  // L'illustration du skin d'origine sert de fond : c'est celle qui represente
  // le heros tel qu'on le rencontre par defaut.
  const fond = Object.values(illustrationsHeros)[0] ?? null;
  const video = videos[h.slug] ?? null;
  const contresHeros = contres[h.slug] ?? null;

  // Jointure des trois sources : le skin porte son id, son portrait (par id) et
  // son illustration (par nom). La vitrine s'en sert pour tout synchroniser.
  const skinsComplets: SkinComplet[] = h.skins.map((s) => ({
    ...s,
    portrait: h.visuels.skins[s.id] ?? null,
    illustration: illustrationsHeros[s.nom] ?? null,
  }));
  const portraitDe = (slug: string) =>
    herosParSlug.get(slug)?.visuels.icone ?? herosParSlug.get(slug)?.visuels.portrait ?? null;
  const nomDe = (slug: string) => herosParSlug.get(slug)?.nom ?? slug;

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

      {/*
        Un seul etat de skin pour toute la fiche : l'en-tete et l'onglet skins
        le partagent, si bien que choisir un skin met a jour le portrait de tete
        comme la grande illustration.
      */}
      <VitrineProvider skins={skinsComplets} portraitDefaut={h.visuels.portrait}>
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <FilAriane miettes={[{ nom: "Heros", href: "/heros" }, { nom: h.nom }]} />
      </div>
      {/* ── En-tete ────────────────────────────────────────────────────── */}
      <div className="relative border-b border-nuit-700/70 bg-nuit-900/30">
        {fond && (
          <div aria-hidden className="absolute inset-0 overflow-hidden">
            <Image
              src={fond}
              alt=""
              fill
              priority
              sizes="100vw"
              // Le bandeau est bien plus large que l'illustration n'est haute :
              // cadrer en haut ne montrerait que le ciel. On vise le tiers
              // superieur, ou se trouve le personnage.
              className="object-cover object-[50%_30%] brightness-110"
            />
            {/*
              Un voile uniforme plutot qu'un degrade lateral : la zone claire
              d'une illustration n'est pas au meme endroit d'un heros a
              l'autre — celle de Khufra est sombre a droite, celle de Miya au
              centre. Un degrade oriente marchait donc pour les uns et effacait
              les autres.
            */}
            <div className="absolute inset-0 bg-nuit-950/55" />
            {/*
              Le bas de l'en-tete se referme sur le fond de page : la
              transition vers le contenu reste franche, sans coupure nette.
            */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-nuit-950 to-transparent" />
          </div>
        )}

        <div className="relative mx-auto max-w-5xl px-4 py-10">
          <Link
            href="/heros"
            // Ce lien flotte sur l'illustration, dont la clarte varie d'un
            // heros a l'autre : il porte donc son propre fond.
            className="biseau-sm inline-flex items-center gap-1.5 bg-nuit-950/75 px-3 py-1.5 text-sm text-craie-300 backdrop-blur-sm transition-colors hover:text-or-400"
          >
            <ArrowLeft size={15} aria-hidden />
            Tous les heros
          </Link>

          <div className="biseau mt-6 flex flex-wrap items-start gap-6 border border-nuit-700/50 bg-nuit-950/75 p-5 backdrop-blur-sm">
            <PortraitVitrine nom={h.nom} portraitDefaut={h.visuels.portrait} />

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
          {/*
            Les informations posent leur propre fond plutot que de compter sur
            l'assombrissement de l'illustration : le contraste ne depend alors
            plus de la luminosite de l'artwork, qui change a chaque heros.
          */}
          <dl className="biseau mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border border-nuit-700/50 bg-nuit-950/75 p-5 text-sm backdrop-blur-sm sm:grid-cols-4 lg:grid-cols-6">
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

      <div className="mx-auto max-w-5xl px-4 py-10">
        <Onglets
          onglets={[
            {
              id: "analyse",
              label: "Analyse",
              contenu: analyse ? (
                <div className="space-y-12">
                  <section>
                    <div className="space-y-4 leading-relaxed text-craie-300">
                      {analyse.analyse.split("\n\n").map((p, i) => (
                        <p key={i}>{p}</p>
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

                </div>
              ) : (
                <Carte className="border-or-500/30">
                  <h2 className="flex items-center gap-2 font-titre text-xl font-bold text-or-400">
                    <ShieldAlert size={20} aria-hidden />
                    Analyse en cours de redaction
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-craie-300">
                    Les donnees de {h.nom} sont a jour — elles viennent
                    directement du wiki. Ce qui manque, c&apos;est le
                    commentaire : ce que le heros fait vraiment, ses builds et
                    ses contres. Cela ne s&apos;extrait pas, cela s&apos;ecrit.
                  </p>
                  <a
                    href={`${site.depot}/blob/main/CONTRIBUTING.md`}
                    rel="noreferrer"
                    className="mt-5 inline-block text-sm font-semibold text-or-400 underline underline-offset-4 hover:text-or-500"
                  >
                    Contribuer a cette analyse →
                  </a>
                </Carte>
              ),
            },
            {
              id: "competences",
              label: "Competences",
              compteur:
                Math.max(
                  competencesWiki.filter(Boolean).length,
                  analyse?.competences.length ?? 0,
                ) || undefined,
              contenu: (
                <CompetencesHeros
                  wiki={competencesWiki}
                  icones={iconesCompetences}
                  redigees={analyse?.competences ?? null}
                />
              ),
            },
            {
              id: "contres",
              label: "Contres",
              contenu:
                contresHeros || analyse ? (
                  <div className="space-y-8">
                    {contresHeros && (
                      <section>
                        <p className="mb-4 text-sm leading-relaxed text-craie-500">
                          Etabli sur les taux de victoire du jeu : l&apos;ecart en
                          points indique de combien le taux de {h.nom} varie face
                          a chaque adversaire.
                          {contresHeros.mesure !== null && (
                            <span className="text-craie-300">
                              {" "}Taux de victoire de reference : {contresHeros.mesure} %.
                            </span>
                          )}
                        </p>
                        <ContresChiffres
                          fort={contresHeros.fort}
                          faible={contresHeros.faible}
                          portraitParSlug={portraitDe}
                          nomParSlug={nomDe}
                        />
                      </section>
                    )}

                    {analyse && (analyse.fortContre.length > 0 || analyse.faibleContre.length > 0) && (
                      <section>
                        <h3 className="font-titre text-lg font-bold text-craie-100">
                          Lecture des matchups
                        </h3>
                        <p className="mt-1 text-sm text-craie-500">
                          Les duels commentes a la main, au-dela des chiffres.
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <ListeContres titre={`${h.nom} est a l'aise contre`} slugs={analyse.fortContre} ton="bon" />
                          <ListeContres titre={`${h.nom} est en difficulte contre`} slugs={analyse.faibleContre} ton="mauvais" />
                        </div>
                      </section>
                    )}
                  </div>
                ) : null,
            },
            {
              id: "builds",
              label: "Builds",
              compteur: analyse?.builds.length,
              contenu: analyse ? (
                <div className="space-y-4">
                  {analyse.builds.map((b) => (
                    <Carte key={b.nom}>
                      <h3 className="font-titre text-lg font-bold text-or-400">{b.nom}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-craie-500">{b.contexte}</p>
                      <ol className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {b.objets.map((o, i) => (
                          <ObjetBuild key={o} nom={o} rang={i + 1} />
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
              ) : null,
            },
            {
              id: "skins",
              label: "Skins",
              compteur: skinsComplets.length || undefined,
              contenu:
                skinsComplets.length > 0 ? (
                  <VitrineSkins skins={skinsComplets} />
                ) : null,
            },
            {
              id: "video",
              label: "Presentation",
              contenu: <PresentationVideo video={video} nom={h.nom} />,
            },
          ]}
        />
      </div>
      </VitrineProvider>
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
