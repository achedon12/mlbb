"use client";

import Image from "next/image";
import Link from "@/components/lien";
import { useState } from "react";
import { ChoixBuild } from "@/components/choix-build";
import { GroupeFiltres, Puce } from "@/components/puce";
import { useRang } from "@/components/selecteur-rang";
import type { RangMesure } from "@/lib/rangs-mesure";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

export interface VisuelResolu {
  nom: string;
  image: string | null;
}

export interface ObjetResolu extends VisuelResolu {
  slug: string | null;
}

/** Build resolu par le serveur : le navigateur n'a ni catalogue ni visuels. */
export interface BuildResolu {
  objets: ObjetResolu[];
  embleme: VisuelResolu | null;
  talents: VisuelResolu[];
  sort: VisuelResolu | null;
  /** Taux de victoire du build, en %. */
  victoire: number | null;
  /** Part des parties ou il apparait, en %. */
  selection: number | null;
}

/** Guide de joueur resolu : equipement complet, sans taux mesure. */
export interface GuideResolu {
  objets: ObjetResolu[];
  embleme: VisuelResolu | null;
  talents: VisuelResolu[];
  sort: VisuelResolu | null;
  /** Meilleur rang atteint par l'auteur, en cle d'embleme de rang. */
  auteur: { cle: string; division: string } | null;
  votes: number;
}

/**
 * Builds reellement joues, rang par rang.
 *
 * Ils suivent le rang choisi sur la fiche : un Mythique ne s'equipe pas comme
 * un Epique. Un heros joue sur deux positions a un build par position — le
 * choix de la position n'apparait que dans ce cas.
 *
 * Les builds mesures ne portent que les objets cles. L'equipement complet vient
 * a part, d'un guide de joueur : deux sources distinctes, jamais melangees
 * sous un meme taux de victoire.
 */
export function BuildsParRang({
  parLane,
  guides,
}: {
  parLane: Record<string, Partial<Record<RangMesure, BuildResolu[]>>>;
  guides: Record<string, Partial<Record<RangMesure, GuideResolu>>>;
}) {
  const t = useT();
  const rang = useRang();
  const lanes = [...new Set([...Object.keys(parLane), ...Object.keys(guides)])];
  const [lane, setLane] = useState(lanes[0]);
  const parRang = parLane[lane] ?? {};
  // Le rang de la fiche peut manquer pour cette position : repli sur tous rangs.
  const builds = parRang[rang] ?? parRang.all ?? [];
  const guide = guides[lane]?.[rang] ?? guides[lane]?.all ?? null;

  const nomEmbleme = (nom: string) => {
    const role = t(`roles.${nom}`);
    return role === `roles.${nom}` ? nom : role;
  };

  return (
    <div>
      <h3 className="font-titre text-lg font-bold text-craie-100">{t("builds.joues")}</h3>
      <p className="mt-1 text-sm leading-relaxed text-craie-500">{t("builds.jouesIntro")}</p>

      {lanes.length > 1 && (
        <GroupeFiltres legende={t("builds.position")} largeurLegende="" className="mt-4">
          {lanes.map((l) => (
            <Puce key={l} actif={l === lane} onClick={() => setLane(l)}>
              {t(`lanes.${l}`)}
            </Puce>
          ))}
        </GroupeFiltres>
      )}

      <ol className="mt-5 grid gap-4 lg:grid-cols-3">
        {builds.map((b, i) => (
          <li key={i} className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-titre font-bold text-or-400">{t("builds.build", { n: i + 1 })}</span>
              {b.victoire !== null && (
                <span className="text-xs font-semibold tabular-nums text-emerald-400">
                  {t("builds.victoire", { taux: b.victoire.toFixed(1) })}
                </span>
              )}
            </div>
            {b.selection !== null && (
              <p className="mt-0.5 text-xs tabular-nums text-craie-500">
                {t("builds.selection", { taux: b.selection.toFixed(1) })}
              </p>
            )}

            <p className="mt-4 text-[0.65rem] uppercase tracking-wide text-craie-500">{t("builds.objets")}</p>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {b.objets.map((o) => (
                <li key={o.nom}>
                  <ObjetCle objet={o} />
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-3 border-t border-nuit-800 pt-4">
              {b.embleme && (
                <ChoixBuild
                  libelle={t("builds.embleme")}
                  nom={nomEmbleme(b.embleme.nom)}
                  image={b.embleme.image}
                />
              )}
              {b.talents.map((talent, j) => (
                <ChoixBuild
                  key={talent.nom}
                  libelle={j === 0 ? t("builds.talents") : undefined}
                  nom={talent.nom}
                  image={talent.image}
                />
              ))}
              {b.sort && <ChoixBuild libelle={t("builds.sort")} nom={b.sort.nom} image={b.sort.image} />}
            </div>
          </li>
        ))}
      </ol>

      {guide && (
        <section className="mt-8">
          <h4 className="font-titre font-bold text-craie-100">{t("builds.guide")}</h4>
          <p className="mt-1 text-sm leading-relaxed text-craie-500">{t("builds.guideIntro")}</p>
          <div className="biseau mt-4 border border-nuit-700/70 bg-nuit-900/60 p-4">
            <p className="text-xs text-craie-500">
              {guide.auteur &&
                t("builds.guideAuteur", {
                  rang: `${t(`rangsNom.${guide.auteur.cle}`)}${guide.auteur.division ? ` ${guide.auteur.division}` : ""}`,
                })}
              {guide.auteur && " · "}
              {t("builds.guideVotes", { n: guide.votes })}
            </p>
            <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {guide.objets.map((o, i) => (
                <li key={`${o.nom}-${i}`}>
                  <ObjetCle objet={o} />
                </li>
              ))}
            </ol>
            <div className="mt-4 grid gap-3 border-t border-nuit-800 pt-4 sm:grid-cols-3 lg:grid-cols-5">
              {guide.embleme && (
                <ChoixBuild
                  libelle={t("builds.embleme")}
                  nom={nomEmbleme(guide.embleme.nom)}
                  image={guide.embleme.image}
                />
              )}
              {guide.talents.map((talent, j) => (
                <ChoixBuild
                  key={talent.nom}
                  libelle={j === 0 ? t("builds.talents") : undefined}
                  nom={talent.nom}
                  image={talent.image}
                />
              ))}
              {guide.sort && (
                <ChoixBuild libelle={t("builds.sort")} nom={guide.sort.nom} image={guide.sort.image} />
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ObjetCle({ objet }: { objet: ObjetResolu }) {
  const contenu = (
    <>
      <span className="relative mx-auto block size-11">
        {objet.image ? (
          <Image src={objet.image} alt="" fill sizes="44px" loading="eager" className="object-contain" />
        ) : (
          <span className="grid size-full place-items-center bg-nuit-800 text-xs text-craie-500">
            {objet.nom.charAt(0)}
          </span>
        )}
      </span>
      <span className="mt-1.5 block text-[0.7rem] leading-tight text-craie-300">{objet.nom}</span>
    </>
  );
  const classe = "biseau-sm block border border-nuit-700 bg-nuit-850 p-2 text-center";
  return objet.slug ? (
    <Link href={`/items#${objet.slug}`} className={cn(classe, "transition-colors hover:border-or-500/60")}>
      {contenu}
    </Link>
  ) : (
    <span className={classe}>{contenu}</span>
  );
}
