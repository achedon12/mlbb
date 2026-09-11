"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/fournisseur";
import Link from "@/components/lien";
import { BellRing, Minus, MonitorSmartphone, Star, TrendingDown, TrendingUp, X, type LucideIcon } from "lucide-react";
import { abonnerFavoris, basculerFavori, favorisServeur, instantaneFavoris } from "@/lib/favoris";
import { herosParSlug } from "@/lib/donnees-client";
import type { ResumePatch } from "@/lib/suivi-patchs";
import type { TypeAjustement } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Note de portee : les favoris ne sont pas lies au compte de jeu — ils vivent
 * dans ce navigateur. Le dire clairement evite de croire qu'ils suivraient
 * d'un appareil a l'autre, ou qu'ils dependraient de la connexion.
 */
function NotePortee() {
  const t = useT();
  return (
    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-craie-500">
      <MonitorSmartphone size={14} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        {t("favoris.intro")}
      </span>
    </p>
  );
}

const TENDANCE: Record<TypeAjustement, { icone: LucideIcon; couleur: string }> = {
  amelioration: { icone: TrendingUp, couleur: "text-emerald-400" },
  affaiblissement: { icone: TrendingDown, couleur: "text-sang-500" },
  ajustement: { icone: Minus, couleur: "text-azur-400" },
};

/**
 * Favoris touches par le dernier patch : on sait d'un coup d'oeil lesquels
 * ont ete ameliores, affaiblis ou retouches, sans lire toutes les notes.
 */
function AlertePatch({ favoris, patch }: { favoris: readonly string[]; patch: ResumePatch }) {
  const t = useT();
  const touches = favoris.filter((slug) => slug in patch.types);

  return (
    <div className="biseau mt-5 border border-or-500/30 bg-nuit-900/60 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-craie-100">
        <BellRing size={15} aria-hidden className="shrink-0 text-or-400" />
        {t("favoris.alerte.titre", { version: patch.version })}
      </h3>
      {touches.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-craie-500">
          {t("favoris.alerte.aucun", { version: patch.version })}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {touches.map((slug) => {
            const type = patch.types[slug];
            const tendance = type ? TENDANCE[type] : null;
            const Icone = tendance?.icone;
            return (
              <li key={slug} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                <Link
                  href={`/heroes/${slug}#stats`}
                  className="font-medium text-craie-100 underline underline-offset-4 transition-colors hover:text-or-400"
                >
                  {herosParSlug[slug] ?? slug}
                </Link>
                <span className={cn("flex items-center gap-1 text-xs font-semibold", tendance?.couleur ?? "text-craie-400")}>
                  {Icone && <Icone size={13} aria-hidden />}
                  {type ? t(`patchHeros.${type}`) : t("favoris.alerte.modifie")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-nuit-800 pt-3 text-xs leading-relaxed text-craie-500">
        <Link href={`/patch-notes/${patch.version}`} className="font-semibold text-or-400 hover:text-or-500">
          {t("patchHeros.voirPatch", { version: patch.version })} →
        </Link>
        <span>{t("favoris.alerte.rss")}</span>
      </p>
    </div>
  );
}

/**
 * Liste des heros mis en favori, lue depuis le navigateur. `dernierPatch`, un
 * resume de quelques centaines d'octets, signale ceux que le patch a touches.
 */
export function FavorisCompte({ dernierPatch = null }: { dernierPatch?: ResumePatch | null }) {
  const t = useT();
  const favoris = useSyncExternalStore(abonnerFavoris, instantaneFavoris, favorisServeur);

  if (favoris.length === 0) {
    return (
      <div>
        <p className="mt-6 text-sm leading-relaxed text-craie-500">
          {t("favoris.aucunPre")}
          <Link href="/heroes" className="text-or-400 underline underline-offset-4">
            {t("favoris.aucunLien")}
          </Link>
          {t("favoris.aucunPost")}
        </p>
        <NotePortee />
      </div>
    );
  }

  return (
    <div>
      <p className="mt-6 text-sm text-craie-400">
        {t("favoris.compte", { n: favoris.length })}{" "}
        {favoris.length > 1 ? t("favoris.gardes") : t("favoris.garde")}.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {favoris.map((slug) => (
          <li key={slug} className="biseau-sm flex items-center border border-nuit-700 bg-nuit-900/60">
            <Link
              href={`/heroes/${slug}`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-craie-100 transition-colors hover:text-or-400"
            >
              <Star size={13} aria-hidden fill="currentColor" className="text-or-500" />
              {herosParSlug[slug] ?? slug}
            </Link>
            <button
              type="button"
              onClick={() => basculerFavori(slug)}
              aria-label={t("favoris.retirer", { nom: herosParSlug[slug] ?? slug })}
              className="grid size-9 place-items-center text-craie-500 transition-colors hover:text-sang-500"
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {dernierPatch && <AlertePatch favoris={favoris} patch={dernierPatch} />}
      <NotePortee />
    </div>
  );
}
