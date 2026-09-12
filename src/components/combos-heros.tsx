import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import type { ComboHeros } from "@/lib/donnees";

/**
 * Combos conseilles par le jeu : pour chaque phase (lane, combat d'equipe),
 * l'ordre des competences en icones, puis le conseil qui l'accompagne. Les
 * icones reprennent celles des tuiles de competences juste au-dessus ; le nom
 * de chacune passe par l'infobulle et le texte alternatif.
 */
export function CombosHeros({ combos, langue }: { combos: ComboHeros[]; langue: Langue }) {
  if (combos.length === 0) return null;
  const t = creerT(langue);

  return (
    <section>
      <h3 className="font-heading text-lg font-bold text-chalk-100">{t("pages.heroDetail.combos.title")}</h3>
      <p className="mt-1 text-sm text-chalk-500">{t("pages.heroDetail.combos.intro")}</p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {combos.map((combo, i) => (
          <li key={i} className="bevel border border-night-700/70 bg-night-900/60 p-4">
            {combo.type && (
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-gold-400">
                {t(`pages.heroDetail.combos.types.${combo.type}`)}
              </p>
            )}
            <ol aria-label={t("pages.heroDetail.combos.order")} className="mt-2 flex flex-wrap items-center gap-1">
              {combo.skills.map((c, j) => {
                const nom = c.basicAttack ? t("pages.heroDetail.combos.basicAttack") : (c.name ?? "");
                return (
                  <li key={j} className="flex items-center gap-1">
                    {j > 0 && <ChevronRight size={14} aria-hidden className="shrink-0 text-chalk-500" />}
                    <span title={nom} className="relative block size-10 overflow-hidden rounded-sm bg-night-800">
                      {c.icon ? (
                        <Image src={c.icon} alt={nom} fill sizes="40px" className="object-contain" />
                      ) : (
                        <span className="grid size-full place-items-center text-xs text-chalk-500">
                          <span aria-hidden>—</span>
                          <span className="sr-only">{nom}</span>
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-sm leading-relaxed text-chalk-300">{combo.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
