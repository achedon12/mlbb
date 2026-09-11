"use client";

import { useMemo, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { CarteSuggestion, SelecteurHeros, VignetteHeros } from "@/components/choix-heros";
import { LANES, suggerer, type HerosDraft } from "@/lib/draft";
import { useT } from "@/i18n/fournisseur";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Aide au draft.
 *
 * On renseigne ce que l'adversaire a pris, lane par lane ; l'outil propose des
 * reponses et dit pourquoi. Les choix de sa propre equipe se renseignent de la
 * meme facon, ce qui affine les suggestions au fur et a mesure : un pick
 * allie ouvre des synergies, un pick adverse ferme des options.
 */
type Camp = "ennemis" | "allies";

const VIDE: Record<Lane, string | null> = {
  Or: null,
  Jungle: null,
  Milieu: null,
  Experience: null,
  Roam: null,
};

export function OutilDraft({ heros }: { heros: HerosDraft[] }) {
  const t = useT();
  const [ennemis, setEnnemis] = useState<Record<Lane, string | null>>(VIDE);
  const [allies, setAllies] = useState<Record<Lane, string | null>>(VIDE);
  const [ouvert, setOuvert] = useState<{ camp: Camp; lane: Lane } | null>(null);

  const parSlug = useMemo(() => new Map(heros.map((h) => [h.slug, h])), [heros]);
  const listeEnnemis = Object.values(ennemis).filter(Boolean) as string[];
  const listeAllies = Object.values(allies).filter(Boolean) as string[];

  const suggestions = useMemo(
    () =>
      LANES.map((lane) => ({
        lane,
        // Une lane deja pourvue n'a pas besoin de suggestion.
        picks: allies[lane]
          ? []
          : suggerer({ candidats: heros, lane, ennemis: listeEnnemis, allies: listeAllies }),
      })),
    [heros, allies, listeEnnemis, listeAllies],
  );

  function choisir(camp: Camp, lane: Lane, slug: string | null) {
    const majeur = camp === "ennemis" ? setEnnemis : setAllies;
    majeur((etat) => ({ ...etat, [lane]: slug }));
    setOuvert(null);
  }

  const vide = listeEnnemis.length === 0 && listeAllies.length === 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Colonne
          titre={t("draftUI.adverse")}
          aide={t("draftUI.adverseDesc")}
          camp="ennemis"
          selection={ennemis}
          parSlug={parSlug}
          onOuvrir={setOuvert}
          onRetirer={(lane) => choisir("ennemis", lane, null)}
          accent="blood"
        />
        <Colonne
          titre={t("draftUI.votre")}
          aide={t("draftUI.votreDesc")}
          camp="allies"
          selection={allies}
          parSlug={parSlug}
          onOuvrir={setOuvert}
          onRetirer={(lane) => choisir("allies", lane, null)}
          accent="azure"
        />
      </div>

      {!vide && (
        <button
          type="button"
          onClick={() => {
            setEnnemis(VIDE);
            setAllies(VIDE);
          }}
          className="bevel-sm inline-flex items-center gap-2 border border-night-700 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          <RotateCcw size={14} aria-hidden />
          {t("draftUI.toutEffacer")}
        </button>
      )}

      {/* ── Suggestions ──────────────────────────────────────────────── */}
      <section>
        <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("draftUI.quePrendre")}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

        {vide ? (
          <p className="mt-4 max-w-2xl leading-relaxed text-chalk-500">
            {t("draftUI.intro")}
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            {suggestions.map(({ lane, picks }) => (
              <div key={lane}>
                <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-gold-400">
                  {lane}
                  {allies[lane] && (
                    <span className="ml-2 font-medium normal-case tracking-normal text-chalk-500">
                      {t("draftUI.dejaPourvue")}
                    </span>
                  )}
                </h3>

                {picks.length > 0 && (
                  <ul className="mt-2 grid gap-2 md:grid-cols-3">
                    {picks.map((s, rang) => (
                      <li key={s.heros.slug}>
                        <CarteSuggestion
                          suggestion={s}
                          premiere={rang === 0}
                          titrePrendre={t("draftUI.choisirEn", { nom: s.heros.nom, lane: t(`lanes.${lane}`) })}
                          onPrendre={() => choisir("allies", lane, s.heros.slug)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {ouvert && (
        <SelecteurHeros
          heros={heros}
          exclus={new Set([...listeEnnemis, ...listeAllies])}
          lane={ouvert.lane}
          titre={t("draftUI.choisirLane", { lane: t(`lanes.${ouvert.lane}`) })}
          onChoisir={(slug) => choisir(ouvert.camp, ouvert.lane, slug)}
          onFermer={() => setOuvert(null)}
        />
      )}
    </div>
  );
}

function Colonne({
  titre,
  aide,
  camp,
  selection,
  parSlug,
  onOuvrir,
  onRetirer,
  accent,
}: {
  titre: string;
  aide: string;
  camp: Camp;
  selection: Record<Lane, string | null>;
  parSlug: Map<string, HerosDraft>;
  onOuvrir: (v: { camp: Camp; lane: Lane }) => void;
  onRetirer: (lane: Lane) => void;
  accent: "blood" | "azure";
}) {
  const t = useT();
  return (
    <section>
      <h2 className="font-heading text-lg font-bold text-chalk-100">{titre}</h2>
      <p className="mt-0.5 text-xs text-chalk-500">{aide}</p>

      <ul className="mt-3 space-y-1.5">
        {LANES.map((lane) => {
          const heros = selection[lane] ? parSlug.get(selection[lane]!) : null;
          return (
            <li key={lane} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-chalk-500">
                {t(`lanes.${lane}`)}
              </span>

              {heros ? (
                <span
                  className={cn(
                    "bevel-sm flex flex-1 items-center gap-2 border bg-night-900/60 p-1.5",
                    accent === "blood" ? "border-blood-500/40" : "border-azure-500/40",
                  )}
                >
                  <VignetteHeros heros={heros} petite />
                  <span className="min-w-0 flex-1 truncate text-sm text-chalk-100">
                    {heros.nom}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRetirer(lane)}
                    aria-label={t("draftUI.retirer", { nom: heros.nom })}
                    className="grid size-6 place-items-center text-chalk-500 transition-colors hover:text-blood-500"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOuvrir({ camp, lane })}
                  className="bevel-sm flex-1 border border-dashed border-night-700 px-3 py-2 text-left text-sm text-chalk-500 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                >
                  {t("draftUI.choisirUn")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
