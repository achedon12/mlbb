import { CircleAlert, ShieldAlert, ThumbsDown, Trophy } from "lucide-react";
import { BadgeRang } from "@/components/badge-rang";
import Link from "@/components/lien";
import { PortraitHeros } from "@/components/portrait-heros";
import { classesPuce } from "@/components/puce";
import { Carte } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import type { T } from "@/i18n/traductions";
import { reconnecter } from "@/lib/actions";
import { formaterEcart, formaterNombre, formaterPourcent, pluriel } from "@/lib/format-joueur";
import type { StatsJoueur } from "@/lib/joueur-api";
import {
  MARGE_POINTS,
  PARTIES_MIN,
  type BilanSaison,
  type Bourreau,
  type HerosAffiche,
  type LigneHeros,
} from "@/lib/profil-joueur";
import type { RangLisible } from "@/lib/rangs";
import type { RangMesure } from "@/lib/rangs-mesure";
import { mesureLe } from "@/lib/tier-list";
import { cn, formaterDate } from "@/lib/utils";

/**
 * Blocs du profil de joueur.
 *
 * Composants serveur sans etat : ils recoivent des donnees deja lues et la
 * fonction de traduction, si bien que les tests les rendent avec des reponses
 * d'exemple, sans session ni appel au service.
 */

/** Section du profil : titre, filet dore, chapeau facultatif. */
export function SectionProfil({
  id,
  titre,
  chapeau,
  children,
}: {
  id: string;
  titre: string;
  chapeau?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 id={id} className="font-titre text-2xl font-bold text-craie-100">
        {titre}
      </h2>
      <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
      {chapeau && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-craie-500">{chapeau}</p>}
      {children}
    </section>
  );
}

/**
 * Etat de page entiere : session expiree, source coupee ou compte sans
 * partie. Chacun dit quoi faire — se reconnecter, attendre, aller jouer.
 */
export function EtatProfil({ type, t }: { type: "expiree" | "indisponible" | "vide"; t: T }) {
  const cles = {
    expiree: ["expireTitre", "expireTexte"],
    indisponible: ["indispoTitre", "indispoTexte"],
    vide: ["videTitre", "videTexte"],
  }[type];

  return (
    <Carte className="border-or-500/30">
      <h1 className="flex items-center gap-2 font-titre text-xl font-bold text-or-400">
        <CircleAlert size={20} aria-hidden />
        {t(`pages.accountProfile.${cles[0]}`)}
      </h1>
      <p className="mt-3 leading-relaxed text-craie-300">{t(`pages.accountProfile.${cles[1]}`)}</p>
      {type === "expiree" ? (
        <form action={reconnecter} className="mt-5">
          <button
            type="submit"
            className="biseau-sm bg-or-500 px-4 py-2 text-sm font-semibold text-nuit-950 transition-colors hover:bg-or-400"
          >
            {t("pages.accountProfile.seReconnecter")}
          </button>
        </form>
      ) : (
        <Link
          href="/account"
          className="mt-5 inline-block text-sm text-craie-500 underline underline-offset-4 transition-colors hover:text-or-400"
        >
          {t("pages.accountProfile.retourCompte")}
        </Link>
      )}
    </Carte>
  );
}

/** A la place d'une section dont la source ne repond pas : le reste du profil s'affiche. */
export function SectionIndisponible({ t }: { t: T }) {
  return (
    <Carte className="mt-6 border-or-500/25">
      <p className="text-sm leading-relaxed text-craie-300">{t("pages.accountProfile.sectionIndispo")}</p>
    </Carte>
  );
}

/** Choix de la saison : de simples liens, qui marchent sans JavaScript. */
export function NavSaisons({ saisons, courante, t }: { saisons: number[]; courante: number; t: T }) {
  return (
    <nav aria-label={t("pages.accountProfile.choixSaison")} className="mt-6 flex flex-wrap items-center gap-2">
      <span aria-hidden className="mr-1 text-xs uppercase tracking-wide text-craie-500">
        {t("pages.accountProfile.choixSaison")}
      </span>
      {saisons.map((s) => (
        <Link
          key={s}
          href={`/account/profile?saison=${s}`}
          prefetch={false}
          aria-current={s === courante ? "page" : undefined}
          className={classesPuce(s === courante, true)}
        >
          {t("pages.accountProfile.saison", { n: s })}
        </Link>
      ))}
    </nav>
  );
}

function Chiffre({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
      <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
      <dd className="mt-1 font-titre text-2xl font-bold tabular-nums text-or-400">{children}</dd>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-craie-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-craie-100">{children}</dd>
    </div>
  );
}

/** Bilan de la saison, puis, plus discret, celui de toutes les saisons suivies. */
export function BilanJoueur({
  bilan,
  complet,
  rang,
  stats,
  t,
  langue,
}: {
  bilan: BilanSaison;
  complet: boolean;
  rang: RangLisible;
  stats: StatsJoueur | null;
  t: T;
  langue: Langue;
}) {
  const saisons = stats ? [...stats.saisons].sort((a, b) => a - b).map(String) : [];

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="biseau col-span-2 border border-nuit-700/70 bg-nuit-900/60 p-4 lg:col-span-1">
          <dt className="text-xs uppercase tracking-wide text-craie-500">{t("pages.account.rangActuel")}</dt>
          <dd className="mt-2">
            <BadgeRang rang={rang} />
          </dd>
        </div>
        <Chiffre label={t("pages.accountProfile.parties")}>{formaterNombre(bilan.parties, langue)}</Chiffre>
        <Chiffre label={t("pages.heroDetail.stat.tauxVictoire")}>
          {bilan.taux !== null ? formaterPourcent(bilan.taux, langue) : "—"}
        </Chiffre>
        <Chiffre label={t("pages.accountProfile.herosJoues")}>{formaterNombre(bilan.heros, langue)}</Chiffre>
      </dl>
      {!complet && <p className="mt-3 text-xs text-craie-500">{t("pages.accountProfile.bilanPartiel")}</p>}

      {stats && stats.parties > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-craie-300">
            {saisons.length > 0
              ? t("pages.accountProfile.surLesSaisons", {
                  liste: new Intl.ListFormat(LOCALE_HTML[langue], { type: "conjunction" }).format(saisons),
                })
              : t("pages.accountProfile.surToutesSaisons")}
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <Mini label={t("pages.accountProfile.parties")}>{formaterNombre(stats.parties, langue)}</Mini>
            <Mini label={t("pages.heroDetail.stat.tauxVictoire")}>
              {formaterPourcent((stats.victoires / stats.parties) * 100, langue)}
            </Mini>
            {stats.mvp !== null && (
              <Mini label={t("pages.accountProfile.mvp")}>{formaterNombre(stats.mvp, langue)}</Mini>
            )}
            {stats.meilleureSerie !== null && (
              <Mini label={t("pages.accountProfile.meilleureSerie")}>{formaterNombre(stats.meilleureSerie, langue)}</Mini>
            )}
          </dl>
        </div>
      )}
    </>
  );
}

function LienHeros({
  heros,
  className,
  children,
}: {
  heros: HerosAffiche;
  className?: string;
  children: React.ReactNode;
}) {
  return heros.slug ? (
    <Link href={`/heroes/${heros.slug}`} className={className}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

/**
 * Heros les plus joues, face a la moyenne de la tranche. Un tableau : on y
 * compare des colonnes de chiffres, et les lecteurs d'ecran annoncent chaque
 * valeur avec son en-tete.
 */
export function TableauHeros({
  lignes,
  tranche,
  t,
  langue,
}: {
  lignes: LigneHeros[];
  tranche: RangMesure;
  t: T;
  langue: Langue;
}) {
  const repli = lignes.some((l) => l.trancheMoyenne !== null && l.trancheMoyenne !== tranche);

  return (
    <>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("pages.accountProfile.herosTitre")}</caption>
          <thead>
            <tr className="border-b border-nuit-700 text-xs uppercase tracking-wide text-craie-500">
              <th scope="col" className="py-2 pr-2 text-left font-medium">
                {t("pages.accountProfile.colHeros")}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t("pages.accountProfile.vous")}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t("pages.accountProfile.moyenneRang", { rang: t(`rangsMesure.${tranche}`) })}
              </th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">
                {t("pages.accountProfile.ecart")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nuit-800">
            {lignes.map((l) => {
              // En dessous du minimum de parties, l'ecart s'affiche sans couleur : il ne dit rien encore.
              const fiable = l.parties >= PARTIES_MIN && l.ecart !== null;
              const couleur = !fiable
                ? "text-craie-400"
                : l.ecart! >= MARGE_POINTS
                  ? "text-emerald-400"
                  : l.ecart! <= -MARGE_POINTS
                    ? "text-sang-500"
                    : "text-craie-300";
              return (
                <tr key={`${l.heros.slug ?? l.heros.nom}`}>
                  <th scope="row" className="py-2.5 pr-2 text-left font-normal">
                    <LienHeros heros={l.heros} className="group flex min-w-0 items-center gap-2.5">
                      <PortraitHeros source={l.heros.portrait} nom={l.heros.nom} taille="petite" decoratif />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-craie-100 transition-colors group-hover:text-or-400">
                          {l.heros.nom}
                        </span>
                        <span className="block text-xs text-craie-500">
                          {t(`pages.accountProfile.nParties.${pluriel(l.parties, langue)}`, { n: l.parties })}
                        </span>
                      </span>
                    </LienHeros>
                  </th>
                  <td className="whitespace-nowrap px-2 text-right font-semibold tabular-nums text-craie-100">
                    {formaterPourcent(l.taux, langue)}
                  </td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums text-craie-300">
                    {l.moyenne !== null ? (
                      <>
                        {formaterPourcent(l.moyenne, langue)}
                        {l.trancheMoyenne !== tranche && <span aria-hidden>*</span>}
                      </>
                    ) : (
                      <SansMesure t={t} />
                    )}
                  </td>
                  <td className={cn("whitespace-nowrap pl-2 text-right font-semibold tabular-nums", couleur)}>
                    {l.ecart !== null ? `${formaterEcart(l.ecart, langue)} ${t("contres.pts")}` : <SansMesure t={t} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {repli && <p className="mt-3 text-xs text-craie-500">* {t("pages.accountProfile.noteToutRang")}</p>}
      <p className="mt-2 text-xs text-craie-500">
        {t("pages.accountProfile.sourceMoyenne", { date: formaterDate(mesureLe, LOCALE_HTML[langue]) })}
      </p>
    </>
  );
}

function SansMesure({ t }: { t: T }) {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">{t("pages.accountProfile.sansMesure")}</span>
    </>
  );
}

const TONS = { bon: "text-emerald-400", mauvais: "text-sang-500", alerte: "text-or-400" } as const;

function CarteConseil({
  titre,
  texte,
  ton,
  icone,
  children,
}: {
  titre: string;
  texte: string;
  ton: keyof typeof TONS;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
      <h3 className={cn("flex items-center gap-2 font-titre font-bold", TONS[ton])}>
        {icone}
        {titre}
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-craie-500">{texte}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ListeHerosConseil({ entrees, vide }: { entrees: { heros: HerosAffiche; detail: string }[]; vide: string }) {
  if (entrees.length === 0) return <p className="text-sm leading-relaxed text-craie-400">{vide}</p>;
  return (
    <ul className="space-y-1.5">
      {entrees.map(({ heros, detail }) => (
        <li key={heros.slug ?? heros.nom}>
          <LienHeros
            heros={heros}
            className="group flex items-center gap-2.5 rounded-sm px-1 py-1 transition-colors hover:bg-nuit-850"
          >
            <PortraitHeros source={heros.portrait} nom={heros.nom} taille="petite" decoratif />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-craie-100 transition-colors group-hover:text-or-400">
                {heros.nom}
              </span>
              <span className="block text-xs text-craie-500">{detail}</span>
            </span>
          </LienHeros>
        </li>
      ))}
    </ul>
  );
}

/**
 * Conseils : points forts, heros sous la moyenne de la tranche, et les
 * adversaires qui reviennent dans les defaites. Ces derniers demandent le
 * detail de plusieurs parties : la page les passe deja enveloppes dans un
 * `Suspense`, pour que le reste s'affiche sans les attendre.
 */
export function ConseilsHeros({
  lignes,
  meilleurs,
  sousMoyenne,
  tranche,
  adversaires,
  t,
  langue,
}: {
  /** null quand la liste des heros n'a pas pu etre lue. */
  lignes: LigneHeros[] | null;
  meilleurs: LigneHeros[];
  sousMoyenne: LigneHeros[];
  tranche: RangMesure;
  adversaires: React.ReactNode;
  t: T;
  langue: Langue;
}) {
  const rang = t(`rangsMesure.${tranche}`);
  const indispo = t("pages.accountProfile.sectionIndispo");

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <CarteConseil
        ton="bon"
        icone={<Trophy size={17} aria-hidden />}
        titre={t("pages.accountProfile.meilleursTitre")}
        texte={t("pages.accountProfile.meilleursTexte")}
      >
        <ListeHerosConseil
          vide={lignes ? t("pages.accountProfile.meilleursVide") : indispo}
          entrees={meilleurs.map((l) => ({
            heros: l.heros,
            detail: t("pages.accountProfile.meilleurDetail", { taux: formaterPourcent(l.taux, langue), n: l.parties }),
          }))}
        />
      </CarteConseil>

      <CarteConseil
        ton="mauvais"
        icone={<ThumbsDown size={17} aria-hidden />}
        titre={t("pages.accountProfile.sousMoyenneTitre")}
        texte={t("pages.accountProfile.sousMoyenneTexte", { rang })}
      >
        <ListeHerosConseil
          vide={lignes ? t("pages.accountProfile.sousMoyenneVide") : indispo}
          entrees={sousMoyenne.map((l) => ({
            heros: l.heros,
            detail: t("pages.accountProfile.sousMoyenneDetail", {
              taux: formaterPourcent(l.taux, langue),
              moyenne: formaterPourcent(l.moyenne ?? 0, langue),
            }),
          }))}
        />
      </CarteConseil>

      <CarteConseil
        ton="alerte"
        icone={<ShieldAlert size={17} aria-hidden />}
        titre={t("pages.accountProfile.bourreauxTitre")}
        texte={t("pages.accountProfile.bourreauxTexte")}
      >
        {adversaires}
      </CarteConseil>
    </div>
  );
}

/** Adversaires les plus presents dans les defaites recentes. */
export function ListeBourreaux({
  analyse,
  t,
  langue,
}: {
  analyse: { liste: Bourreau[]; analysees: number };
  t: T;
  langue: Langue;
}) {
  if (analyse.analysees === 0) {
    return <p className="text-sm leading-relaxed text-craie-400">{t("pages.accountProfile.bourreauxSansEquipes")}</p>;
  }
  return (
    <>
      <ListeHerosConseil
        vide={t("pages.accountProfile.bourreauxVide")}
        entrees={analyse.liste.map((b) => ({
          heros: b.heros,
          detail: t("pages.accountProfile.bourreauDetail", { d: b.defaites, n: b.rencontres }),
        }))}
      />
      <p className="mt-3 text-xs text-craie-500">
        {t(`pages.accountProfile.bourreauxSource.${pluriel(analyse.analysees, langue)}`, { n: analyse.analysees })}
      </p>
    </>
  );
}

/**
 * Attente d'une section lue a part, annoncee sans interrompre la lecture.
 * `texte` remplace le message par defaut ; `className` reserve la place de la
 * section a venir, pour que la page ne saute pas a son arrivee.
 */
export function AnalyseEnCours({ t, texte, className }: { t: T; texte?: string; className?: string }) {
  return (
    <p role="status" className={cn("animate-pulse text-sm text-craie-500", className)}>
      {texte ?? t("pages.accountProfile.analyseEnCours")}
    </p>
  );
}
