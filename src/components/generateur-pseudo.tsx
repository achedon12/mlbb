"use client";

import { Check, Copy, Shuffle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { classesPuce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import {
  DECORATIONS,
  LONGUEUR_GUIDE,
  SAISIE_MAX,
  STYLES,
  compter,
  decorer,
  nettoyer,
  styliser,
  tirerAuHasard,
  type Decoration,
  type Style,
} from "@/lib/pseudos";
import { cn } from "@/lib/utils";

/**
 * Generateur de pseudos stylises : le nom tape s'affiche dans tous les styles,
 * chacun copiable d'un geste. Tout se fait dans le navigateur ; rien n'est
 * envoye.
 */

/** Duree d'affichage de la confirmation de copie. */
const DUREE_BULLE_MS = 2500;

/**
 * Copie dans le presse-papiers. L'API moderne echoue hors contexte securise ou
 * sans permission (certains navigateurs integres) : on retombe alors sur une
 * zone de texte cachee, puis on avoue l'echec.
 */
async function copierTexte(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    try {
      const zone = document.createElement("textarea");
      zone.value = texte;
      zone.setAttribute("readonly", "");
      zone.style.position = "fixed";
      zone.style.opacity = "0";
      document.body.appendChild(zone);
      zone.select();
      const ok = document.execCommand("copy");
      zone.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const boutonCopie =
  "biseau-sm inline-flex size-11 shrink-0 items-center justify-center border border-nuit-600 text-craie-300 transition-colors hover:border-or-500 hover:text-or-400";

export function GenerateurPseudo() {
  const t = useT();
  const langue = useLangue();
  const nombre = new Intl.NumberFormat(LOCALE_HTML[langue]);
  const idSaisie = useId();
  const idAide = useId();
  const [saisie, setSaisie] = useState(() => t("pages.pseudoUI.exemple"));
  const [style, setStyle] = useState<Style>("gras");
  const [decoration, setDecoration] = useState<Decoration>(DECORATIONS[0]);
  const [bulle, setBulle] = useState<{ texte: string; echec: boolean } | null>(null);
  const [copie, setCopie] = useState<Style | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(minuterie.current), []);

  const nom = nettoyer(saisie);
  const final = (s: Style) => decorer(styliser(nom, s), decoration);
  const choisi = final(style);
  const longueur = compter(choisi);

  async function copier(s: Style) {
    const texte = final(s);
    if (!texte) return;
    setStyle(s);
    const ok = await copierTexte(texte);
    setBulle(ok ? { texte: t("pages.pseudoUI.copie", { pseudo: texte }), echec: false } : { texte: t("pages.pseudoUI.echecCopie"), echec: true });
    setCopie(ok ? s : null);
    clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => {
      setBulle(null);
      setCopie(null);
    }, DUREE_BULLE_MS);
  }

  function auHasard() {
    const tirage = tirerAuHasard();
    setStyle(tirage.style);
    setDecoration(tirage.decoration);
  }

  return (
    <div className="space-y-6">
      <Carte>
        <label htmlFor={idSaisie} className="text-xs uppercase tracking-wide text-craie-500">
          {t("pages.pseudoUI.saisie")}
        </label>
        <div className="mt-1.5 flex flex-wrap gap-3">
          <input
            id={idSaisie}
            type="text"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            maxLength={SAISIE_MAX * 2}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={idAide}
            className="biseau-sm min-h-11 min-w-0 flex-1 basis-56 border border-nuit-700 bg-nuit-900 px-3 py-2.5 text-lg text-craie-100 outline-none transition-colors focus:border-or-500"
          />
          <button
            type="button"
            onClick={auHasard}
            className="biseau-sm inline-flex min-h-11 items-center justify-center gap-2 bg-or-500 px-4 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
          >
            <Shuffle size={16} aria-hidden />
            {t("pages.pseudoUI.hasard")}
          </button>
        </div>
        <p id={idAide} className="mt-2 text-xs leading-relaxed text-craie-500">
          {t("pages.pseudoUI.aide")}
        </p>

        <fieldset className="mt-5">
          <legend className="text-xs uppercase tracking-wide text-craie-500">{t("pages.pseudoUI.decorations")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DECORATIONS.map((d) => {
              const actif = d.cle === decoration.cle;
              return (
                <button
                  key={d.cle}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setDecoration(d)}
                  className={cn(classesPuce(actif), "inline-flex min-h-11 min-w-11 items-center justify-center")}
                >
                  {d.cle === "aucune" ? (
                    t("pages.pseudoUI.aucune")
                  ) : (
                    <>
                      <span aria-hidden className="whitespace-nowrap">
                        {d.avant}
                        <span className="px-0.5 opacity-50">·</span>
                        {d.apres}
                      </span>
                      <span className="sr-only">{t(`pages.pseudoUI.decoration.${d.cle}`)}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Carte>

      {nom === "" ? (
        <Carte>
          <p className="text-sm text-craie-300">{t("pages.pseudoUI.vide")}</p>
        </Carte>
      ) : (
        <>
          <Carte className="border-or-500/30">
            <p className="text-xs uppercase tracking-wide text-craie-500">
              {t("pages.pseudoUI.styleChoisi", { style: t(`pages.pseudoUI.style.${style}`) })}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <p className="min-w-0 flex-1 break-all font-sans text-3xl leading-snug text-or-400 sm:text-4xl">{choisi}</p>
              <button
                type="button"
                onClick={() => copier(style)}
                className="biseau-sm inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-or-500 px-4 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
              >
                {copie === style ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                {t("pages.pseudoUI.copier")}
              </button>
            </div>
            <p className="mt-3 text-sm text-craie-300">
              <span className="tabular-nums">{t("pages.pseudoUI.longueur", { n: nombre.format(longueur.pointsDeCode) })}</span>
              {longueur.unitesUtf16 !== longueur.pointsDeCode && (
                <span className="text-craie-500"> · {t("pages.pseudoUI.unites", { u: nombre.format(longueur.unitesUtf16) })}</span>
              )}
            </p>
            {longueur.pointsDeCode > LONGUEUR_GUIDE.max && (
              <p className="mt-1 text-sm text-sang-500">{t("pages.pseudoUI.auDela", { max: LONGUEUR_GUIDE.max })}</p>
            )}
            <p className="mt-3 border-t border-nuit-800 pt-3 text-xs leading-relaxed text-craie-500">{t("pages.pseudoUI.note")}</p>
          </Carte>

          <section aria-labelledby="styles-titre">
            <h2 id="styles-titre" className="font-titre text-xl font-bold text-craie-100">
              {t("pages.pseudoUI.stylesTitre")}
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {STYLES.map((s) => {
                const texte = final(s);
                const nomStyle = t(`pages.pseudoUI.style.${s}`);
                const actif = s === style;
                return (
                  <li key={s} className="relative">
                    {/* Le biseau rogne ses enfants : il reste sur un calque de fond. */}
                    <div
                      aria-hidden
                      className={cn(
                        "biseau-sm absolute inset-0 border bg-nuit-900/60 transition-colors",
                        actif ? "border-or-500/70" : "border-nuit-700/70",
                      )}
                    />
                    <div className="relative flex items-center gap-2 p-2">
                      <button
                        type="button"
                        aria-pressed={actif}
                        onClick={() => setStyle(s)}
                        className="min-h-11 min-w-0 flex-1 px-1 text-left"
                      >
                        <span className="block break-all font-sans text-lg leading-snug text-craie-100">{texte}</span>
                        <span className="block text-xs text-craie-500">{nomStyle}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copier(s)}
                        aria-label={t("pages.pseudoUI.copierStyle", { style: nomStyle })}
                        className={boutonCopie}
                      >
                        {copie === s ? <Check size={18} aria-hidden className="text-or-400" /> : <Copy size={18} aria-hidden />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* Bulle de confirmation : region vivante toujours presente, pour que son contenu soit annonce. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4"
      >
        {bulle && (
          <p
            className={cn(
              "max-w-full break-all border px-4 py-2.5 text-sm font-medium shadow-lg shadow-black/40",
              bulle.echec ? "border-sang-500/60 bg-nuit-900 text-craie-100" : "border-or-500/60 bg-nuit-900 text-craie-100",
            )}
          >
            {bulle.texte}
          </p>
        )}
      </div>
    </div>
  );
}
