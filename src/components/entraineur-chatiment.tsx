"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Copy,
  Crown,
  Download,
  Film,
  Flame,
  ImageIcon,
  Share2,
  Skull,
  Sparkles,
  Target,
  Trophy,
  Turtle,
  Zap,
} from "lucide-react";
import { Puce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import { HAUTEUR_CARTE, LARGEUR_CARTE, dessinerCarte, filmerCarte, type DonneesCarte } from "@/lib/carte-chatiment";
import {
  CLES_OBJECTIFS,
  DIFFICULTES_ORDRE,
  MANCHES_PAR_SERIE,
  NIVEAU_MAX,
  NIVEAU_MIN,
  OBJECTIFS,
  RECHARGE_CHATIMENT_S,
  REGLAGES,
  apresManche,
  apresSerie,
  bilanSerie,
  cleRecord,
  coupSuivant,
  creerAlea,
  degatsChatiment,
  evaluerFrappe,
  lireRecords,
  preparerManche,
  resultatRate,
  resultatVole,
  type CleObjectif,
  type Coup,
  type Difficulte,
  type Manche,
  type Records,
  type Resultat,
} from "@/lib/chatiment";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Entraineur de Chatiment : le monstre encaisse les coups de l'equipe dans une
 * petite arene — il tremble, les degats s'envolent, sa barre de vie fond — et
 * le joueur frappe (le sort, Espace ou Entree) des que les PV passent sous les
 * degats de son Chatiment. Trop tot, le sort part dans le vide ; trop tard, le
 * jungler adverse l'emporte. Chaque manche se termine sur sa chronologie :
 * votre frappe face a celle du jungler adverse, en millisecondes.
 *
 * Tout se joue dans le navigateur, sans requete : une fois la page visitee, le
 * service worker la sert hors ligne. Records et suites restent sur l'appareil.
 */
const CLE_STOCKAGE = "mlbb_chatiment";
const EVENEMENT_RECORDS = "mlbb-chatiment";
const ICONES: Record<CleObjectif, LucideIcon> = {
  tortue: Turtle,
  seigneur: Crown,
  "seigneur-12": Crown,
  "buff-violet": Sparkles,
  "buff-orange": Flame,
};
/** Teinte d'ambiance de l'arene, prise sur le portrait de chaque monstre. */
const TEINTES: Record<CleObjectif, string> = {
  tortue: "#2dd4bf",
  seigneur: "#a78bfa",
  "seigneur-12": "#c084fc",
  "buff-violet": "#818cf8",
  "buff-orange": "#fb923c",
};
/** Intensite de chaque difficulte : barres allumees, du vert au rouge. */
const INTENSITES: Record<Difficulte, { n: number; couleur: string }> = {
  facile: { n: 1, couleur: "#34d399" },
  normal: { n: 2, couleur: "#4da3ff" },
  difficile: { n: 3, couleur: "#fb923c" },
  pro: { n: 4, couleur: "#d94848" },
};
const ICONE_CHATIMENT = "/visuels/sorts/retribution.png";
/** Attente entre l'annonce d'une manche et le premier coup, en ms : impossible a anticiper. */
const PRET_MS: [number, number] = [700, 1300];
/** Apres un verdict, les appuis sont ignores un instant : un appui de trop ne relance pas la manche. */
const BLOCAGE_MS = 500;
const ECLATS_MAX = 6;
const NIVEAUX = Array.from({ length: NIVEAU_MAX - NIVEAU_MIN + 1 }, (_, i) => NIVEAU_MIN + i);

type Phase = "attente" | "pret" | "combat" | "resultat" | "bilan";
interface Eclat {
  id: number;
  degats: number;
  source: Coup["source"];
}

// Records : le navigateur est la source, lue comme un magasin externe. Sans
// stockage (navigation privee stricte), ils vivent en memoire le temps de la visite.
let memoire: string | null = null;
function lireBrut(): string | null {
  try {
    return localStorage.getItem(CLE_STOCKAGE) ?? memoire;
  } catch {
    return memoire;
  }
}
function enregistrer(records: Records) {
  memoire = JSON.stringify(records);
  try {
    localStorage.setItem(CLE_STOCKAGE, memoire);
  } catch {
    // Stockage refuse : la copie en memoire suffit.
  }
  window.dispatchEvent(new Event(EVENEMENT_RECORDS));
}
function abonnerRecords(rappel: () => void) {
  window.addEventListener("storage", rappel);
  window.addEventListener(EVENEMENT_RECORDS, rappel);
  return () => {
    window.removeEventListener("storage", rappel);
    window.removeEventListener(EVENEMENT_RECORDS, rappel);
  };
}

const REQUETE_MOUVEMENT = "(prefers-reduced-motion: reduce)";
function abonnerMouvement(rappel: () => void) {
  const m = window.matchMedia(REQUETE_MOUVEMENT);
  m.addEventListener("change", rappel);
  return () => m.removeEventListener("change", rappel);
}
const mouvementReduit = () => window.matchMedia(REQUETE_MOUVEMENT).matches;

/** Horloge des reactions : jamais appelee pendant le rendu, seulement par les minuteries et les appuis. */
const horodatage = () => performance.now();

function graine(): number {
  const tirage = new Uint32Array(1);
  crypto.getRandomValues(tirage);
  return tirage[0];
}

/** Degats d'un coup, qui s'envolent au-dessus du monstre (immobiles si le mouvement est reduit). */
function ChiffreDegat({ eclat, texte, reduit }: { eclat: Eclat; texte: string; reduit: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reduit) return;
    ref.current?.animate?.(
      [
        { transform: "translateY(10px) scale(0.8)", opacity: 1 },
        { transform: "translateY(-6px) scale(1.1)", opacity: 1, offset: 0.25 },
        { transform: "translateY(-44px) scale(1)", opacity: 0 },
      ],
      { duration: 900, easing: "ease-out", fill: "forwards" },
    );
  }, [reduit]);
  return (
    <span
      ref={ref}
      className={cn(
        "absolute font-heading font-bold tabular-nums drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]",
        eclat.source === "competence" && "text-2xl text-gold-400",
        eclat.source === "adverse" && "text-2xl text-blood-500",
        eclat.source === "allie" && "text-base text-chalk-100",
      )}
      style={{ left: `${14 + ((eclat.id * 37) % 64)}%`, top: `${30 + ((eclat.id * 23) % 30)}%` }}
    >
      −{texte}
    </span>
  );
}

/** Eclair dore qui s'abat sur le monstre quand le Chatiment le securise. */
function Eclair() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    ref.current?.animate?.(
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 0.3, offset: 0.26 },
        { opacity: 1, offset: 0.4 },
        { opacity: 0 },
      ],
      { duration: 700, easing: "ease-out", fill: "forwards" },
    );
  }, []);
  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox="0 0 64 128"
      className="pointer-events-none absolute -top-1/4 left-1/2 h-[150%] -translate-x-1/2 opacity-0 drop-shadow-[0_0_14px_#f5c451]"
    >
      <path
        d="M40 0 L14 72 L31 72 L20 128 L54 50 L36 50 L48 0 Z"
        fill="#fff5cf"
        stroke="#f5c451"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Verdict frappe en travers de l'arene. */
function Tampon({ reussi, titre, points, reduit }: { reussi: boolean; titre: string; points: string; reduit: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduit) return;
    ref.current?.animate?.(
      [
        { transform: "scale(1.9) rotate(-6deg)", opacity: 0 },
        { transform: "scale(0.95) rotate(-3deg)", opacity: 1, offset: 0.7 },
        { transform: "scale(1) rotate(-3deg)", opacity: 1 },
      ],
      { duration: 320, easing: "ease-out", fill: "forwards" },
    );
  }, [reduit]);
  return (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "bevel pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 -rotate-3 whitespace-nowrap border-2 bg-night-950/90 px-5 py-2 text-center font-heading font-bold uppercase shadow-2xl shadow-black/70",
        reussi ? "border-gold-400 text-gold-400" : "border-blood-500 text-blood-500",
      )}
    >
      <span className="block text-2xl tracking-wide sm:text-3xl">{titre}</span>
      {reussi && <span className="block text-lg tabular-nums text-chalk-100">+{points}</span>}
    </div>
  );
}

/**
 * Chronologie d'une manche, a partir du passage sous le seuil : la frappe du
 * joueur, quand il y en a eu une, et celle du jungler adverse.
 */
function LigneTemps({
  vous,
  adverse,
  t,
  nombre,
}: {
  vous: number | null;
  adverse: number;
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
  nombre: Intl.NumberFormat;
}) {
  const echelle = Math.max(1000, adverse, vous ?? 0) * 1.08;
  const part = (ms: number) => (ms / echelle) * 100;
  // Une etiquette pres d'un bord s'aligne sur lui, au lieu de deborder.
  const placement = (p: number) => (p < 12 ? "left-0" : p > 82 ? "right-0" : "-translate-x-1/2");
  const reperes = [
    { cle: "vous", ms: vous, couleur: "text-gold-400", fond: "bg-gold-400", icone: Target, haut: true },
    { cle: "adverse", ms: adverse, couleur: "text-blood-500", fond: "bg-blood-500", icone: Skull, haut: false },
  ] as const;
  return (
    <figure className="mt-4">
      <figcaption className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.rowTime")}</figcaption>
      <div className="relative mb-9 mt-10 h-2 bg-night-800">
        <div
          aria-hidden
          className={cn("absolute inset-y-0 left-0", vous === null ? "bg-blood-500/40" : "bg-gold-500/50")}
          style={{ width: `${part(vous ?? adverse)}%` }}
        />
        <span aria-hidden className="absolute -top-1.5 left-0 h-5 w-0.5 bg-chalk-300" />
        <span className="absolute left-0 top-4 text-xs text-chalk-500">{t("tools.retribution.rowThreshold")}</span>
        {reperes.map(({ cle, ms, couleur, fond, icone: Icone, haut }) => {
          if (ms === null) return null;
          const p = part(ms);
          return (
            <div key={cle} className="absolute inset-y-0" style={{ left: `${p}%` }}>
              <span aria-hidden className={cn("absolute -top-1.5 h-5 w-0.5 -translate-x-1/2", fond)} />
              <span
                className={cn(
                  "absolute flex items-center gap-1 whitespace-nowrap text-xs font-semibold tabular-nums",
                  couleur,
                  haut ? "-top-8" : "top-4",
                  placement(p),
                )}
              >
                <Icone size={13} aria-hidden />
                {t(cle === "vous" ? "tools.retribution.rowYou" : "tools.retribution.rowEnemy", {
                  ms: nombre.format(ms),
                })}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

export function EntraineurChatiment({ adresse }: { adresse: string }) {
  const t = useT();
  const langue = useLangue();
  const locale = LOCALE_HTML[langue];
  const nombre = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pourcent = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }), [locale]);
  const reduit = useSyncExternalStore(abonnerMouvement, mouvementReduit, () => false);
  const brut = useSyncExternalStore(abonnerRecords, lireBrut, () => null);
  const records = useMemo(() => lireRecords(brut), [brut]);
  const ids = { objectif: useId(), difficulte: useId(), niveau: useId(), aide: useId() };

  const [objectif, setObjectif] = useState<CleObjectif>("seigneur");
  const [difficulte, setDifficulte] = useState<Difficulte>("normal");
  const [niveau, setNiveau] = useState(OBJECTIFS.seigneur.niveauConseille);
  const [phase, setPhase] = useState<Phase>("attente");
  const [manche, setManche] = useState<Manche | null>(null);
  const [pv, setPv] = useState(0);
  const [eclats, setEclats] = useState<Eclat[]>([]);
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [nouveauRecord, setNouveauRecord] = useState(false);
  const [annonce, setAnnonce] = useState("");
  const [partage, setPartage] = useState<"copie" | "erreur" | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [video, setVideo] = useState<{ url: string; extension: string } | null>(null);
  const [filmage, setFilmage] = useState(false);
  const [vue, setVue] = useState<"video" | "image">("video");

  // Etat du combat, lu et ecrit par les minuteries : il vit hors du rendu.
  const jeu = useRef({
    phase: "attente" as Phase,
    objectif: "seigneur" as CleObjectif,
    difficulte: "normal" as Difficulte,
    niveau: OBJECTIFS.seigneur.niveauConseille,
    manche: null as Manche | null,
    pv: 0,
    franchiA: null as number | null,
    pvFranchissement: null as number | null,
    alea: Math.random,
    minuteries: [] as ReturnType<typeof setTimeout>[],
    resultats: [] as Resultat[],
    bloqueJusqua: 0,
    derniereTouche: 0,
    idEclat: 0,
    image: null as Blob | null,
    apercu: null as string | null,
    video: null as { blob: Blob; url: string } | null,
  });
  const bouton = useRef<HTMLButtonElement>(null);
  const monstre = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  const nomObjectif = (o: CleObjectif) => t(`tools.retribution.objective.${o}`);
  const nomDifficulte = (d: Difficulte) => t(`tools.retribution.difficulty.${d}`);

  function changerPhase(p: Phase) {
    jeu.current.phase = p;
    setPhase(p);
  }

  function arreter() {
    jeu.current.minuteries.forEach(clearTimeout);
    jeu.current.minuteries = [];
  }

  function plusTard(action: () => void, ms: number) {
    jeu.current.minuteries.push(setTimeout(action, ms));
  }

  /** Le monstre tremble sous le coup, plus fort pour une competence ou une rafale adverse. */
  function secouer(source: Coup["source"]) {
    if (mouvementReduit()) return;
    const fort = source !== "allie";
    const d = fort ? 8 : 3;
    monstre.current?.animate?.(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${-d}px, ${d / 2}px)` },
        { transform: `translate(${d}px, ${-d / 2}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: fort ? 260 : 160, easing: "ease-out" },
    );
    if (flash.current) {
      flash.current.style.background = source === "adverse" ? "#d94848" : "#ffffff";
      flash.current.animate?.([{ opacity: fort ? 0.55 : 0.28 }, { opacity: 0 }], { duration: 240, easing: "ease-out" });
    }
  }

  function verdict(r: Resultat): { titre: string; detail: string } {
    switch (r.issue) {
      case "securise":
        return {
          titre: t("tools.retribution.outcomeSecured"),
          detail: t("tools.retribution.detailSecured", {
            precision: pourcent.format(r.precision ?? 0),
            reaction: nombre.format(r.reaction ?? 0),
            points: nombre.format(r.points),
          }),
        };
      case "tropTot":
        return {
          titre: t("tools.retribution.outcomeTooEarly"),
          detail: t("tools.retribution.detailTooEarly", { reste: nombre.format(r.reste ?? 0), recharge: RECHARGE_CHATIMENT_S }),
        };
      case "vole":
        return {
          titre: t("tools.retribution.outcomeStolen"),
          detail: t("tools.retribution.detailStolen", { reaction: nombre.format(r.reactionAdverse ?? 0) }),
        };
      default:
        return { titre: t("tools.retribution.outcomeMissed"), detail: t("tools.retribution.detailMissed") };
    }
  }

  async function donneesCarte(serie: Resultat[], record: boolean): Promise<DonneesCarte> {
    const j = jeu.current;
    const b = bilanSerie(serie);
    await document.fonts?.ready;
    const style = getComputedStyle(document.documentElement);
    const police = (variable: string) => `${style.getPropertyValue(variable).trim() || "system-ui"}, system-ui, sans-serif`;
    // Portrait local (meme origine) : le canvas reste exportable.
    const portrait = new Image();
    portrait.src = OBJECTIFS[j.objectif].image;
    const charge = await portrait.decode().then(
      () => true,
      () => false,
    );
    return {
      marque: site.nom,
      titre: t("tools.retribution.mapTitle"),
      sousTitre: [nomObjectif(j.objectif), nomDifficulte(j.difficulte), t("tools.retribution.levelShort", { n: j.niveau })]
        .join(" · "),
      total: b.total,
      formater: (n) => nombre.format(n),
      libelleScore: t("tools.retribution.points"),
      stats: [
        { libelle: t("tools.retribution.secured"), valeur: `${b.securises}/${b.manches}` },
        {
          libelle: t("tools.retribution.bestReaction"),
          valeur: b.meilleureReaction === null ? "—" : `${nombre.format(b.meilleureReaction)} ms`,
        },
        {
          libelle: t("tools.retribution.averageAccuracy"),
          valeur: b.precisionMoyenne === null ? "—" : pourcent.format(b.precisionMoyenne),
        },
      ],
      manches: serie.map((r) => r.issue),
      record: record ? t("tools.retribution.newRecord") : null,
      adresse: adresse.replace(/^https?:\/\//, ""),
      polices: { titre: police("--heading-font"), corps: police("--body-font") },
      portrait: charge ? portrait : null,
      teinte: TEINTES[j.objectif],
    };
  }

  function imageFixe(d: DonneesCarte): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = LARGEUR_CARTE;
    canvas.height = HAUTEUR_CARTE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    dessinerCarte(ctx, d);
    return new Promise((ok) => canvas.toBlob(ok, "image/png"));
  }

  /** L'image de la carte d'abord, puis sa video, filmee en quelques secondes. */
  async function produireApercu(serie: Resultat[], record: boolean) {
    const j = jeu.current;
    const d = await donneesCarte(serie, record);
    const image = await imageFixe(d);
    if (image) {
      if (j.apercu) URL.revokeObjectURL(j.apercu);
      j.image = image;
      j.apercu = URL.createObjectURL(image);
      setApercu(j.apercu);
    }
    if (j.video) URL.revokeObjectURL(j.video.url);
    j.video = null;
    setVideo(null);
    setFilmage(true);
    const film = await filmerCarte(d).catch(() => null);
    setFilmage(false);
    // Une nouvelle partie a pu commencer pendant le tournage : la video ne lui correspond plus.
    if (!film || j.resultats !== serie) return;
    j.video = { blob: film, url: URL.createObjectURL(film) };
    setVideo({ url: j.video.url, extension: film.type.includes("mp4") ? "mp4" : "webm" });
  }

  function terminer(r: Resultat) {
    const j = jeu.current;
    if (j.phase !== "combat") return;
    arreter();
    const serie = [...j.resultats, r];
    j.resultats = serie;
    setResultats(serie);
    let suivants = apresManche(lireRecords(lireBrut()), r.issue);
    let record = false;
    const fini = serie.length >= MANCHES_PAR_SERIE;
    if (fini) {
      const issue = apresSerie(
        suivants,
        cleRecord(j.objectif, j.difficulte),
        bilanSerie(serie),
        new Date().toISOString().slice(0, 10),
      );
      suivants = issue.records;
      record = issue.nouveau;
    }
    enregistrer(suivants);
    setNouveauRecord(record);
    j.bloqueJusqua = horodatage() + BLOCAGE_MS;
    changerPhase(fini ? "bilan" : "resultat");
    const v = verdict(r);
    const total = bilanSerie(serie).total;
    setAnnonce(`${v.titre} ${v.detail}${fini ? ` ${t("tools.retribution.announceSummary", { points: nombre.format(total) })}` : ""}`);
    if (fini) void produireApercu(serie, record);
  }

  function planifier() {
    const j = jeu.current;
    if (!j.manche) return;
    const coup = coupSuivant(j.pv, j.manche, j.difficulte, j.alea);
    plusTard(() => appliquer(coup), coup.intervalle);
  }

  function appliquer(coup: Coup) {
    const j = jeu.current;
    if (j.phase !== "combat" || !j.manche) return;
    j.pv = coup.pvApres;
    setPv(coup.pvApres);
    j.idEclat += 1;
    const eclat = { id: j.idEclat, degats: coup.degats, source: coup.source };
    setEclats((e) => [...e.slice(-(ECLATS_MAX - 1)), eclat]);
    secouer(coup.source);
    if (j.franchiA === null && coup.pvApres <= j.manche.seuil) {
      j.franchiA = horodatage();
      j.pvFranchissement = coup.pvApres;
      const reaction = j.manche.reactionAdverse;
      plusTard(() => terminer(resultatVole(reaction)), reaction);
    }
    if (coup.pvApres <= 0) terminer(resultatRate());
    else planifier();
  }

  function lancer() {
    const j = jeu.current;
    arreter();
    if (j.resultats.length >= MANCHES_PAR_SERIE) {
      j.resultats = [];
      setResultats([]);
      setNouveauRecord(false);
    }
    j.alea = creerAlea(graine());
    j.objectif = objectif;
    j.difficulte = difficulte;
    j.niveau = niveau;
    const m = preparerManche(objectif, difficulte, niveau, j.alea);
    j.manche = m;
    j.pv = m.pvDepart;
    j.franchiA = null;
    j.pvFranchissement = null;
    setManche(m);
    setPv(m.pvDepart);
    setEclats([]);
    changerPhase("pret");
    setAnnonce(
      t("tools.retribution.announceRound", {
        n: j.resultats.length + 1,
        total: MANCHES_PAR_SERIE,
        objectif: nomObjectif(objectif),
      }),
    );
    const attente = PRET_MS[0] + (PRET_MS[1] - PRET_MS[0]) * j.alea();
    plusTard(() => {
      changerPhase("combat");
      planifier();
    }, attente);
  }

  function frapper() {
    const j = jeu.current;
    const instant = horodatage();
    if (j.phase === "combat" && j.manche) {
      terminer(
        evaluerFrappe({
          pv: j.pv,
          seuil: j.manche.seuil,
          pvFranchissement: j.pvFranchissement,
          reaction: j.franchiA === null ? null : instant - j.franchiA,
        }),
      );
    } else if (j.phase !== "pret" && instant >= j.bloqueJusqua) {
      lancer();
    }
  }

  function reinitialiser() {
    arreter();
    const j = jeu.current;
    j.resultats = [];
    j.manche = null;
    setResultats([]);
    setManche(null);
    setEclats([]);
    setNouveauRecord(false);
    setAnnonce("");
    changerPhase("attente");
  }

  // Le raccourci clavier appelle toujours la version courante de `frapper`.
  const frapperCourant = useRef(frapper);
  useEffect(() => {
    frapperCourant.current = frapper;
  });

  useEffect(() => {
    const j = jeu.current;
    const cibleIgnoree = (e: KeyboardEvent) => {
      const cible = e.target instanceof HTMLElement ? e.target : null;
      if (cible?.closest("input, select, textarea, [contenteditable='true']")) return true;
      // Hors combat, Espace garde son role sur les autres boutons et liens.
      return j.phase !== "combat" && !!cible?.closest("button, a, summary") && cible !== bouton.current;
    };
    const enfoncer = (e: KeyboardEvent) => {
      if (e.code !== "Space" || cibleIgnoree(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      j.derniereTouche = horodatage();
      frapperCourant.current();
    };
    const relacher = (e: KeyboardEvent) => {
      if (e.code === "Space") j.derniereTouche = horodatage();
    };
    window.addEventListener("keydown", enfoncer);
    window.addEventListener("keyup", relacher);
    return () => {
      window.removeEventListener("keydown", enfoncer);
      window.removeEventListener("keyup", relacher);
      j.minuteries.forEach(clearTimeout);
      if (j.apercu) URL.revokeObjectURL(j.apercu);
      if (j.video) URL.revokeObjectURL(j.video.url);
    };
  }, []);

  const bilan = phase === "bilan" ? bilanSerie(resultats) : null;
  const texte = bilan
    ? t("tools.retribution.shareText", {
        objectif: nomObjectif(objectif),
        difficulte: nomDifficulte(difficulte),
        points: nombre.format(bilan.total),
        securises: bilan.securises,
        manches: bilan.manches,
      })
    : "";

  function signaler(etat: "copie" | "erreur") {
    setPartage(etat);
    setTimeout(() => setPartage(null), 3000);
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(`${texte} ${adresse}`);
      signaler("copie");
    } catch {
      signaler("erreur");
    }
  }

  async function partager() {
    const { image, video: film } = jeu.current;
    try {
      // On partage ce que montre l'apercu : la video, ou l'image.
      const fichier =
        vue === "video" && film && video
          ? new File([film.blob], `mlbbdex-retribution.${video.extension}`, { type: film.blob.type })
          : image
            ? new File([image], "mlbbdex-retribution.png", { type: "image/png" })
            : null;
      if (fichier && navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: t("tools.retribution.mapTitle"), text: `${texte} ${adresse}` });
      } else if (typeof navigator.share === "function") {
        await navigator.share({ title: t("tools.retribution.mapTitle"), text: texte, url: adresse });
      } else {
        await copier();
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) signaler("erreur");
    }
  }

  const o = OBJECTIFS[objectif];
  const teinte = TEINTES[objectif];
  const reglage = REGLAGES[difficulte];
  const seuil = degatsChatiment(niveau);
  const Icone = ICONES[objectif];
  const pvMax = manche?.pvMax ?? o.pv;
  const pvAffiche = manche ? pv : o.pv;
  const part = Math.max(0, (pvAffiche / pvMax) * 100);
  const partSeuil = Math.min(100, (seuil / pvMax) * 100);
  const verrouille = phase === "pret" || phase === "combat";
  const dernier = phase === "resultat" || phase === "bilan" ? (resultats.at(-1) ?? null) : null;
  // Le monstre tombe, sauf quand le Chatiment est parti trop tot : il reste alors debout.
  const abattu = dernier !== null && dernier.issue !== "tropTot";
  // Aux difficultes qui montrent le repere, la barre vire a l'or sous le seuil.
  const aPortee = phase === "combat" && reglage.repere && pvAffiche <= seuil;
  const record = records.series[cleRecord(objectif, difficulte)];
  const mancheCourante = Math.min(MANCHES_PAR_SERIE, resultats.length + (verrouille ? 1 : 0));
  const segment = (o.segment / pvMax) * 100;
  const libelleBouton = {
    attente: t("tools.retribution.start"),
    pret: t("tools.retribution.ready"),
    combat: t("tools.retribution.smite"),
    resultat: t("tools.retribution.next"),
    bilan: t("tools.retribution.newRun"),
  }[phase];
  const classeChoix = (actif: boolean) =>
    cn(
      "bevel-sm border transition-colors",
      actif ? "border-gold-400 bg-gold-500/10" : "border-night-700 bg-night-950/40 hover:border-night-600",
    );

  return (
    <div className="space-y-6">
      <Carte>
        <fieldset disabled={verrouille} className="space-y-6 disabled:opacity-60">
          <legend className="sr-only">{t("tools.retribution.settings")}</legend>
          <div>
            <p id={ids.objectif} className="text-xs uppercase tracking-wide text-chalk-500">
              {t("tools.retribution.objectiveLabel")}
            </p>
            <div role="group" aria-labelledby={ids.objectif} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {CLES_OBJECTIFS.map((cle) => {
                const actif = cle === objectif;
                return (
                  <button
                    key={cle}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => {
                      setObjectif(cle);
                      setNiveau(OBJECTIFS[cle].niveauConseille);
                      reinitialiser();
                    }}
                    className={cn("group flex flex-col items-center gap-2 p-3 text-center", classeChoix(actif))}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- portrait local, deja reduit */}
                    <img
                      src={OBJECTIFS[cle].image}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      className={cn(
                        "size-16 rounded-full border-2 object-cover transition",
                        !actif && "opacity-70 grayscale-[35%] group-hover:opacity-100 group-hover:grayscale-0",
                      )}
                      style={{ borderColor: actif ? TEINTES[cle] : "transparent" }}
                    />
                    <span className={cn("text-sm font-semibold leading-tight", actif ? "text-gold-400" : "text-chalk-200")}>
                      {nomObjectif(cle)}
                    </span>
                    <span className="text-xs tabular-nums text-chalk-500">
                      {t("tools.retribution.maxHp", { pv: nombre.format(OBJECTIFS[cle].pv) })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p id={ids.difficulte} className="text-xs uppercase tracking-wide text-chalk-500">
              {t("tools.retribution.difficultyLabel")}
            </p>
            <div role="group" aria-labelledby={ids.difficulte} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIFFICULTES_ORDRE.map((d) => {
                const actif = d === difficulte;
                const { n, couleur } = INTENSITES[d];
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => {
                      setDifficulte(d);
                      reinitialiser();
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold",
                      classeChoix(actif),
                      actif ? "text-gold-400" : "text-chalk-200",
                    )}
                  >
                    {nomDifficulte(d)}
                    <span aria-hidden className="flex items-end gap-0.5">
                      {[1, 2, 3, 4].map((k) => (
                        <span
                          key={k}
                          className="w-1.5"
                          style={{ height: `${4 + k * 3}px`, background: k <= n ? couleur : "var(--color-night-700)" }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-chalk-400">{t(`tools.retribution.difficultyHelp.${difficulte}`)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <label htmlFor={ids.niveau} className="text-xs uppercase tracking-wide text-chalk-500">
                {t("tools.retribution.levelLabel")}
              </label>
              {/* Les degats de chaque niveau, le niveau choisi en or : la courbe se lit d'un coup d'oeil. */}
              <div aria-hidden className="mt-3 flex h-12 items-end gap-1">
                {NIVEAUX.map((n) => (
                  <span
                    key={n}
                    className={cn("flex-1 transition-colors", n === niveau ? "bg-gold-400" : n < niveau ? "bg-gold-500/35" : "bg-night-700")}
                    style={{ height: `${(degatsChatiment(n) / degatsChatiment(NIVEAU_MAX)) * 100}%` }}
                  />
                ))}
              </div>
              <input
                id={ids.niveau}
                type="range"
                min={NIVEAU_MIN}
                max={NIVEAU_MAX}
                step={1}
                value={niveau}
                aria-valuetext={t("tools.retribution.levelOption", { n: niveau, degats: nombre.format(seuil) })}
                onChange={(e) => {
                  setNiveau(Number(e.target.value));
                  reinitialiser();
                }}
                className="mt-2 w-full cursor-pointer accent-gold-500"
              />
              <div aria-hidden className="flex justify-between text-xs tabular-nums text-chalk-500">
                <span>{NIVEAU_MIN}</span>
                <span>{NIVEAU_MAX}</span>
              </div>
            </div>
            <div className="bevel-sm flex items-center gap-3 border border-gold-500/40 bg-gold-500/10 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- icone locale du sort */}
              <img src={ICONE_CHATIMENT} alt="" width={48} height={48} className="size-12 rounded-full" />
              <div>
                <p className="text-xs uppercase tracking-wide text-chalk-400">
                  {t("tools.retribution.levelShort", { n: niveau })}
                </p>
                <p className="font-heading text-3xl font-bold leading-none tabular-nums text-gold-400">{nombre.format(seuil)}</p>
                <p className="mt-0.5 text-xs text-chalk-400">{t("tools.retribution.rawDamage")}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-chalk-300">
            {t("tools.retribution.thresholdSentence", { degats: nombre.format(seuil), conseille: o.niveauConseille })}
          </p>
        </fieldset>
      </Carte>

      <section aria-labelledby={`${ids.aide}-titre`} className="relative">
        {/* Le biseau est porte par le fond : pose sur l'arene, il rognerait les chiffres qui s'envolent. */}
        <div
          aria-hidden
          className="bevel absolute inset-0 border border-night-700/70 bg-night-950"
          style={{
            backgroundImage: `radial-gradient(ellipse 70% 55% at 50% 32%, ${teinte}40, transparent 70%), radial-gradient(ellipse 90% 40% at 50% 110%, ${teinte}26, transparent 70%)`,
          }}
        />
        <div className="relative space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-chalk-500">
                {t("tools.retribution.round")}{" "}
                <span className="font-heading text-base font-bold tabular-nums text-chalk-100">
                  {mancheCourante}/{MANCHES_PAR_SERIE}
                </span>
              </p>
              <ol className="mt-2 flex items-center gap-1.5" aria-label={t("tools.retribution.rounds")}>
                {Array.from({ length: MANCHES_PAR_SERIE }, (_, i) => {
                  const r = resultats[i];
                  const enCours = !r && verrouille && i === resultats.length;
                  return (
                    <li
                      key={i}
                      className={cn(
                        "bevel-sm grid size-6 place-items-center border",
                        !r && !enCours && "border-night-600",
                        enCours && "animate-pulse border-gold-400 bg-gold-500/20",
                        r?.issue === "securise" && "border-gold-400 bg-gold-400 text-night-950",
                        r && r.issue !== "securise" && "border-blood-500 bg-blood-500/30 text-blood-500",
                      )}
                    >
                      {r?.issue === "securise" && <Zap size={13} aria-hidden />}
                      {r && r.issue !== "securise" && <Skull size={12} aria-hidden />}
                      <span className="sr-only">{r ? verdict(r).titre : t("tools.retribution.toPlay")}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <dl className="flex gap-5 text-right text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.score")}</dt>
                <dd className="font-heading text-2xl font-bold tabular-nums text-gold-400">
                  {nombre.format(resultats.reduce((s, r) => s + r.points, 0))}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.run")}</dt>
                <dd className="flex items-center justify-end gap-1 font-heading text-2xl font-bold tabular-nums text-chalk-100">
                  {records.enCours > 0 && <Flame size={18} aria-hidden className="text-gold-400" />}
                  {nombre.format(records.enCours)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="relative flex flex-col items-center pt-2">
            <div ref={monstre} className="relative size-40 sm:size-52">
              <div aria-hidden className="absolute -inset-5 rounded-full opacity-50 blur-2xl" style={{ background: teinte }} />
              {/* eslint-disable-next-line @next/next/no-img-element -- portrait local, deja reduit */}
              <img
                src={o.image}
                alt=""
                width={320}
                height={320}
                className={cn(
                  "relative size-full rounded-full border-4 object-cover shadow-2xl shadow-black/70 transition-[filter] duration-500",
                  abattu && "brightness-50 grayscale",
                )}
                style={{ borderColor: teinte }}
              />
              <div ref={flash} aria-hidden className="pointer-events-none absolute inset-0 rounded-full opacity-0 mix-blend-screen" />
              <span
                aria-hidden
                className="bevel-sm absolute -bottom-2 left-1/2 grid size-10 -translate-x-1/2 place-items-center border border-night-600 bg-night-900 text-chalk-200"
              >
                <Icone size={20} />
              </span>
              {dernier?.issue === "securise" && !reduit && <Eclair key={resultats.length} />}
            </div>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56">
              {(reduit ? eclats.slice(-1) : eclats).map((e) => (
                <ChiffreDegat key={e.id} eclat={e} texte={nombre.format(e.degats)} reduit={reduit} />
              ))}
            </div>
            {phase === "pret" && (
              <p
                aria-hidden
                className="absolute top-[38%] animate-pulse font-heading text-4xl font-bold uppercase tracking-wider text-chalk-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
              >
                {t("tools.retribution.ready")}
              </p>
            )}
            {dernier && (
              <Tampon
                key={resultats.length}
                reussi={dernier.issue === "securise"}
                titre={verdict(dernier).titre}
                points={nombre.format(dernier.points)}
                reduit={reduit}
              />
            )}
            <h2 id={`${ids.aide}-titre`} className="mt-6 font-heading text-xl font-bold text-chalk-100">
              {nomObjectif(objectif)}
            </h2>
            <p className="text-sm text-chalk-500">
              {t("tools.retribution.maxHp", { pv: nombre.format(o.pv) })} · {nomDifficulte(difficulte)}
            </p>
          </div>

          <div>
            <div
              role="progressbar"
              aria-label={t("tools.retribution.bar", { objectif: nomObjectif(objectif) })}
              aria-valuemin={0}
              aria-valuemax={pvMax}
              aria-valuenow={pvAffiche}
              className="relative h-8 overflow-hidden border border-black/70 bg-night-950 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)]"
            >
              {reglage.repere && (
                <div aria-hidden className="absolute inset-y-0 left-0 bg-gold-400/10" style={{ width: `${partSeuil}%` }} />
              )}
              {/* Traine claire : la vie perdue s'efface un instant apres le coup, comme en jeu. */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 bg-chalk-100/60 transition-[width] delay-150 duration-500 ease-out"
                style={{ width: `${part}%` }}
              />
              <div
                className={cn(
                  "absolute inset-y-0 left-0 bg-gradient-to-b transition-[width] duration-100 ease-linear",
                  aPortee ? "from-[#ffe08a] to-gold-500" : "from-[#ff7a66] to-blood-500",
                )}
                style={{ width: `${part}%` }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(to right, transparent 0 calc(${segment}% - 1px), rgba(6, 8, 15, 0.9) calc(${segment}% - 1px) ${segment}%)`,
                }}
              />
              {reglage.repere && (
                <div
                  aria-hidden
                  className="absolute inset-y-0 w-0.5 bg-gold-400 shadow-[0_0_8px_#f5c451]"
                  style={{ left: `${partSeuil}%` }}
                />
              )}
              {reglage.pvChiffres && (
                <span
                  aria-hidden
                  className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]"
                >
                  {nombre.format(pvAffiche)}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
              <span className="tabular-nums text-chalk-300">
                {reglage.pvChiffres
                  ? t("tools.retribution.hpLeft", { pv: nombre.format(pvAffiche), max: nombre.format(pvMax) })
                  : t("tools.retribution.hpHidden")}
              </span>
              <span className={reglage.repere ? "text-gold-400" : "text-chalk-500"}>
                {reglage.repere ? t("tools.retribution.marker", { degats: nombre.format(seuil) }) : t("tools.retribution.noMarker")}
              </span>
            </div>
          </div>

          <button
            ref={bouton}
            type="button"
            onPointerDown={(e) => {
              if (e.button === 0) frapper();
            }}
            onClick={(e) => {
              // Clic clavier (Entree) ou d'aide technique ; le pointeur est deja traite a l'appui.
              if (e.detail === 0 && horodatage() - jeu.current.derniereTouche > BLOCAGE_MS) frapper();
            }}
            aria-keyshortcuts="Space"
            aria-describedby={ids.aide}
            className={cn(
              "group flex w-full touch-manipulation select-none flex-col items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400",
              phase === "pret" && "cursor-wait",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "relative grid size-28 place-items-center rounded-full border-4 bg-night-950 transition-[border-color,box-shadow,transform] duration-150 group-active:scale-95 sm:size-32",
                phase === "combat" && "border-gold-400 shadow-[0_0_36px_rgba(245,196,81,0.6)]",
                phase === "pret" && "border-night-600",
                (phase === "attente" || phase === "resultat" || phase === "bilan") &&
                  "border-azure-400 shadow-[0_0_24px_rgba(77,163,255,0.35)] group-hover:shadow-[0_0_34px_rgba(77,163,255,0.55)]",
              )}
            >
              {phase === "combat" && <span className="absolute -inset-2 animate-ping rounded-full border-2 border-gold-400/50" />}
              {/* eslint-disable-next-line @next/next/no-img-element -- icone locale du sort */}
              <img
                src={ICONE_CHATIMENT}
                alt=""
                width={100}
                height={100}
                className={cn("size-full rounded-full object-cover p-1", phase === "pret" && "opacity-40 grayscale")}
              />
              {phase === "pret" && (
                <span className="absolute -inset-1 animate-spin rounded-full border-4 border-transparent border-t-gold-400" />
              )}
            </span>
            <span
              className={cn(
                "flex items-center gap-2 font-heading text-2xl font-bold uppercase tracking-wide",
                phase === "combat" ? "text-gold-400" : phase === "pret" ? "text-chalk-400" : "text-azure-400",
              )}
            >
              <Zap size={22} aria-hidden />
              {libelleBouton}
            </span>
          </button>
          <p id={ids.aide} className="text-center text-xs text-chalk-500">
            {t("tools.retribution.help")}
          </p>

          {dernier && (
            <div
              className={cn(
                "bevel-sm border p-4",
                dernier.issue === "securise" ? "border-gold-500/50 bg-gold-500/10" : "border-blood-500/50 bg-blood-500/10",
              )}
            >
              <p className={cn("font-heading text-xl font-bold", dernier.issue === "securise" ? "text-gold-400" : "text-blood-500")}>
                {verdict(dernier).titre}
              </p>
              <p className="mt-1 text-sm text-chalk-200">{verdict(dernier).detail}</p>
              {manche && (dernier.issue === "securise" || dernier.issue === "vole") && (
                <LigneTemps
                  vous={dernier.issue === "securise" ? dernier.reaction : null}
                  adverse={dernier.reactionAdverse ?? manche.reactionAdverse}
                  t={t}
                  nombre={nombre}
                />
              )}
            </div>
          )}
          <p role="status" aria-live="polite" className="sr-only">
            {annonce}
          </p>
        </div>
      </section>

      {bilan && (
        <Carte className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("tools.retribution.summaryTitle")}</h2>
            {nouveauRecord && (
              <span className="bevel-sm inline-flex items-center gap-1.5 bg-gold-500 px-3 py-1 font-heading text-sm font-bold text-night-950">
                <Trophy size={15} aria-hidden />
                {t("tools.retribution.newRecord")}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.points")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-gold-400">{nombre.format(bilan.total)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.secured")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-chalk-100">
                {bilan.securises}/{bilan.manches}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.bestReaction")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-chalk-100">
                {bilan.meilleureReaction === null ? "—" : `${nombre.format(bilan.meilleureReaction)} ms`}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("tools.retribution.averageAccuracy")}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-chalk-100">
                {bilan.precisionMoyenne === null ? "—" : pourcent.format(bilan.precisionMoyenne)}
              </dd>
            </div>
          </dl>

          <figure>
            <figcaption className="text-xs uppercase tracking-wide text-chalk-500">
              {t("tools.retribution.summaryChart")}
            </figcaption>
            <ol className="mt-3 flex h-44 items-end gap-2 sm:gap-4">
              {resultats.map((r, i) => {
                const reussi = r.issue === "securise";
                return (
                  <li key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className={cn("text-sm font-bold tabular-nums", reussi ? "text-gold-400" : "text-blood-500")}>
                      {reussi ? nombre.format(r.points) : <Skull size={16} aria-hidden />}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "bevel-sm w-full",
                        reussi ? "bg-gradient-to-t from-gold-600 to-gold-400" : "bg-blood-500/40",
                      )}
                      style={{ height: `${Math.max(4, (r.points / 1000) * 72)}%` }}
                    />
                    <span className="text-xs tabular-nums text-chalk-500">{i + 1}</span>
                    <span className="sr-only">{verdict(r).titre}</span>
                  </li>
                );
              })}
            </ol>
          </figure>

          {(filmage || video) && (
            <div role="group" aria-label={t("tools.retribution.previewFormat")} className="flex flex-wrap gap-2">
              <Puce actif={vue === "video"} dense onClick={() => setVue("video")}>
                <Film size={14} aria-hidden className="-mt-0.5 mr-1.5 inline" />
                {t("tools.retribution.videoPreview")}
              </Puce>
              <Puce actif={vue === "image"} dense onClick={() => setVue("image")}>
                <ImageIcon size={14} aria-hidden className="-mt-0.5 mr-1.5 inline" />
                {t("tools.retribution.imagePreview")}
              </Puce>
            </div>
          )}
          {vue === "video" && video ? (
            <video
              key={video.url}
              src={video.url}
              width={LARGEUR_CARTE}
              height={HAUTEUR_CARTE}
              autoPlay={!reduit}
              controls={reduit}
              loop
              muted
              playsInline
              aria-label={`${t("tools.retribution.mapTitle")} — ${texte}`}
              className="bevel h-auto w-full border border-night-700 bg-night-950"
            />
          ) : vue === "video" && filmage ? (
            <div
              role="status"
              className="bevel grid aspect-[1200/630] w-full place-items-center border border-night-700 bg-night-950 text-sm text-chalk-400"
            >
              <span className="flex items-center gap-3">
                <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-night-600 border-t-gold-400" />
                {t("tools.retribution.videoPreparing")}
              </span>
            </div>
          ) : (
            apercu && (
              // eslint-disable-next-line @next/next/no-img-element -- image generee dans le navigateur (URL blob)
              <img
                src={apercu}
                width={LARGEUR_CARTE}
                height={HAUTEUR_CARTE}
                alt={`${t("tools.retribution.mapTitle")} — ${texte}`}
                className="bevel h-auto w-full border border-night-700"
              />
            )
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={partager}
              className="bevel-sm inline-flex items-center gap-2 bg-gold-500 px-4 py-2 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
            >
              <Share2 size={16} aria-hidden />
              {t("tools.retribution.share")}
            </button>
            <button
              type="button"
              onClick={copier}
              className="bevel-sm inline-flex items-center gap-2 border border-night-600 px-4 py-2 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
            >
              <Copy size={16} aria-hidden />
              {t("tools.retribution.copy")}
            </button>
            {apercu && (
              <a
                href={apercu}
                download="mlbbdex-retribution.png"
                className="bevel-sm inline-flex items-center gap-2 border border-night-600 px-4 py-2 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <Download size={16} aria-hidden />
                {t("tools.retribution.download")}
              </a>
            )}
            {video && (
              <a
                href={video.url}
                download={`mlbbdex-retribution.${video.extension}`}
                className="bevel-sm inline-flex items-center gap-2 border border-night-600 px-4 py-2 text-sm font-semibold text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
              >
                <Film size={16} aria-hidden />
                {t("tools.retribution.downloadVideo")}
              </a>
            )}
          </div>
          <p role="status" className="min-h-5 text-sm text-chalk-400">
            {partage === "copie" && t("tools.retribution.copied")}
            {partage === "erreur" && t("tools.retribution.shareError")}
          </p>
        </Carte>
      )}

      <Carte>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-chalk-100">
          <Trophy size={18} aria-hidden className="text-gold-400" />
          {t("tools.retribution.recordsTitle")}
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="bevel-sm border border-gold-500/30 bg-gold-500/5 p-3">
            <dt className="text-chalk-500">
              {t("tools.retribution.recordSetting", { objectif: nomObjectif(objectif), difficulte: nomDifficulte(difficulte) })}
            </dt>
            <dd className="mt-1 font-heading text-2xl font-bold tabular-nums text-gold-400">
              {record ? nombre.format(record.total) : "—"}
            </dd>
          </div>
          <div className="bevel-sm border border-night-700/70 bg-night-950/40 p-3">
            <dt className="text-chalk-500">{t("tools.retribution.currentRun")}</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-heading text-2xl font-bold tabular-nums text-chalk-100">
              <Flame size={18} aria-hidden className={records.enCours > 0 ? "text-gold-400" : "text-chalk-600"} />
              {nombre.format(records.enCours)}
            </dd>
          </div>
          <div className="bevel-sm border border-night-700/70 bg-night-950/40 p-3">
            <dt className="text-chalk-500">{t("tools.retribution.bestRun")}</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-heading text-2xl font-bold tabular-nums text-chalk-100">
              <Crown size={18} aria-hidden className="text-chalk-500" />
              {nombre.format(records.meilleureSuite)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-chalk-500">{t("tools.retribution.localRecords")}</p>
      </Carte>
    </div>
  );
}
