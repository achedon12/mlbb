"use client";

import { useId, useState } from "react";
import { LOCALE_HTML } from "@/i18n/config";
import { useLangue, useT } from "@/i18n/fournisseur";
import { GroupeFiltres, Puce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { calculer, lireNombre, partiesAuRythme, type Situation } from "@/lib/taux-victoire";

/**
 * Calculateur de taux de victoire : combien de victoires d'affilee pour
 * atteindre un objectif, et combien de parties a un rythme donne. Tout se
 * calcule dans le navigateur, a chaque frappe ; aucune requete.
 */
const OBJECTIFS = [50, 55, 60, 65, 70];

function Champ({
  libelle,
  valeur,
  onChange,
  suffixe,
  invalide,
}: {
  libelle: string;
  valeur: string;
  onChange: (valeur: string) => void;
  suffixe?: string;
  invalide: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-chalk-500">
        {libelle}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalide || undefined}
          className="bevel-sm w-full border border-night-700 bg-night-900 py-2.5 pl-3 pr-9 text-lg tabular-nums text-chalk-100 outline-none transition-colors focus:border-gold-500 aria-invalid:border-blood-500/70"
        />
        {suffixe && (
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-chalk-500">
            {suffixe}
          </span>
        )}
      </div>
    </div>
  );
}

export function CalculateurTaux() {
  const t = useT();
  const langue = useLangue();
  const nombre = new Intl.NumberFormat(LOCALE_HTML[langue], { maximumFractionDigits: 2 });
  // Valeurs d'exemple, ecrites avec le separateur decimal de la langue.
  const [parties, setParties] = useState("250");
  const [taux, setTaux] = useState(() => nombre.format(48.5));
  const [objectif, setObjectif] = useState("55");
  const [rythme, setRythme] = useState("60");

  const lus = { parties: lireNombre(parties), taux: lireNombre(taux), objectif: lireNombre(objectif) };
  const situation: Situation = {
    parties: lus.parties ?? Number.NaN,
    taux: lus.taux ?? Number.NaN,
    objectif: lus.objectif ?? Number.NaN,
  };
  const resultat = calculer(situation);
  // « 55 % » en francais, « 55% » en anglais : l'espace suit la langue.
  const pourcentage = new Intl.NumberFormat(LOCALE_HTML[langue], { style: "percent", maximumFractionDigits: 2 });
  const pourcent = (p: number) => pourcentage.format(p / 100);
  const hors = (p: number | null, entier = false) =>
    p !== null && (entier ? !Number.isInteger(p) || p < 1 : p < 0 || p > 100);

  return (
    <div className="space-y-6">
      <Carte>
        <div className="grid gap-4 sm:grid-cols-3">
          <Champ
            libelle={t("outilTaux.parties")}
            valeur={parties}
            onChange={setParties}
            invalide={hors(lus.parties, true)}
          />
          <Champ
            libelle={t("outilTaux.tauxActuel")}
            valeur={taux}
            onChange={setTaux}
            suffixe="%"
            invalide={hors(lus.taux)}
          />
          <Champ
            libelle={t("outilTaux.objectif")}
            valeur={objectif}
            onChange={setObjectif}
            suffixe="%"
            invalide={hors(lus.objectif)}
          />
        </div>
        <GroupeFiltres legende={t("outilTaux.objectifsCourants")} largeurLegende="w-auto" className="mt-5">
          {OBJECTIFS.map((o) => (
            <Puce key={o} dense actif={lus.objectif === o} onClick={() => setObjectif(String(o))}>
              {pourcent(o)}
            </Puce>
          ))}
        </GroupeFiltres>
      </Carte>

      <div aria-live="polite">
        {resultat.etat === "invalide" ? (
          <Carte>
            <p className="text-sm leading-relaxed text-chalk-300">{t("outilTaux.invalide")}</p>
          </Carte>
        ) : (
          <Carte className="border-gold-500/30">
            {resultat.etat === "victoires" && (
              <>
                <Chiffre valeur={nombre.format(resultat.victoires)} unite={t("outilTaux.victoiresAffilee")} />
                <p className="mt-3 leading-relaxed text-chalk-300">
                  {t("outilTaux.phraseVictoires", {
                    n: nombre.format(resultat.victoires),
                    actuel: pourcent(situation.taux),
                    objectif: pourcent(situation.objectif),
                    total: nombre.format(situation.parties + resultat.victoires),
                  })}
                </p>
              </>
            )}
            {resultat.etat === "impossible" && (
              <>
                <p className="font-heading text-2xl font-bold text-blood-500">{t("outilTaux.impossibleTitre")}</p>
                <p className="mt-3 leading-relaxed text-chalk-300">{t("outilTaux.impossible")}</p>
                {(() => {
                  const repli = calculer({ ...situation, objectif: 99 });
                  return repli.etat === "victoires" ? (
                    <p className="mt-2 text-sm leading-relaxed text-chalk-400">
                      {t("outilTaux.impossibleConseil", { objectif: pourcent(99), n: nombre.format(repli.victoires) })}
                    </p>
                  ) : null;
                })()}
              </>
            )}
            {resultat.etat === "atteint" && (
              <>
                <Chiffre
                  valeur={resultat.marge === null ? "∞" : nombre.format(resultat.marge)}
                  unite={t("outilTaux.defaitesEncaissables")}
                />
                <p className="mt-3 leading-relaxed text-chalk-300">
                  {resultat.marge === null
                    ? t("outilTaux.phraseZero")
                    : resultat.marge === 0
                      ? t("outilTaux.phraseLimite", { objectif: pourcent(situation.objectif) })
                      : t("outilTaux.phraseAtteint", {
                          n: nombre.format(resultat.marge),
                          objectif: pourcent(situation.objectif),
                        })}
                </p>
              </>
            )}
            <p className="mt-4 border-t border-night-800 pt-3 text-xs leading-relaxed text-chalk-500">
              {t("outilTaux.base", {
                v: nombre.format(resultat.victoiresActuelles),
                n: nombre.format(situation.parties),
              })}
            </p>
          </Carte>
        )}
      </div>

      {resultat.etat === "victoires" && (
        <Carte>
          <h2 className="font-heading text-lg font-bold text-chalk-100">{t("outilTaux.rythmeTitre")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-chalk-500">{t("outilTaux.rythmeIntro")}</p>
          <div className="mt-4 max-w-48">
            <Champ
              libelle={t("outilTaux.rythme")}
              valeur={rythme}
              onChange={setRythme}
              suffixe="%"
              invalide={hors(lireNombre(rythme))}
            />
          </div>
          <div aria-live="polite" className="mt-4 text-sm leading-relaxed text-chalk-300">
            {(() => {
              const r = lireNombre(rythme);
              if (r === null || hors(r)) return null;
              const m = partiesAuRythme(situation, r);
              return m === null
                ? t("outilTaux.rythmeInsuffisant", { rythme: pourcent(r), objectif: pourcent(situation.objectif) })
                : t("outilTaux.rythmeParties", { n: nombre.format(m), rythme: pourcent(r) });
            })()}
          </div>
        </Carte>
      )}
    </div>
  );
}

function Chiffre({ valeur, unite }: { valeur: string; unite: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-heading text-5xl font-bold tabular-nums text-gold-400">{valeur}</span>
      <span className="text-lg text-chalk-100">{unite}</span>
    </p>
  );
}
