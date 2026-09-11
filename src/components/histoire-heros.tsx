import {
  BookOpen,
  Cake,
  Crown,
  Flag,
  Hourglass,
  MapPin,
  PawPrint,
  Quote,
  Sparkles,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { HistoireHeros as Histoire } from "@/lib/types";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";

/**
 * L'histoire d'un heros, mise en page pour la lecture : une accroche en
 * exergue, le recit en pleine largeur avec une lettrine, une fiche d'identite
 * illustree et les anecdotes en cartes.
 */

type ChampTexte = "titre" | "espece" | "genre" | "age" | "origine" | "anniversaire";

const CHAMPS: { cle: ChampTexte; icone: LucideIcon }[] = [
  { cle: "titre", icone: Crown },
  { cle: "espece", icone: PawPrint },
  { cle: "genre", icone: Users },
  { cle: "age", icone: Hourglass },
  { cle: "origine", icone: MapPin },
  { cle: "anniversaire", icone: Cake },
];

function GroupeChips({
  titre,
  valeurs,
  icone: Icone,
}: {
  titre: string;
  valeurs: string[];
  icone: LucideIcon;
}) {
  if (!valeurs.length) return null;
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-chalk-500">
        <Icone size={13} aria-hidden />
        {titre}
      </dt>
      <dd className="mt-2 flex flex-wrap gap-1.5">
        {valeurs.map((v) => (
          <span
            key={v}
            className="bevel-sm border border-night-700/70 bg-night-800/60 px-2 py-1 text-xs text-chalk-200"
          >
            {v}
          </span>
        ))}
      </dd>
    </div>
  );
}

export function HistoireHeros({ histoire, nom, langue }: { histoire: Histoire; nom: string; langue: Langue }) {
  const t = creerT(langue);
  const { accroche, lore, fiche, anecdotes } = histoire;
  const [premier, ...suite] = lore;

  return (
    <div className="space-y-12">
      {/* Accroche en exergue. */}
      {accroche && (
        <figure className="relative overflow-hidden">
          <Quote
            aria-hidden
            size={80}
            className="pointer-events-none absolute -left-3 -top-4 text-night-800"
            strokeWidth={1.5}
          />
          <blockquote className="relative pl-6 font-heading text-xl italic leading-relaxed text-chalk-100 sm:text-2xl">
            {accroche}
          </blockquote>
        </figure>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {/* Le recit, en colonne de lecture. */}
        <div className="min-w-0">
          {lore.length > 0 ? (
            <section>
              <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-[0.15em] text-gold-400">
                <BookOpen size={16} aria-hidden />
                {t("histoire.recit")}
              </h2>
              <div className="mt-5 max-w-[68ch] space-y-4 text-[0.95rem] leading-[1.8] text-chalk-300">
                {premier && (
                  <p className="first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-heading first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.8] first-letter:text-gold-400">
                    {premier}
                  </p>
                )}
                {suite.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ) : (
            !accroche && (
              <p className="leading-relaxed text-chalk-500">
                {t("histoire.aucunRecit", { nom })}
              </p>
            )
          )}
        </div>

        {/* La fiche d'identite. */}
        {fiche && (
          <aside className="bevel border border-night-700/60 bg-night-950/50 p-5 lg:sticky lg:top-24">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-chalk-100">
              {fiche.nomComplet ?? nom}
            </h2>
            <div aria-hidden className="gold-rule mt-3 h-0.5 w-12" />
            <dl className="mt-5 space-y-4 text-sm">
              {CHAMPS.map(({ cle, icone: Icone }) =>
                fiche[cle] ? (
                  <div key={cle} className="flex gap-3">
                    <span className="mt-0.5 text-chalk-500">
                      <Icone size={15} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-wide text-chalk-500">{t(`histoire.${cle}`)}</dt>
                      <dd className="mt-0.5 text-chalk-100">{fiche[cle]}</dd>
                    </div>
                  </div>
                ) : null,
              )}
            </dl>
            {(fiche.affiliations.length > 0 ||
              fiche.relations.length > 0 ||
              fiche.pouvoirs.length > 0) && (
              <dl className="mt-5 space-y-4 border-t border-night-800 pt-5 text-sm">
                <GroupeChips titre={t("histoire.pouvoirs")} valeurs={fiche.pouvoirs} icone={Wand2} />
                <GroupeChips titre={t("histoire.affiliations")} valeurs={fiche.affiliations} icone={Flag} />
                <GroupeChips titre={t("histoire.relations")} valeurs={fiche.relations} icone={Users} />
              </dl>
            )}
          </aside>
        )}
      </div>

      {/* Anecdotes. */}
      {anecdotes.length > 0 && (
        <section className="border-t border-night-800 pt-10">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-[0.15em] text-azure-400">
            <Sparkles size={16} aria-hidden />
            {t("histoire.saviezVous")}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {anecdotes.map((a, i) => (
              <li
                key={i}
                className="bevel-sm border border-night-700/50 bg-night-900/40 p-4 text-sm leading-relaxed text-chalk-300"
              >
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
