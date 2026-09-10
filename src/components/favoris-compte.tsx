"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/i18n/fournisseur";
import Link from "next/link";
import { MonitorSmartphone, Star, X } from "lucide-react";
import { abonnerFavoris, basculerFavori, favorisServeur, instantaneFavoris } from "@/lib/favoris";
import { herosParSlug } from "@/lib/donnees-client";

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

/** Liste des heros mis en favori, lue depuis le navigateur. */
export function FavorisCompte() {
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
      <NotePortee />
    </div>
  );
}
