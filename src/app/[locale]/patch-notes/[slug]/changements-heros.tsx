import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { herosParSlug } from "@/lib/donnees";
import { historiqueDe } from "@/lib/evolution";
import { grouperAjustements, SENS_AJUSTEMENT, type SensAjustement } from "@/lib/rapport-meta";
import { impactsDuPatch, JOURS_IMPACT, SEUIL_IMPACT, type ImpactAjustement } from "@/lib/tendances";
import type { PatchDetaille } from "@/lib/types";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { cn } from "@/lib/utils";

const STYLE: Record<SensAjustement, { couleur: string; bordure: string; icone: React.ReactNode }> = {
  amelioration: { couleur: "text-emerald-400", bordure: "border-emerald-500/30", icone: <TrendingUp size={16} aria-hidden /> },
  affaiblissement: { couleur: "text-sang-500", bordure: "border-sang-500/30", icone: <TrendingDown size={16} aria-hidden /> },
  ajustement: { couleur: "text-azur-400", bordure: "border-azur-500/30", icone: <Minus size={16} aria-hidden /> },
};

/** Nombre de heros distincts touches par un patch. */
export function nombreHerosModifies(patch: Pick<PatchDetaille, "ajustements">): number {
  const groupes = grouperAjustements(patch.ajustements);
  return SENS_AJUSTEMENT.reduce((n, sens) => n + groupes[sens].length, 0);
}

/**
 * Toutes les modifications de heros d'un patch, en trois listes : ameliores,
 * affaiblis, ajustes. Rendues par le serveur, avec un lien vers chaque fiche :
 * la liste detaillee plus bas ne montre les siens qu'une fois depliee. Quand
 * l'historique des taux couvre le patch, chaque heros porte son taux de
 * victoire moyen des sept jours d'avant et d'apres ; sinon, rien.
 */
export function ChangementsHeros({
  patch,
  langue,
  ancreDetail,
}: {
  patch: PatchDetaille;
  langue: Langue;
  /** Ancre de la section detaillee des ajustements, quand le patch en a une. */
  ancreDetail: string | null;
}) {
  const t = creerT(langue);
  const groupes = grouperAjustements(patch.ajustements);
  const impacts = impactsDuPatch(patch, historiqueDe);
  const n = nombreHerosModifies(patch);
  const forme = new Intl.PluralRules(langue).select(n) === "one" ? "one" : "other";
  const pourcent = new Intl.NumberFormat(langue, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const taux = (v: number) => pourcent.format(v / 100);

  return (
    <section aria-labelledby="changements-heros" className="mt-10">
      <h2 id="changements-heros" className="scroll-mt-24 font-titre text-2xl font-bold text-craie-100">
        {t("pages.patchNotes.changements.titre", { v: patch.version })}
      </h2>
      <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
      <p className="mt-4 text-sm text-craie-300">
        {t(`pages.patchNotes.changements.resume.${forme}`, { n, v: patch.version })}
        {ancreDetail && (
          <>
            {" "}
            <a href={`#${ancreDetail}`} className="font-semibold text-or-400 hover:text-or-500">
              {t("pages.patchNotes.changements.detail")} ↓
            </a>
          </>
        )}
      </p>

      <div className="mt-6 space-y-6">
        {SENS_AJUSTEMENT.map((sens) =>
          groupes[sens].length === 0 ? null : (
            <div key={sens}>
              <h3 className={cn("flex items-center gap-2 font-titre text-lg font-bold", STYLE[sens].couleur)}>
                {STYLE[sens].icone}
                {t(`patchHeros.pluriel.${sens}`)}
                <span className="text-sm font-medium text-craie-500">{groupes[sens].length}</span>
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {groupes[sens].map((a) => {
                  const fiche = herosParSlug.get(a.slug);
                  const impact = impacts[a.slug];
                  const contenu = (
                    <>
                      <PortraitHeros
                        source={fiche?.visuels.icone ?? fiche?.visuels.portrait ?? null}
                        nom={fiche?.nom ?? a.nom}
                        taille="micro"
                        decoratif
                      />
                      <span className="font-medium text-craie-100">{fiche?.nom ?? a.nom}</span>
                      {impact && <Impact impact={impact} taux={taux} sr={t} />}
                    </>
                  );
                  const classes = cn(
                    "biseau-sm flex items-center gap-2 border bg-nuit-900/60 py-1 pl-1 pr-2.5 text-sm",
                    STYLE[sens].bordure,
                  );
                  return (
                    <li key={a.slug}>
                      {fiche ? (
                        <Link href={`/heroes/${a.slug}`} className={cn(classes, "transition-colors hover:border-or-500/60")}>
                          {contenu}
                        </Link>
                      ) : (
                        <span className={classes}>{contenu}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
        )}
      </div>

      {Object.keys(impacts).length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-craie-500">
          {t("pages.patchNotes.changements.noteImpact", { n: JOURS_IMPACT })}
        </p>
      )}
    </section>
  );
}

/** « 51,2 % → 52,4 % » : la couleur suit le sens de l'ecart, au-dela du bruit. */
function Impact({
  impact,
  taux,
  sr,
}: {
  impact: ImpactAjustement;
  taux: (v: number) => string;
  sr: ReturnType<typeof creerT>;
}) {
  const net = Math.abs(impact.ecart) >= SEUIL_IMPACT - 1e-9;
  return (
    <span className="whitespace-nowrap text-xs tabular-nums">
      <span aria-hidden>
        <span className="text-craie-500">{taux(impact.avant)} → </span>
        <span
          className={cn(
            "font-semibold",
            !net ? "text-craie-300" : impact.ecart > 0 ? "text-emerald-400" : "text-sang-500",
          )}
        >
          {taux(impact.apres)}
        </span>
      </span>
      <span className="sr-only">
        {sr("pages.patchNotes.changements.impact", { avant: taux(impact.avant), apres: taux(impact.apres) })}
      </span>
    </span>
  );
}
