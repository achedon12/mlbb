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
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import type { PartieResume } from "@/lib/joueur-api";
import { detailsParties, herosDeLaSaison, pageParties, saisons, statistiques } from "@/lib/mlbb-auth";
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
    <div className="mx-auto max-w-4xl px-4 py-14">
      <FilAriane
        miettes={[{ nom: t("pages.account.metaTitre"), href: "/account" }, { nom: t("pages.accountProfile.titre") }]}
        className="mb-8"
      />
      {contenu}
    </div>
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

  const rang = rangLisible(profil.rangActuel);
  const tranche = trancheDuRang(profil.rangActuel);
  const lignes = herosSaison.etat === "ok" ? comparerHeros(herosSaison.donnees.heros, tranche) : null;
  const parties = premiere.etat === "ok" ? premiere.donnees.entrees : null;
  const nomTranche = t(`rangsMesure.${tranche}`);

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
          <TableauHeros lignes={lignes.slice(0, HEROS_AFFICHES)} tranche={tranche} t={t} langue={locale} />
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
