import { FilAriane } from "@/components/fil-ariane";
import { metaLangues } from "@/i18n/seo";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ChevronRight, CircleAlert, LogOut, Trophy } from "lucide-react";
import { BadgeRang } from "@/components/badge-rang";
import { FavorisCompte } from "@/components/favoris-compte";
import Link from "@/components/lien";
import { EtatProfil } from "@/components/profil-joueur";
import { Carte } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { deconnecter } from "@/lib/actions";
import { formaterNombre, formaterPourcent } from "@/lib/format-joueur";
import type { StatsJoueur } from "@/lib/joueur-api";
import { amis, statistiques } from "@/lib/mlbb-auth";
import { nomPays, rangLisible } from "@/lib/rangs";
import { sessionJoueur } from "@/lib/session";
import { resumeDernierPatch } from "@/lib/suivi-patchs";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return { title: t("pages.account.metaTitre"), description: t("pages.account.metaDescription"), alternates: metaLangues(locale, "/account"), robots: { index: false, follow: false } };
}

/** Page personnelle : jamais mise en cache. */
export const dynamic = "force-dynamic";

export default async function PageCompte({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const session = await sessionJoueur();
  if (session.etat === "absente") redirect("/login");

  if (session.etat === "expiree") {
    // Jeton revoque avant son echeance : il faut un nouveau code.
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EtatProfil type="expiree" t={t} />
      </div>
    );
  }

  if (session.etat === "indisponible") {
    // Jeton valide mais profil indisponible : la source Moonton est coupee.
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Carte className="border-gold-500/30">
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold text-gold-400">
            <CircleAlert size={20} aria-hidden />
            {t("pages.account.indisponible")}
          </h1>
          <p className="mt-3 leading-relaxed text-chalk-300">{t("pages.account.indisponibleTexte")}</p>
          <form action={deconnecter} className="mt-5">
            <button type="submit" className="text-sm text-chalk-500 underline underline-offset-4 hover:text-blood-500">
              {t("pages.account.seDeconnecter")}
            </button>
          </form>
        </Carte>
      </div>
    );
  }

  const { jeton, profil } = session;

  // Deux sources en parallele : les stats (souvent coupees) et les amis
  // (sur le sous-systeme d'auth, qui reste en ligne).
  const [stats, listeAmis] = await Promise.all([
    statistiques(jeton),
    amis(jeton),
  ]);

  const rang = rangLisible(profil.rangActuel);
  const rangMax = rangLisible(profil.rangMax);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <FilAriane miettes={[{ nom: t("pages.account.metaTitre") }]} className="mb-8" />
      {/* ── En-tete de profil ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-5">
        <span className="bevel relative size-20 shrink-0 overflow-hidden bg-night-800">
          {profil.avatar ? (
            <Image src={profil.avatar} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <span className="grid size-full place-items-center font-heading text-2xl font-bold text-chalk-500">
              {profil.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-bold text-chalk-100">{profil.name}</h1>
          <div className="mt-2">
            <BadgeRang rang={rang} taille="sm" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-chalk-500">
            <span>{t("pages.account.niveauX", { n: profil.level })}</span>
            <span>{nomPays(profil.pays)}</span>
            <span>ID {profil.roleId} ({profil.zoneId})</span>
          </div>
        </div>

        <form action={deconnecter}>
          <button
            type="submit"
            className="bevel-sm flex items-center gap-2 border border-night-700 px-4 py-2 text-sm text-chalk-300 transition-colors hover:border-blood-500/50 hover:text-blood-500"
          >
            <LogOut size={15} aria-hidden />
            {t("pages.account.deconnexion")}
          </button>
        </form>
      </div>

      {/* ── Rangs et chiffres ──────────────────────────────────────────── */}
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.account.rangActuel")}</dt>
          <dd className="mt-2">
            <BadgeRang rang={rang} taille="lg" />
          </dd>
        </div>
        <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.account.meilleurRang")}</dt>
          <dd className="mt-2">
            <BadgeRang rang={rangMax} taille="lg" />
          </dd>
        </div>
        <Chiffre label={t("pages.account.niveau")} valeur={profil.level} />
        <Chiffre label={t("pages.account.amis")} valeur={listeAmis.etat === "ok" ? listeAmis.donnees.length : "—"} />
      </dl>

      {/* ── Statistiques ───────────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.account.statistiques")}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

        {stats.etat === "ok" ? (
          <ResumeStatistiques stats={stats.donnees} langue={locale} />
        ) : (
          <Carte className="mt-6 border-gold-500/25">
            <p className="text-sm leading-relaxed text-chalk-300">
              {t("pages.account.detailIndispo")}
            </p>
          </Carte>
        )}

        {/* Le profil detaille a ses propres etats : le lien reste meme quand les stats sont coupees. */}
        <Link
          href="/account/profile"
          className="bevel group mt-6 flex items-center gap-4 border border-gold-500/30 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
        >
          <Trophy size={22} className="shrink-0 text-gold-400" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-heading font-bold text-chalk-100 transition-colors group-hover:text-gold-400">
              {t("pages.account.lienProfil")}
            </span>
            <span className="mt-0.5 block text-sm text-chalk-500">{t("pages.account.lienProfilTexte")}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-chalk-500" aria-hidden />
        </Link>
      </section>

      {/* ── Amis ───────────────────────────────────────────────────────── */}
      {listeAmis.etat === "ok" && listeAmis.donnees.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-3">
            <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.account.amis")}</h2>
            <span className="text-sm text-chalk-500">{listeAmis.donnees.length}</span>
          </div>
          <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />

          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listeAmis.donnees.map((ami, i) => (
              <li
                key={`${ami.nom}-${i}`}
                className="bevel flex items-center gap-3 border border-night-700/70 bg-night-900/60 p-2.5"
              >
                <span className="bevel-sm relative size-10 shrink-0 overflow-hidden bg-night-800">
                  {ami.avatar ? (
                    <Image src={ami.avatar} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-xs text-chalk-500">
                      {ami.nom.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 truncate text-sm text-chalk-100">{ami.nom}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Favoris (locaux) ───────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold text-chalk-100">{t("pages.account.favoris")}</h2>
        <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
        <FavorisCompte dernierPatch={resumeDernierPatch()} />
      </section>
    </div>
  );
}

function Chiffre({ label, valeur }: { label: string; valeur: number | string }) {
  return (
    <div className="bevel border border-night-700/70 bg-night-900/60 p-4">
      <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-bold text-gold-400">{valeur}</dd>
    </div>
  );
}

/**
 * Chiffres d'ensemble, sur les saisons que le service a gardees. Le detail —
 * saison par saison, heros par heros — est sur le profil de joueur.
 */
function ResumeStatistiques({ stats, langue }: { stats: StatsJoueur; langue: Langue }) {
  const t = creerT(langue);
  if (stats.parties === 0) {
    return <p className="mt-6 text-sm text-chalk-500">{t("pages.account.aucuneStat")}</p>;
  }

  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Chiffre label={t("pages.accountProfile.parties")} valeur={formaterNombre(stats.parties, langue)} />
      <Chiffre
        label={t("pages.heroDetail.stat.tauxVictoire")}
        valeur={formaterPourcent((stats.victoires / stats.parties) * 100, langue)}
      />
      {stats.mvp !== null && <Chiffre label={t("pages.accountProfile.mvp")} valeur={formaterNombre(stats.mvp, langue)} />}
      {stats.meilleureSerie !== null && (
        <Chiffre label={t("pages.accountProfile.meilleureSerie")} valeur={formaterNombre(stats.meilleureSerie, langue)} />
      )}
    </dl>
  );
}
