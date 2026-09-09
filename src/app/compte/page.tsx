import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert, LogOut, Trash2 } from "lucide-react";
import { LiaisonCompte } from "@/components/liaison-compte";
import { Carte } from "@/components/ui";
import { rosterParSlug } from "@/data/roster";
import { basculerFavori, deconnecter, delierCompteJeu } from "@/lib/actions";
import { couleurAvatar, utilisateurCourant } from "@/lib/auth";
import { db, type CompteJeu } from "@/lib/db";
import { formaterDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Mon compte",
  description: "Comptes de jeu lies et heros favoris.",
  robots: { index: false, follow: false },
};

/** Page personnelle : jamais mise en cache. */
export const dynamic = "force-dynamic";

export default async function PageCompte() {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) redirect("/connexion");

  const base = db();
  const comptes = base
    .prepare("SELECT * FROM comptes_jeu WHERE utilisateur_id = ? ORDER BY verifie_le DESC")
    .all(utilisateur.id) as CompteJeu[];
  const favoris = (
    base
      .prepare("SELECT heros FROM favoris WHERE utilisateur_id = ? ORDER BY ajoute_le DESC")
      .all(utilisateur.id) as { heros: string }[]
  ).map((f) => f.heros);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      {/* ── En-tete ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-5">
        <span
          aria-hidden
          className="biseau grid size-16 place-items-center font-titre text-2xl font-bold text-nuit-950"
          style={{ background: couleurAvatar(utilisateur.email) }}
        >
          {utilisateur.pseudo.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-titre text-3xl font-bold text-craie-100">{utilisateur.pseudo}</h1>
          <p className="mt-1 text-sm text-craie-500">
            {utilisateur.email} · membre depuis {formaterDate(utilisateur.cree_le)}
          </p>
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

      {/* ── Comptes de jeu ─────────────────────────────────────────────── */}
      <section className="mt-14">
        <h2 className="font-titre text-2xl font-bold text-craie-100">Comptes de jeu</h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

        {/*
          Le point important de cette page : dire ce qui est reellement
          recuperable. Promettre des statistiques que Moonton ne publie pas
          serait le plus simple, et le plus malhonnete.
        */}
        <Carte className="mt-6 border-or-500/25">
          <h3 className="flex items-center gap-2 font-titre font-bold text-or-400">
            <CircleAlert size={17} aria-hidden />
            Ce qui est verifiable, et ce qui ne l&apos;est pas
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-craie-300">
            Moonton ne publie aucune interface de programmation. La verification
            ci-dessous confirme qu&apos;un identifiant existe et remonte le
            pseudo associe — c&apos;est la seule information accessible de
            l&apos;exterieur. Le rang, l&apos;indice de competence, l&apos;
            historique de parties et le statut « en partie » ne sont exposes
            nulle part, et ce site ne les inventera pas.
          </p>
        </Carte>

        {comptes.length > 0 && (
          <ul className="mt-6 space-y-3">
            {comptes.map((c) => (
              <li
                key={c.id}
                className="biseau flex flex-wrap items-center gap-4 border border-nuit-700/70 bg-nuit-900/60 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-titre text-lg font-bold text-craie-100">{c.pseudo_jeu}</p>
                  <p className="mt-0.5 text-sm text-craie-500">
                    {c.identifiant} ({c.serveur}) · verifie le {formaterDate(c.verifie_le)}
                  </p>
                </div>
                <form action={delierCompteJeu}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    aria-label={`Delier le compte ${c.pseudo_jeu}`}
                    className="grid size-9 place-items-center text-craie-500 transition-colors hover:text-sang-500"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <LiaisonCompte />
        </div>
      </section>

      {/* ── Favoris ────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <h2 className="font-titre text-2xl font-bold text-craie-100">Heros favoris</h2>
        <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />

        {favoris.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-craie-500">
            Aucun favori pour le moment.{" "}
            <Link href="/heros" className="text-or-400 underline underline-offset-4">
              Parcourez les heros
            </Link>{" "}
            pour en ajouter.
          </p>
        ) : (
          <ul className="mt-6 flex flex-wrap gap-2">
            {favoris.map((slug) => (
              <li key={slug} className="biseau-sm flex items-center border border-nuit-700 bg-nuit-900/60">
                <Link
                  href={`/heros/${slug}`}
                  className="px-3 py-2 text-sm text-craie-100 transition-colors hover:text-or-400"
                >
                  {rosterParSlug.get(slug)?.nom ?? slug}
                </Link>
                <form action={basculerFavori}>
                  <input type="hidden" name="heros" value={slug} />
                  <button
                    type="submit"
                    aria-label={`Retirer ${rosterParSlug.get(slug)?.nom ?? slug} des favoris`}
                    className="grid size-9 place-items-center text-craie-500 transition-colors hover:text-sang-500"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
