import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CircleAlert, LogOut } from "lucide-react";
import { BadgeRang } from "@/components/badge-rang";
import { FavorisCompte } from "@/components/favoris-compte";
import { Carte } from "@/components/ui";
import { deconnecter } from "@/lib/actions";
import { amis, statistiques } from "@/lib/mlbb-auth";
import { nomPays, rangLisible } from "@/lib/rangs";
import { jetonCourant, profilCourant } from "@/lib/session";

export const metadata: Metadata = {
  title: "Mon compte",
  description: "Profil de jeu et statistiques.",
  robots: { index: false, follow: false },
};

/** Page personnelle : jamais mise en cache. */
export const dynamic = "force-dynamic";

export default async function PageCompte() {
  const jeton = await jetonCourant();
  if (!jeton) redirect("/connexion");

  const profil = await profilCourant();
  if (!profil) {
    // Jeton valide mais profil indisponible : la source Moonton est coupee.
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Carte className="border-or-500/30">
          <h1 className="flex items-center gap-2 font-titre text-xl font-bold text-or-400">
            <CircleAlert size={20} aria-hidden />
            Profil momentanement indisponible
          </h1>
          <p className="mt-3 leading-relaxed text-craie-300">
            Vous etes bien connecte, mais le service de Moonton qui fournit les
            profils ne repond pas en ce moment. Reessayez dans quelques minutes.
          </p>
          <form action={deconnecter} className="mt-5">
            <button type="submit" className="text-sm text-craie-500 underline underline-offset-4 hover:text-sang-500">
              Se deconnecter
            </button>
          </form>
        </Carte>
      </div>
    );
  }

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
      {/* ── En-tete de profil ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-5">
        <span className="biseau relative size-20 shrink-0 overflow-hidden bg-nuit-800">
          {profil.avatar ? (
            <Image src={profil.avatar} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <span className="grid size-full place-items-center font-titre text-2xl font-bold text-craie-500">
              {profil.name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="font-titre text-3xl font-bold text-craie-100">{profil.name}</h1>
          <div className="mt-2">
            <BadgeRang rang={rang} taille="sm" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-craie-500">
            <span>Niveau {profil.level}</span>
            <span>{nomPays(profil.pays)}</span>
            <span>ID {profil.roleId} ({profil.zoneId})</span>
          </div>
        </div>

        <form action={deconnecter}>
          <button
            type="submit"
            className="biseau-sm flex items-center gap-2 border border-nuit-700 px-4 py-2 text-sm text-craie-300 transition-colors hover:border-sang-500/50 hover:text-sang-500"
          >
            <LogOut size={15} aria-hidden />
            Deconnexion
          </button>
        </form>
      </div>

      {/* ── Rangs et chiffres ──────────────────────────────────────────── */}
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-craie-500">Rang actuel</dt>
          <dd className="mt-2">
            <BadgeRang rang={rang} taille="lg" />
          </dd>
        </div>
        <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-craie-500">Meilleur rang</dt>
          <dd className="mt-2">
            <BadgeRang rang={rangMax} taille="lg" />
          </dd>
        </div>
        <Chiffre label="Niveau" valeur={profil.level} />
        <Chiffre label="Amis" valeur={listeAmis.etat === "ok" ? listeAmis.donnees.length : "—"} />
      </dl>

      {/* ── Statistiques detaillees ────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-titre text-2xl font-bold text-craie-100">Statistiques</h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

        {stats.etat === "ok" ? (
          <StatistiquesDetaillees donnees={stats.donnees} />
        ) : (
          <Carte className="mt-6 border-or-500/25">
            <p className="text-sm leading-relaxed text-craie-300">
              Le detail des statistiques — taux de victoire, historique, heros
              les plus joues — depend d&apos;un service de Moonton actuellement
              hors ligne. Votre profil ci-dessus reste accessible ; le detail
              reviendra des que la source repond.
            </p>
          </Carte>
        )}
      </section>

      {/* ── Amis ───────────────────────────────────────────────────────── */}
      {listeAmis.etat === "ok" && listeAmis.donnees.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-3">
            <h2 className="font-titre text-2xl font-bold text-craie-100">Amis</h2>
            <span className="text-sm text-craie-500">{listeAmis.donnees.length}</span>
          </div>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listeAmis.donnees.map((ami, i) => (
              <li
                key={`${ami.nom}-${i}`}
                className="biseau flex items-center gap-3 border border-nuit-700/70 bg-nuit-900/60 p-2.5"
              >
                <span className="biseau-sm relative size-10 shrink-0 overflow-hidden bg-nuit-800">
                  {ami.avatar ? (
                    <Image src={ami.avatar} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-xs text-craie-500">
                      {ami.nom.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 truncate text-sm text-craie-100">{ami.nom}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Favoris (locaux) ───────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-titre text-2xl font-bold text-craie-100">Heros favoris</h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
        <FavorisCompte />
      </section>
    </div>
  );
}

function Chiffre({ label, valeur }: { label: string; valeur: number | string }) {
  return (
    <div className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
      <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
      <dd className="mt-1 font-titre text-2xl font-bold text-or-400">{valeur}</dd>
    </div>
  );
}

/**
 * Affichage generique des statistiques.
 *
 * Leur forme exacte n'est pas garantie par la source et n'a pas pu etre
 * observee — l'endpoint etait coupe a la mise en place. On affiche donc les
 * champs numeriques et textuels tels qu'ils arrivent, plutot que de coder en
 * dur une structure qui pourrait ne jamais correspondre.
 */
function StatistiquesDetaillees({ donnees }: { donnees: Record<string, unknown> }) {
  const entrees = Object.entries(donnees).filter(
    ([, v]) => typeof v === "number" || typeof v === "string",
  );

  if (entrees.length === 0) {
    return <p className="mt-6 text-sm text-craie-500">Aucune statistique a afficher.</p>;
  }

  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
      {entrees.map(([cle, valeur]) => (
        <div key={cle} className="biseau border border-nuit-700/70 bg-nuit-900/60 p-4">
          <dt className="text-xs uppercase tracking-wide text-craie-500">
            {cle.replace(/_/g, " ")}
          </dt>
          <dd className="mt-1 font-titre text-lg font-bold text-craie-100">{String(valeur)}</dd>
        </div>
      ))}
    </dl>
  );
}
