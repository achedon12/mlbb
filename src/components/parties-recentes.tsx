"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { useLangue, useT } from "@/i18n/fournisseur";
import { partiesSuivantes, type SuiteParties } from "@/lib/actions-profil";
import { LANE_JEU, formaterDatePartie, formaterNombre, pluriel } from "@/lib/format-joueur";
import type { PartieAffichee } from "@/lib/profil-joueur";
import { cn } from "@/lib/utils";

/**
 * Dernieres parties du joueur, page apres page.
 *
 * La premiere page arrive avec le profil, rendue cote serveur ; les suivantes
 * sont demandees a une action serveur avec le seul curseur de pagination, et
 * s'ajoutent a la liste sans recharger le reste du profil.
 */
export function PartiesRecentes({
  saison,
  initiales,
  suivant: suivantInitial,
}: {
  saison: number;
  initiales: PartieAffichee[];
  suivant: string | null;
}) {
  const t = useT();
  const langue = useLangue();
  const [parties, setParties] = useState(initiales);
  const [suivant, setSuivant] = useState(suivantInitial);
  const [erreur, setErreur] = useState<"expire" | "indisponible" | null>(null);
  const [enCours, demarrer] = useTransition();

  const charger = () => {
    const curseur = suivant;
    if (!curseur) return;
    demarrer(async () => {
      const suite: SuiteParties = await partiesSuivantes(saison, curseur).catch(() => ({ etat: "indisponible" }));
      if (suite.etat !== "ok") {
        setErreur(suite.etat);
        return;
      }
      setErreur(null);
      setParties((avant) => {
        const vues = new Set(avant.map((p) => p.id));
        return [...avant, ...suite.parties.filter((p) => !vues.has(p.id))];
      });
      // Un curseur qui ne bouge pas redemanderait la meme page sans fin.
      setSuivant(suite.suivant && suite.suivant !== curseur ? suite.suivant : null);
    });
  };

  if (parties.length === 0) {
    return <p className="mt-6 text-sm text-chalk-500">{t("pages.accountProfile.partiesVide")}</p>;
  }

  return (
    <div className="mt-6">
      <ol aria-label={t("pages.accountProfile.partiesTitre")} className="divide-y divide-night-800 border-y border-night-800">
        {parties.map((p) => (
          <LignePartie key={p.id} partie={p} />
        ))}
      </ol>
      <p aria-live="polite" className="sr-only">
        {t(`pages.accountProfile.partiesAffichees.${pluriel(parties.length, langue)}`, { n: parties.length })}
      </p>

      {erreur && (
        <p role="alert" className="bevel-sm mt-4 border border-blood-500/40 bg-blood-500/10 px-4 py-3 text-sm text-blood-500">
          {erreur === "expire" ? (
            <>
              {t("pages.accountProfile.expireTexte")}{" "}
              <Link href="/login" className="font-semibold underline underline-offset-4">
                {t("pages.accountProfile.seReconnecter")}
              </Link>
            </>
          ) : (
            t("pages.accountProfile.erreurChargement")
          )}
        </p>
      )}

      {suivant ? (
        <button
          type="button"
          onClick={charger}
          disabled={enCours || erreur === "expire"}
          className="bevel-sm mt-5 flex w-full items-center justify-center gap-2 border border-night-700 px-6 py-2.5 text-sm font-semibold text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400 disabled:opacity-60 sm:w-auto"
        >
          {enCours ? (
            <LoaderCircle size={16} className="animate-spin" aria-hidden />
          ) : (
            <ChevronDown size={16} aria-hidden />
          )}
          {enCours ? t("pages.accountProfile.chargement") : t("pages.accountProfile.voirPlus")}
        </button>
      ) : (
        <p className="mt-4 text-xs text-chalk-500">{t("pages.accountProfile.toutAffiche")}</p>
      )}
    </div>
  );
}

function LignePartie({ partie: p }: { partie: PartieAffichee }) {
  const t = useT();
  const langue = useLangue();
  const issue = p.victoire === null ? "inconnue" : p.victoire ? "victoire" : "defaite";
  const couleur = p.victoire === null ? "text-chalk-400" : p.victoire ? "text-emerald-400" : "text-blood-500";
  const lane = p.lane !== null ? LANE_JEU[p.lane] : undefined;

  return (
    <li className="flex items-center gap-3 py-3">
      {/* Liseré de couleur : un repere de plus, l'issue est aussi ecrite en toutes lettres. */}
      <span
        aria-hidden
        className={cn(
          "w-1 shrink-0 self-stretch",
          p.victoire === null ? "bg-night-700" : p.victoire ? "bg-emerald-400" : "bg-blood-500",
        )}
      />
      <PortraitHeros source={p.heros.portrait} nom={p.heros.nom} taille="icone" decoratif />

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          {p.heros.slug ? (
            <Link
              href={`/heroes/${p.heros.slug}`}
              className="truncate font-semibold text-chalk-100 transition-colors hover:text-gold-400"
            >
              {p.heros.nom}
            </Link>
          ) : (
            <span className="truncate font-semibold text-chalk-100">{p.heros.nom}</span>
          )}
          {p.mvp && (
            <span className="bevel-sm shrink-0 bg-gold-500 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-night-950">
              {t("pages.accountProfile.mvp")}
            </span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-chalk-500">
          {lane && <span>{t(`lanes.${lane}`)}</span>}
          {p.note !== null && <span>{t("pages.accountProfile.note", { n: formaterNombre(p.note, langue, 1) })}</span>}
          {p.date !== null && <DatePartie secondes={p.date} />}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold", couleur)}>{t(`pages.accountProfile.issue.${issue}`)}</p>
        <p className="mt-0.5 text-xs tabular-nums text-chalk-300">
          <span aria-hidden>{`${p.eliminations} / ${p.morts} / ${p.assistances}`}</span>
          <span className="sr-only">
            {t("pages.accountProfile.kda", { k: p.eliminations, d: p.morts, a: p.assistances })}
          </span>
        </p>
      </div>
    </li>
  );
}

const rienAEcouter = () => () => {};

/**
 * Date d'une partie. Faux au rendu serveur et a l'hydratation, vrai ensuite :
 * l'heure locale n'apparait qu'une fois le fuseau du lecteur connu, sans
 * desaccord entre le HTML du serveur et celui du navigateur.
 */
function DatePartie({ secondes }: { secondes: number }) {
  const langue = useLangue();
  const hydrate = useSyncExternalStore(rienAEcouter, () => true, () => false);
  return (
    <time dateTime={new Date(secondes * 1000).toISOString()}>{formaterDatePartie(secondes, langue, hydrate)}</time>
  );
}
