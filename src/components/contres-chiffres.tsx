"use client";

import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { TrendingDown, TrendingUp, Users } from "lucide-react";
import { useRang } from "@/components/selecteur-rang";
import type { RangMesure } from "@/lib/rangs-mesure";
import { useT } from "@/i18n/fournisseur";
import { cn } from "@/lib/utils";

/** Adversaire resolu par le serveur : le navigateur n'a pas le catalogue. */
export interface ContreAffiche {
  slug: string;
  nom: string;
  portrait: string | null;
  /** Ecart de taux de victoire, en points (positif = avantage). */
  avantage: number;
}

export interface ContresAffiches {
  fort: ContreAffiche[];
  faible: ContreAffiche[];
  mesure: number | null;
}

/**
 * Contres etablis sur les taux de victoire du jeu, rang par rang.
 *
 * Chaque ligne porte l'ecart en points, sa vraie information : « fort contre
 * Wanwan » ne dit rien, « +3,3 points contre Wanwan » situe l'avantage. Les
 * portraits rendent la lecture immediate — on reconnait un heros a sa tete
 * avant son nom.
 *
 * Un matchup ne pese pas pareil en Epique et en Gloire mythique : le rang de la
 * fiche bascule d'une mesure a l'autre. Toutes arrivent avec la page, qui reste
 * statique — changer de rang ne declenche aucune requete.
 */
export function ContresChiffres({
  nom,
  parRang,
}: {
  nom: string;
  parRang: Partial<Record<RangMesure, ContresAffiches>>;
}) {
  const t = useT();
  const rang = useRang();
  // Le rang de la fiche peut manquer ici : on retombe sur tous rangs.
  const courant = parRang[rang] ?? parRang.all;
  if (!courant) return null;

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-craie-500">
        {t("pages.heroDetail.contresIntro", { nom })}
        {courant.mesure !== null && (
          <span className="text-craie-300">
            {" "}{t("pages.heroDetail.contresRef", { taux: courant.mesure })}
          </span>
        )}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Colonne
          titre={t("contres.fort")}
          icone={<TrendingUp size={17} aria-hidden />}
          ton="bon"
          entrees={courant.fort}
        />
        <Colonne
          titre={t("contres.difficulte")}
          icone={<TrendingDown size={17} aria-hidden />}
          ton="mauvais"
          entrees={courant.faible}
        />
      </div>
    </div>
  );
}

/**
 * Coequipiers qui font le plus gagner le heros, au rang de la fiche : l'ecart
 * est celui de son taux de victoire quand ils jouent ensemble.
 */
export function CoequipiersParRang({
  nom,
  parRang,
}: {
  nom: string;
  parRang: Partial<Record<RangMesure, ContreAffiche[]>>;
}) {
  const t = useT();
  const rang = useRang();
  const liste = parRang[rang] ?? parRang.all;
  if (!liste?.length) return null;

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-craie-500">{t("pages.heroDetail.coequipiersIntro", { nom })}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Colonne titre={t("pages.heroDetail.coequipiers")} icone={<Users size={17} aria-hidden />} ton="bon" entrees={liste} />
      </div>
    </div>
  );
}

function Colonne({
  titre,
  icone,
  ton,
  entrees,
}: {
  titre: string;
  icone: React.ReactNode;
  ton: "bon" | "mauvais";
  entrees: ContreAffiche[];
}) {
  const t = useT();
  const couleur = ton === "bon" ? "text-emerald-400" : "text-sang-500";

  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
      <h3 className={cn("flex items-center gap-2 font-titre font-bold", couleur)}>
        {icone}
        {titre}
      </h3>
      <ul className="mt-3 space-y-1.5">
        {entrees.map((e) => (
          <li key={e.slug}>
            <Link
              href={`/heroes/${e.slug}`}
              className="flex items-center gap-2.5 rounded-sm px-1 py-1 transition-colors hover:bg-nuit-850"
            >
              <PortraitHeros source={e.portrait} nom={e.nom} taille="petite" decoratif />
              <span className="min-w-0 flex-1 truncate text-sm text-craie-100">{e.nom}</span>
              <span className={cn("shrink-0 text-xs font-semibold tabular-nums", couleur)}>
                {e.avantage > 0 ? "+" : ""}
                {e.avantage.toFixed(1)} {t("contres.pts")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
