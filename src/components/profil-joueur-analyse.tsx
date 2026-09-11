import Image from "next/image";
import { ArrowRight, Flame, Swords, TrendingDown, Trophy } from "lucide-react";
import { ChoixBuild } from "@/components/choix-build";
import { CourbeTaux } from "@/components/courbe-taux";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import type { Langue } from "@/i18n/config";
import type { T } from "@/i18n/traductions";
import {
  FENETRE_FORME,
  PARTIES_MIN_POSTE,
  type BilanPostes,
  type Evolution,
  type FicheHerosRang,
} from "@/lib/analyse-joueur";
import type { ObjetResolu } from "@/components/builds-par-rang";
import { formaterDatePartie, formaterEcart, formaterNombre, formaterPourcent, pluriel } from "@/lib/format-joueur";
import { MARGE_POINTS, PARTIES_MIN } from "@/lib/profil-joueur";
import type { RangMesure } from "@/lib/rangs-mesure";
import type { Lane, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Analyses du profil de joueur : roles et positions, evolution, et ce que
 * joue le rang du joueur sur ses heros.
 *
 * Composants serveur sans etat, comme ceux de `profil-joueur` : ils recoivent
 * des chiffres deja calcules et la fonction de traduction. Seule la courbe est
 * un composant client ; elle ne recoit que des nombres et des dates.
 */

// ─────────────────────────────────────────────────────────────
// Roles et positions
// ─────────────────────────────────────────────────────────────

/** Tableau des parties par role ou par position, points fort et faible signales. */
export function TableauPostes<C extends Role | Lane>({
  type,
  titre,
  source,
  bilan,
  t,
  langue,
}: {
  type: "roles" | "lanes";
  titre: string;
  source: string;
  bilan: BilanPostes<C>;
  t: T;
  langue: Langue;
}) {
  const nom = (cle: C) => t(`${type}.${cle}`);
  const colonne = type === "roles" ? t("pages.accountProfile.colRole") : t("builds.position");
  const cleEcartees = type === "roles" ? "sansRole" : "sansPosition";

  return (
    <div className="min-w-0">
      <h3 className="font-titre text-lg font-bold text-craie-100">{titre}</h3>
      <p className="mt-1 text-xs leading-relaxed text-craie-500">{source}</p>

      {bilan.lignes.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-craie-400">
          {type === "roles"
            ? t("pages.accountProfile.herosVide")
            : bilan.ecartees > 0
              ? t("pages.accountProfile.positionsVide")
              : t("pages.accountProfile.partiesVide")}
        </p>
      ) : (
        <>
          <div className="mt-4 relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{titre}</caption>
              <thead>
                <tr className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
                  <th scope="col" className="py-2 pr-2 text-left font-medium">
                    {colonne}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    {t("pages.accountProfile.parties")}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    {t("pages.accountProfile.colPart")}
                  </th>
                  <th scope="col" className="py-2 pl-2 text-right font-medium">
                    {t("pages.accountProfile.colVictoire")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nuit-800">
                {bilan.lignes.map((l) => {
                  const fort = l.cle === bilan.fort;
                  const faible = l.cle === bilan.faible;
                  return (
                    <tr key={l.cle}>
                      <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                        <span className="block font-semibold text-craie-100">{nom(l.cle)}</span>
                        {(fort || faible) && (
                          <span
                            className={cn(
                              "mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide",
                              fort ? "text-emerald-400" : "text-sang-500",
                            )}
                          >
                            {fort ? <Trophy size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />}
                            {t(fort ? "pages.accountProfile.pointFort" : "pages.accountProfile.aTravailler")}
                          </span>
                        )}
                      </th>
                      <td className="whitespace-nowrap px-2 text-right tabular-nums text-craie-300">
                        {formaterNombre(l.parties, langue)}
                      </td>
                      <td className="px-2 text-right tabular-nums text-craie-300">
                        <span className="whitespace-nowrap">{formaterPourcent(l.part, langue)}</span>
                        {/* Jauge de la part : un repere de plus, la valeur est ecrite a cote. */}
                        <span aria-hidden className="ml-auto mt-1 block h-1 w-14 max-w-full bg-nuit-800">
                          <span className="block h-full bg-or-500/70" style={{ width: `${Math.min(100, l.part)}%` }} />
                        </span>
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap pl-2 text-right font-semibold tabular-nums",
                          fort ? "text-emerald-400" : faible ? "text-sang-500" : "text-craie-100",
                        )}
                      >
                        {formaterPourcent(l.taux, langue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-craie-300">
            {bilan.fort && bilan.faible
              ? t("pages.accountProfile.postesBilan", {
                  fort: nom(bilan.fort),
                  tauxFort: formaterPourcent(bilan.lignes.find((l) => l.cle === bilan.fort)!.taux, langue),
                  faible: nom(bilan.faible),
                  tauxFaible: formaterPourcent(bilan.lignes.find((l) => l.cle === bilan.faible)!.taux, langue),
                })
              : t("pages.accountProfile.postesPeu", { n: PARTIES_MIN_POSTE })}
          </p>
          {bilan.ecartees > 0 && (
            <p className="mt-2 text-xs text-craie-500">
              {t(`pages.accountProfile.${cleEcartees}.${pluriel(bilan.ecartees, langue)}`, { n: bilan.ecartees })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Evolution
// ─────────────────────────────────────────────────────────────

function Tuile({ label, ton, children }: { label: string; ton?: "bon" | "mauvais"; children: React.ReactNode }) {
  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
      <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-titre text-xl font-bold tabular-nums",
          ton === "bon" ? "text-emerald-400" : ton === "mauvais" ? "text-sang-500" : "text-or-400",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

const jour = (d: string, langue: Langue) => formaterDatePartie(Date.parse(`${d}T00:00:00Z`) / 1000, langue, false);

/** Series et forme recente, puis la courbe du taux de victoire partie apres partie. */
export function EvolutionJoueur({
  evo,
  fin,
  t,
  langue,
}: {
  evo: Evolution;
  /** Vrai quand l'historique lu couvre toute la saison. */
  fin: boolean;
  t: T;
  langue: Langue;
}) {
  if (evo.parties === 0) return <p className="mt-6 text-sm text-craie-500">{t("pages.accountProfile.partiesVide")}</p>;

  const serie = evo.serieEnCours;
  const nombreDe = (n: number) => formaterNombre(n, langue);
  const cleSerie = serie?.victoire ? "serieVictoires" : "serieDefaites";
  const cleSource = fin ? "evolutionSaison" : "evolutionSource";
  const courbe = evo.courbe;
  const resume = courbe
    ? t("pages.accountProfile.courbeResume", {
        f: FENETRE_FORME,
        debut: jour(courbe.dates[0], langue),
        fin: jour(courbe.dates.at(-1)!, langue),
        depart: formaterPourcent(courbe.glissante[0], langue),
        arrivee: formaterPourcent(courbe.glissante.at(-1)!, langue),
        min: formaterPourcent(Math.min(...courbe.glissante), langue),
        max: formaterPourcent(Math.max(...courbe.glissante), langue),
      })
    : "";

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tuile
          label={t("pages.accountProfile.serieEnCours")}
          ton={serie ? (serie.victoire ? "bon" : "mauvais") : undefined}
        >
          {serie ? (
            <span className="inline-flex items-center gap-1.5">
              {serie.victoire && serie.longueur >= 3 && <Flame size={18} aria-hidden />}
              {t(`pages.accountProfile.${cleSerie}.${pluriel(serie.longueur, langue)}`, { n: nombreDe(serie.longueur) })}
            </span>
          ) : (
            "—"
          )}
        </Tuile>
        <Tuile label={t("pages.accountProfile.plusLongueVictoires")}>{nombreDe(evo.meilleureSerie)}</Tuile>
        <Tuile label={t("pages.accountProfile.plusLongueDefaites")}>{nombreDe(evo.pireSerie)}</Tuile>
        <Tuile label={t("pages.accountProfile.dernieresParties", { n: FENETRE_FORME })}>
          {evo.forme !== null ? formaterPourcent(evo.forme, langue) : "—"}
        </Tuile>
      </dl>

      {courbe ? (
        <div className="biseau mt-4 border border-nuit-700/70 bg-nuit-900/60 p-3 sm:p-4">
          <CourbeTaux
            dates={courbe.dates}
            series={[
              {
                nom: t("pages.accountProfile.serieGlissante", { n: FENETRE_FORME }),
                valeurs: courbe.glissante,
                couleur: "text-or-400",
              },
              {
                nom: t("pages.accountProfile.serieCumulee"),
                valeurs: courbe.cumulee,
                couleur: "text-azur-400",
                tirets: true,
              },
            ]}
            decimales={0}
            libelle={resume}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-craie-400">
          {t("pages.accountProfile.courbeCourte", { n: FENETRE_FORME + 1 })}
        </p>
      )}

      <p className="mt-3 text-xs text-craie-500">
        {t(`pages.accountProfile.${cleSource}.${pluriel(evo.parties, langue)}`, {
          n: nombreDe(evo.parties),
          taux: formaterPourcent((evo.victoires / evo.parties) * 100, langue),
        })}
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Ce que joue le rang
// ─────────────────────────────────────────────────────────────

function ObjetIcone({ objet }: { objet: ObjetResolu }) {
  const contenu = (
    <>
      <span className="relative mx-auto block size-9">
        {objet.image ? (
          <Image src={objet.image} alt="" fill unoptimized className="object-contain" />
        ) : (
          <span className="grid size-full place-items-center bg-nuit-800 text-xs text-craie-500">{objet.nom.charAt(0)}</span>
        )}
      </span>
      <span className="mt-1 block text-[0.65rem] leading-tight text-craie-300">{objet.nom}</span>
    </>
  );
  const classe = "biseau-sm block h-full border border-nuit-700 bg-nuit-850 p-1.5 text-center";
  return objet.slug ? (
    <Link href={`/items#${objet.slug}`} className={cn(classe, "transition-colors hover:border-or-500/60")}>
      {contenu}
    </Link>
  ) : (
    <span className={classe}>{contenu}</span>
  );
}

function LienOnglet({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-or-400 underline-offset-4 transition-colors hover:text-or-300 hover:underline"
    >
      {children}
      <ArrowRight size={13} aria-hidden />
    </Link>
  );
}

/**
 * Heros les plus joues face a ce que joue le rang : l'ecart au taux moyen,
 * le build le plus joue a ce rang et les heros qui le mettent en difficulte.
 * Chaque bloc mene a l'onglet correspondant de la fiche du heros.
 */
export function FichesHerosRang({
  fiches,
  tranche,
  t,
  langue,
}: {
  fiches: FicheHerosRang[];
  tranche: RangMesure;
  t: T;
  langue: Langue;
}) {
  const nomRang = (r: RangMesure) => t(`rangsMesure.${r}`);
  const nomEmbleme = (nom: string) => {
    const role = t(`roles.${nom}`);
    return role === `roles.${nom}` ? nom : role;
  };

  return (
    <div className="mt-10">
      <h3 className="font-titre text-lg font-bold text-craie-100">{t("pages.accountProfile.faceRangTitre")}</h3>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-craie-500">
        {t("pages.accountProfile.faceRangIntro", { rang: nomRang(tranche) })}
      </p>

      {fiches.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-craie-400">{t("pages.accountProfile.faceRangVide")}</p>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {fiches.map(({ ligne, lane, build, rangBuild, faibles, rangContres }) => {
            const { slug, nom } = ligne.heros;
            const fiable = ligne.parties >= PARTIES_MIN && ligne.ecart !== null;
            return (
              <li key={slug} className="biseau flex min-w-0 flex-col border border-nuit-700/70 bg-nuit-900/60 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <PortraitHeros source={ligne.heros.portrait} nom={nom} taille="petite" decoratif />
                  <div className="min-w-0">
                    <Link
                      href={`/heroes/${slug}`}
                      className="block truncate font-titre font-bold text-craie-100 transition-colors hover:text-or-400"
                    >
                      {nom}
                    </Link>
                    <p className="text-xs text-craie-500">
                      {t(`pages.accountProfile.nParties.${pluriel(ligne.parties, langue)}`, { n: ligne.parties })}
                      {ligne.moyenne !== null && (
                        <>
                          {" · "}
                          {t("pages.accountProfile.sousMoyenneDetail", {
                            taux: formaterPourcent(ligne.taux, langue),
                            moyenne: formaterPourcent(ligne.moyenne, langue),
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  {ligne.ecart !== null && (
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-sm font-semibold tabular-nums",
                        !fiable
                          ? "text-craie-400"
                          : ligne.ecart >= MARGE_POINTS
                            ? "text-emerald-400"
                            : ligne.ecart <= -MARGE_POINTS
                              ? "text-sang-500"
                              : "text-craie-300",
                      )}
                    >
                      {`${formaterEcart(ligne.ecart, langue)} ${t("contres.pts")}`}
                    </span>
                  )}
                </div>

                {build && rangBuild && (
                  <section className="mt-4 border-t border-nuit-800 pt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-craie-400">
                      {t("pages.accountProfile.buildRang", { rang: nomRang(rangBuild) })}
                    </h4>
                    <p className="mt-0.5 text-xs text-craie-500">
                      {[
                        lane ? t("pages.accountProfile.positionBuild", { lane: t(`lanes.${lane}`) }) : null,
                        build.victoire !== null
                          ? t("builds.victoire", { taux: formaterNombre(build.victoire, langue, 1) })
                          : null,
                        build.selection !== null
                          ? t("builds.selection", { taux: formaterNombre(build.selection, langue, 1) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <ul aria-label={t("builds.objets")} className="mt-2 grid grid-cols-3 gap-1.5">
                      {build.objets.map((o, i) => (
                        <li key={`${o.nom}-${i}`}>
                          <ObjetIcone objet={o} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {build.embleme && (
                        <ChoixBuild
                          libelle={t("builds.embleme")}
                          nom={nomEmbleme(build.embleme.nom)}
                          image={build.embleme.image}
                        />
                      )}
                      {build.sort && (
                        <ChoixBuild libelle={t("builds.sort")} nom={build.sort.nom} image={build.sort.image} />
                      )}
                    </div>
                    {build.talents.length > 0 && (
                      <p className="mt-2 text-xs leading-relaxed text-craie-300">
                        <span className="block text-[0.65rem] uppercase tracking-wide text-craie-500">
                          {t("builds.talents")}
                        </span>
                        {build.talents.map((x) => x.nom).join(", ")}
                      </p>
                    )}
                    <LienOnglet href={`/heroes/${slug}#builds`}>
                      {t("pages.accountProfile.voirBuilds", { nom })}
                    </LienOnglet>
                  </section>
                )}

                {faibles.length > 0 && rangContres && (
                  <section className="mt-4 border-t border-nuit-800 pt-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-craie-400">
                      <Swords size={13} aria-hidden />
                      {t("pages.accountProfile.contresRang", { rang: nomRang(rangContres) })}
                    </h4>
                    <ul className="mt-2 space-y-1">
                      {faibles.map((c) => (
                        <li key={c.heros.slug}>
                          <Link
                            href={`/heroes/${c.heros.slug}`}
                            className="group flex items-center gap-2 rounded-sm px-1 py-0.5 transition-colors hover:bg-nuit-850"
                          >
                            <PortraitHeros source={c.heros.portrait} nom={c.heros.nom} taille="icone" decoratif />
                            <span className="min-w-0 flex-1 truncate text-sm text-craie-100 transition-colors group-hover:text-or-400">
                              {c.heros.nom}
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-sang-500">
                              {`${formaterEcart(c.avantage, langue)} ${t("contres.pts")}`}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <LienOnglet href={`/heroes/${slug}#contres`}>
                      {t("pages.accountProfile.voirContres", { nom })}
                    </LienOnglet>
                  </section>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
