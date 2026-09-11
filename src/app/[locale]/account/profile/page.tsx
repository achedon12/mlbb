import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BadgeRang } from "@/components/badge-rang";
import { FilAriane } from "@/components/fil-ariane";
import { PartiesRecentes } from "@/components/parties-recentes";
import {
  AnalyseEnCours,
  BilanJoueur,
  ConseilsHeros,
  EtatProfil,
  ListeBourreaux,
  NavSaisons,
  SectionIndisponible,
  SectionProfil,
  TableauHeros,
} from "@/components/profil-joueur";
import { EvolutionJoueur, FichesHerosRang, TableauPostes } from "@/components/profil-joueur-analyse";
import type { Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { metaPage } from "@/i18n/seo";
import { creerT, messagesPage, type T } from "@/i18n/traductions";
import {
  FENETRE_FORME,
  PARTIES_MIN_POSTE,
  evolution,
  fichesHerosRang,
  statsParPosition,
  statsParRole,
} from "@/lib/analyse-joueur";
import { pluriel } from "@/lib/format-joueur";
import type { PartieResume } from "@/lib/joueur-api";
import {
  detailsParties,
  herosDeLaSaison,
  historiqueParties,
  pageParties,
  saisons,
  statistiques,
  type Resultat,
} from "@/lib/mlbb-auth";
import {
  PARTIES_ANALYSEES,
  PARTIES_MIN,
  afficherPartie,
  bilanSaison,
  bourreaux,
  comparerHeros,
  herosSousMoyenne,
  meilleursHeros,
  trancheDuRang,
} from "@/lib/profil-joueur";
import { rangLisible } from "@/lib/rangs";
import { sessionJoueur } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    ...metaPage(locale, {
      titre: t("pages.accountProfile.metaTitre"),
      description: t("pages.accountProfile.metaDescription"),
      chemin: "/account/profile",
    }),
    robots: { index: false, follow: false },
  };
}

/** Page personnelle : jamais mise en cache. Les reponses du service le sont, brievement, cote serveur. */
export const dynamic = "force-dynamic";

/** Heros affiches dans le tableau ; le bilan, lui, les compte tous. */
const HEROS_AFFICHES = 10;

type Historique = Promise<Resultat<{ parties: PartieResume[]; fin: boolean }>>;

export default async function PageProfilJoueur({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Langue }>;
  searchParams: Promise<{ saison?: string | string[] }>;
}) {
  const [{ locale }, recherche] = await Promise.all([params, searchParams]);
  const t = creerT(locale);
  const session = await sessionJoueur();
  if (session.etat === "absente") redirect(`/${locale}/login`);

  const cadre = (contenu: React.ReactNode) => (
    <CompleterMessages messages={messagesPage(locale, ["pages.accountProfile"])}>
      <div className="mx-auto max-w-4xl px-4 py-14">
        <FilAriane
          miettes={[{ nom: t("pages.account.metaTitre"), href: "/account" }, { nom: t("pages.accountProfile.titre") }]}
          className="mb-8"
        />
        {contenu}
      </div>
    </CompleterMessages>
  );

  if (session.etat !== "ok") return cadre(<EtatProfil type={session.etat} t={t} />);
  const { jeton, profil } = session;

  // Saisons d'abord : toutes les autres routes les exigent. `/stats` les
  // porte aussi, ce qui sert de repli quand `/season` ne repond pas.
  const [stats, listeSaisons] = await Promise.all([statistiques(jeton), saisons(jeton)]);
  if (stats.etat === "expire" || listeSaisons.etat === "expire") return cadre(<EtatProfil type="expiree" t={t} />);

  const sids =
    listeSaisons.etat === "ok" && listeSaisons.donnees.length > 0
      ? listeSaisons.donnees
      : stats.etat === "ok"
        ? stats.donnees.saisons
        : [];
  if (sids.length === 0) {
    const panne = listeSaisons.etat !== "ok" && stats.etat !== "ok";
    return cadre(<EtatProfil type={panne ? "indisponible" : "vide"} t={t} />);
  }

  const demandee = Number([recherche.saison].flat()[0]);
  const saison = sids.includes(demandee) ? demandee : sids[0];

  const [herosSaison, premiere] = await Promise.all([herosDeLaSaison(jeton, saison), pageParties(jeton, saison, null)]);
  if (herosSaison.etat === "expire" || premiere.etat === "expire") return cadre(<EtatProfil type="expiree" t={t} />);

  // Historique lance ici, attendu plus bas sous `Suspense` : les pages
  // suivantes se lisent pendant que le reste du profil s'affiche. La premiere
  // est deja en memoire. Sans elle, inutile d'insister.
  const historique: Historique | null = premiere.etat === "ok" ? historiqueParties(jeton, saison) : null;

  const rang = rangLisible(profil.rangActuel);
  const tranche = trancheDuRang(profil.rangActuel);
  const lignes = herosSaison.etat === "ok" ? comparerHeros(herosSaison.donnees.heros, tranche) : null;
  const parties = premiere.etat === "ok" ? premiere.donnees.entrees : null;
  const nomTranche = t(`rangsMesure.${tranche}`);
  const attente = (hauteur: string) => (
    <AnalyseEnCours t={t} texte={t("pages.accountProfile.historiqueEnCours")} className={`mt-6 ${hauteur}`} />
  );

  return cadre(
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-titre text-3xl font-bold text-craie-100">{t("pages.accountProfile.titre")}</h1>
          <div aria-hidden className="filet-or mt-3 h-0.5 w-16" />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-craie-500">
            {t("pages.accountProfile.chapeau", { nom: profil.name })}
          </p>
        </div>
        <BadgeRang rang={rang} taille="sm" />
      </header>

      {sids.length > 1 && <NavSaisons saisons={sids} courante={saison} t={t} />}

      <SectionProfil id="bilan" titre={t("pages.accountProfile.bilanTitre", { n: saison })}>
        {herosSaison.etat === "ok" ? (
          <BilanJoueur
            bilan={bilanSaison(herosSaison.donnees.heros)}
            complet={herosSaison.donnees.complet}
            rang={rang}
            stats={stats.etat === "ok" ? stats.donnees : null}
            t={t}
            langue={locale}
          />
        ) : (
          <SectionIndisponible t={t} />
        )}
      </SectionProfil>

      <SectionProfil
        id="evolution"
        titre={t("pages.accountProfile.evolutionTitre")}
        chapeau={t("pages.accountProfile.evolutionIntro", { n: FENETRE_FORME })}
      >
        {historique === null ? (
          <SectionIndisponible t={t} />
        ) : (
          <Suspense fallback={attente("min-h-[20rem]")}>
            <EvolutionDifferee historique={historique} t={t} langue={locale} />
          </Suspense>
        )}
      </SectionProfil>

      <SectionProfil
        id="postes"
        titre={t("pages.accountProfile.postesTitre")}
        chapeau={t("pages.accountProfile.postesIntro", { n: PARTIES_MIN_POSTE })}
      >
        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-8">
          {herosSaison.etat === "ok" ? (
            <TableauPostes
              type="roles"
              titre={t("pages.accountProfile.parRoleTitre")}
              source={t("pages.accountProfile.parRoleSource")}
              bilan={statsParRole(herosSaison.donnees.heros)}
              t={t}
              langue={locale}
            />
          ) : (
            <SectionIndisponible t={t} />
          )}
          {historique === null ? (
            <SectionIndisponible t={t} />
          ) : (
            <Suspense fallback={attente("min-h-[12rem]")}>
              <PositionsDifferees historique={historique} t={t} langue={locale} />
            </Suspense>
          )}
        </div>
      </SectionProfil>

      <SectionProfil
        id="heros"
        titre={t("pages.accountProfile.herosTitre")}
        chapeau={`${t("pages.accountProfile.herosIntro", { rang: nomTranche })}${
          tranche === "all" ? ` ${t("pages.accountProfile.trancheSousEpique")}` : ""
        }`}
      >
        {lignes === null ? (
          <SectionIndisponible t={t} />
        ) : lignes.length === 0 ? (
          <p className="mt-6 text-sm text-craie-500">{t("pages.accountProfile.herosVide")}</p>
        ) : (
          <>
            <TableauHeros lignes={lignes.slice(0, HEROS_AFFICHES)} tranche={tranche} t={t} langue={locale} />
            <FichesHerosRang
              fiches={fichesHerosRang(lignes, tranche, parties ?? [])}
              tranche={tranche}
              t={t}
              langue={locale}
            />
          </>
        )}
      </SectionProfil>

      <SectionProfil
        id="conseils"
        titre={t("pages.accountProfile.conseilsTitre")}
        chapeau={t("pages.accountProfile.conseilsIntro", { n: PARTIES_MIN })}
      >
        <ConseilsHeros
          lignes={lignes}
          meilleurs={lignes ? meilleursHeros(lignes) : []}
          sousMoyenne={lignes ? herosSousMoyenne(lignes) : []}
          tranche={tranche}
          t={t}
          langue={locale}
          adversaires={
            parties === null ? (
              <p className="text-sm text-craie-400">{t("pages.accountProfile.sectionIndispo")}</p>
            ) : parties.length === 0 ? (
              <p className="text-sm text-craie-400">{t("pages.accountProfile.bourreauxVide")}</p>
            ) : (
              <Suspense fallback={<AnalyseEnCours t={t} />}>
                <AnalyseAdversaires
                  jeton={jeton}
                  saison={saison}
                  parties={parties}
                  moi={{ roleId: profil.roleId, zoneId: profil.zoneId }}
                  t={t}
                  langue={locale}
                />
              </Suspense>
            )
          }
        />
      </SectionProfil>

      <SectionProfil id="parties" titre={t("pages.accountProfile.partiesTitre")}>
        {premiere.etat === "ok" ? (
          <PartiesRecentes
            key={saison}
            saison={saison}
            initiales={premiere.donnees.entrees.map(afficherPartie)}
            suivant={premiere.donnees.suivant}
          />
        ) : (
          <SectionIndisponible t={t} />
        )}
      </SectionProfil>
    </>,
  );
}

/** Historique indisponible ou session expiree, dit a la place d'une section differee. */
function HistoriqueManquant({ etat, t }: { etat: "expire" | "indisponible"; t: T }) {
  return etat === "expire" ? (
    <p className="mt-6 text-sm leading-relaxed text-craie-400">{t("pages.accountProfile.expireTexte")}</p>
  ) : (
    <SectionIndisponible t={t} />
  );
}

/** Evolution de la saison : attend l'historique des parties, lance par la page. */
async function EvolutionDifferee({ historique, t, langue }: { historique: Historique; t: T; langue: Langue }) {
  const r = await historique;
  if (r.etat !== "ok") return <HistoriqueManquant etat={r.etat} t={t} />;
  return <EvolutionJoueur evo={evolution(r.donnees.parties)} fin={r.donnees.fin} t={t} langue={langue} />;
}

/** Positions occupees sur l'historique lu : le meme, partage avec l'evolution. */
async function PositionsDifferees({ historique, t, langue }: { historique: Historique; t: T; langue: Langue }) {
  const r = await historique;
  if (r.etat !== "ok") return <HistoriqueManquant etat={r.etat} t={t} />;
  const bilan = statsParPosition(r.donnees.parties);
  const n = bilan.total + bilan.ecartees;
  return (
    <TableauPostes
      type="lanes"
      titre={t("pages.accountProfile.parPositionTitre")}
      source={t(`pages.accountProfile.parPositionSource.${pluriel(n, langue)}`, { n })}
      bilan={bilan}
      t={t}
      langue={langue}
    />
  );
}

/**
 * Adversaires des dernieres parties. Composant serveur a part, rendu sous
 * `Suspense` : le detail d'une douzaine de parties prend du temps, le reste
 * du profil n'a pas a l'attendre. Le jeton reste ici, cote serveur.
 */
async function AnalyseAdversaires({
  jeton,
  saison,
  parties,
  moi,
  t,
  langue,
}: {
  jeton: string;
  saison: number;
  parties: PartieResume[];
  moi: { roleId: number; zoneId: number };
  t: T;
  langue: Langue;
}) {
  const recentes = parties.slice(0, PARTIES_ANALYSEES);
  const details = await detailsParties(
    jeton,
    recentes.map((p) => ({ id: p.id, saison: p.saison ?? saison })),
  );
  if (details.etat !== "ok") {
    const cle = details.etat === "expire" ? "expireTexte" : "bourreauxIndispo";
    return <p className="text-sm leading-relaxed text-craie-400">{t(`pages.accountProfile.${cle}`)}</p>;
  }

  const analysees = recentes.flatMap((p) => {
    const participants = details.donnees.get(p.id);
    return participants ? [{ victoire: p.victoire, participants }] : [];
  });
  return <ListeBourreaux analyse={bourreaux(analysees, moi)} t={t} langue={langue} />;
}
