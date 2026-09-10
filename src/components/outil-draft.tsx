"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RotateCcw, Search, X } from "lucide-react";
import { LANES, suggerer, type HerosDraft } from "@/lib/draft";
import { useT } from "@/i18n/fournisseur";
import type { Lane, Role } from "@/lib/types";
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
          accent="sang"
        />
        <Colonne
          titre={t("draftUI.votre")}
          aide={t("draftUI.votreDesc")}
          camp="allies"
          selection={allies}
          parSlug={parSlug}
          onOuvrir={setOuvert}
          onRetirer={(lane) => choisir("allies", lane, null)}
          accent="azur"
        />
      </div>

      {!vide && (
        <button
          type="button"
          onClick={() => {
            setEnnemis(VIDE);
            setAllies(VIDE);
          }}
          className="biseau-sm inline-flex items-center gap-2 border border-nuit-700 px-4 py-2 text-sm text-craie-300 transition-colors hover:border-or-500/60 hover:text-or-400"
        >
          <RotateCcw size={14} aria-hidden />
          {t("draftUI.toutEffacer")}
        </button>
      )}

      {/* ── Suggestions ──────────────────────────────────────────────── */}
      <section>
        <h2 className="font-titre text-2xl font-bold text-craie-100">{t("draftUI.quePrendre")}</h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

        {vide ? (
          <p className="mt-4 max-w-2xl leading-relaxed text-craie-500">
            {t("draftUI.intro")}
          </p>
        ) : (
          <div className="mt-6 space-y-5">
            {suggestions.map(({ lane, picks }) => (
              <div key={lane}>
                <h3 className="font-titre text-sm font-semibold uppercase tracking-wider text-or-400">
                  {lane}
                  {allies[lane] && (
                    <span className="ml-2 font-medium normal-case tracking-normal text-craie-500">
                      {t("draftUI.dejaPourvue")}
                    </span>
                  )}
                </h3>

                {picks.length > 0 && (
                  <ul className="mt-2 grid gap-2 md:grid-cols-3">
                    {picks.map((s, rang) => (
                      <li key={s.heros.slug}>
                        <div
                          className={cn(
                            "biseau flex h-full gap-3 border bg-nuit-900/60 p-3",
                            rang === 0 ? "border-or-500/50" : "border-nuit-700/70",
                          )}
                        >
                          <Vignette heros={s.heros} />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/heroes/${s.heros.slug}`}
                              className="font-titre font-bold text-craie-100 transition-colors hover:text-or-400"
                            >
                              {s.heros.nom}
                            </Link>
                            <ul className="mt-1 space-y-0.5">
                              {s.raisons.map((r) => (
                                <li
                                  key={r.texte}
                                  className={cn(
                                    "text-xs leading-snug",
                                    r.favorable ? "text-emerald-400" : "text-sang-500",
                                  )}
                                >
                                  {r.favorable ? "+ " : "− "}
                                  {r.texte}
                                </li>
                              ))}
                              {s.raisons.length === 0 && (
                                <li className="text-xs text-craie-500">
                                  {t("draftUI.aucunContre")}
                                </li>
                              )}
                            </ul>
                          </div>
                          <button
                            type="button"
                            onClick={() => choisir("allies", lane, s.heros.slug)}
                            title={t("draftUI.choisirEn", { nom: s.heros.nom, lane: t(`lanes.${lane}`) })}
                            className="biseau-sm self-start border border-nuit-600 px-2 py-1 text-xs text-craie-300 transition-colors hover:border-or-500 hover:text-or-400"
                          >
                            {t("draftUI.prendre")}
                          </button>
                        </div>
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
        <Selecteur
          heros={heros}
          exclus={new Set([...listeEnnemis, ...listeAllies])}
          lane={ouvert.lane}
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
  accent: "sang" | "azur";
}) {
  const t = useT();
  return (
    <section>
      <h2 className="font-titre text-lg font-bold text-craie-100">{titre}</h2>
      <p className="mt-0.5 text-xs text-craie-500">{aide}</p>

      <ul className="mt-3 space-y-1.5">
        {LANES.map((lane) => {
          const heros = selection[lane] ? parSlug.get(selection[lane]!) : null;
          return (
            <li key={lane} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-craie-500">
                {t(`lanes.${lane}`)}
              </span>

              {heros ? (
                <span
                  className={cn(
                    "biseau-sm flex flex-1 items-center gap-2 border bg-nuit-900/60 p-1.5",
                    accent === "sang" ? "border-sang-500/40" : "border-azur-500/40",
                  )}
                >
                  <Vignette heros={heros} petite />
                  <span className="min-w-0 flex-1 truncate text-sm text-craie-100">
                    {heros.nom}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRetirer(lane)}
                    aria-label={t("draftUI.retirer", { nom: heros.nom })}
                    className="grid size-6 place-items-center text-craie-500 transition-colors hover:text-sang-500"
                  >
                    <X size={13} aria-hidden />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onOuvrir({ camp, lane })}
                  className="biseau-sm flex-1 border border-dashed border-nuit-700 px-3 py-2 text-left text-sm text-craie-500 transition-colors hover:border-or-500/60 hover:text-or-400"
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

function Vignette({ heros, petite = false }: { heros: HerosDraft; petite?: boolean }) {
  const taille = petite ? "size-7" : "size-10";
  return (
    <span className={cn("biseau-sm relative shrink-0 overflow-hidden bg-nuit-800", taille)}>
      {heros.icone ? (
        <Image
          src={heros.icone}
          alt=""
          fill
          sizes={petite ? "28px" : "40px"}
          loading="eager"
          className="object-cover"
        />
      ) : null}
    </span>
  );
}

const ROLES: Role[] = ["Tank", "Fighter", "Assassin", "Mage", "Marksman", "Support"];

/** Nom ramene a une cle de recherche : sans casse ni accents. */
const cleRecherche = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Choix d'un heros pour une lane.
 *
 * Tout le roster est proposable. La liste s'ouvre sur les heros de la lane
 * concernee, « Toutes » l'elargit aux 133, et le filtre de role la resserre.
 * Taper un nom cherche dans tout le roster : la lane se relache d'elle-meme.
 */
function Selecteur({
  heros,
  exclus,
  lane,
  onChoisir,
  onFermer,
}: {
  heros: HerosDraft[];
  exclus: Set<string>;
  lane: Lane;
  onChoisir: (slug: string) => void;
  onFermer: () => void;
}) {
  const t = useT();
  const [recherche, setRecherche] = useState("");
  const [laneFiltre, setLaneFiltre] = useState<Lane | null>(lane);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onFermer]);

  const resultats = useMemo(() => {
    const terme = cleRecherche(recherche.trim());
    return heros
      .filter((h) => !exclus.has(h.slug))
      .filter((h) => !laneFiltre || h.lanes.includes(laneFiltre))
      .filter((h) => !role || h.roles.includes(role))
      .filter((h) => !terme || cleRecherche(h.nom).includes(terme))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [heros, exclus, laneFiltre, role, recherche]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("draftUI.choisirLane", { lane: t(`lanes.${lane}`) })}
      className="fixed inset-0 z-50 grid place-items-center bg-nuit-950/80 p-4"
      onClick={onFermer}
    >
      <div
        className="biseau flex max-h-[85vh] w-full max-w-3xl flex-col border border-nuit-700 bg-nuit-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-craie-500"
            />
            <input
              autoFocus
              type="search"
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                if (e.target.value.trim()) setLaneFiltre(null);
              }}
              placeholder={t("draftUI.rechercher")}
              aria-label={t("draftUI.rechercher")}
              className="biseau-sm w-full border border-nuit-700 bg-nuit-950 py-2 pl-9 pr-3 text-craie-100 outline-none focus:border-or-500"
            />
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label={t("draftUI.fermer")}
            className="grid size-9 place-items-center text-craie-500 hover:text-craie-100"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <div role="group" aria-label={t("draftUI.filtreLane")} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-16 shrink-0 text-[0.65rem] uppercase tracking-wide text-craie-500">
              {t("draftUI.filtreLane")}
            </span>
            <Puce actif={laneFiltre === null} onClick={() => setLaneFiltre(null)}>
              {t("draftUI.toutesLanes")}
            </Puce>
            {LANES.map((l) => (
              <Puce key={l} actif={laneFiltre === l} onClick={() => setLaneFiltre(l)}>
                {t(`lanes.${l}`)}
              </Puce>
            ))}
          </div>
          <div role="group" aria-label={t("draftUI.filtreRole")} className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-16 shrink-0 text-[0.65rem] uppercase tracking-wide text-craie-500">
              {t("draftUI.filtreRole")}
            </span>
            <Puce actif={role === null} onClick={() => setRole(null)}>
              {t("draftUI.tousRoles")}
            </Puce>
            {ROLES.map((r) => (
              <Puce key={r} actif={role === r} onClick={() => setRole(role === r ? null : r)}>
                {t(`roles.${r}`)}
              </Puce>
            ))}
          </div>
        </div>

        <p aria-live="polite" className="mt-3 text-xs text-craie-500">
          {t("draftUI.compte", { n: resultats.length })}
        </p>

        <ul className="mt-2 grid grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
          {resultats.map((h) => (
            <li key={h.slug}>
              <button
                type="button"
                onClick={() => onChoisir(h.slug)}
                title={h.nom}
                className="biseau-sm flex w-full flex-col items-center gap-1 border border-nuit-700/70 p-2 text-center transition-colors hover:border-or-500/60 hover:bg-nuit-850"
              >
                <Vignette heros={h} />
                <span className="w-full truncate text-xs text-craie-100">{h.nom}</span>
              </button>
            </li>
          ))}
          {resultats.length === 0 && (
            <li className="col-span-full py-6 text-center text-sm text-craie-500">
              {t("draftUI.aucunHeros")}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Puce({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={cn(
        "biseau-sm px-2.5 py-1 text-xs font-medium transition-colors",
        actif
          ? "bg-or-500 text-nuit-950"
          : "border border-nuit-700 text-craie-300 hover:border-or-500/60 hover:text-or-400",
      )}
    >
      {children}
    </button>
  );
}
