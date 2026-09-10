import Link from "next/link";
import { Github, Rss } from "lucide-react";
import { navigation, site } from "@/lib/site";

const ANNEE = new Date().getFullYear();

const LIENS_SITE = [
  { href: "/api-doc", label: "API publique" },
  { href: "/a-propos", label: "A propos" },
  { href: "/compte", label: "Mon compte" },
  { href: "/mentions-legales", label: "Mentions legales" },
  { href: "/confidentialite", label: "Confidentialite" },
];

/** Colonne de liens du pied de page. */
function Colonne({
  titre,
  liens,
}: {
  titre: string;
  liens: readonly { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="font-titre text-xs font-semibold uppercase tracking-wider text-or-400">
        {titre}
      </p>
      <ul className="mt-4 space-y-2.5">
        {liens.map((lien) => (
          <li key={lien.href}>
            <Link
              href={lien.href}
              className="text-sm text-craie-500 transition-colors hover:text-craie-100"
            >
              {lien.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PiedDePage() {
  const jeu = navigation.filter((l) => l.groupe === "jeu");
  const actualite = navigation.filter((l) => l.groupe === "actualite");

  return (
    <footer className="mt-24 border-t border-nuit-700/70 bg-nuit-900/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        {/* Marque et liens externes. */}
        <div>
          <Link href="/" className="group flex items-center gap-2.5">
            <span
              aria-hidden
              className="biseau-sm grid size-8 place-items-center bg-linear-to-br from-or-400 to-or-600 font-titre text-sm font-bold text-nuit-950"
            >
              ML
            </span>
            <span className="font-titre text-lg font-bold tracking-wide text-craie-100">
              {site.nom}
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-craie-500">
            La base de connaissances francophone sur Mobile Legends: Bang Bang.
            Projet independant, ouvert aux contributions.
          </p>
          <div className="mt-5 flex items-center gap-4">
            <a
              href={site.depot}
              className="flex items-center gap-2 text-sm text-craie-300 transition-colors hover:text-or-400"
              rel="noreferrer"
              target="_blank"
            >
              <Github size={16} aria-hidden />
              Code source
            </a>
            <Link
              href="/feed.xml"
              className="flex items-center gap-2 text-sm text-craie-300 transition-colors hover:text-or-400"
            >
              <Rss size={16} aria-hidden />
              RSS
            </Link>
          </div>
        </div>

        <nav aria-label="Le jeu">
          <Colonne titre="Le jeu" liens={jeu} />
        </nav>
        <nav aria-label="Actualites">
          <Colonne titre="Actualites" liens={actualite} />
        </nav>
        <nav aria-label="Le site">
          <Colonne titre="Le site" liens={LIENS_SITE} />
        </nav>
      </div>

      {/* Sources : la transparence sur l'origine des donnees fait partie du parti pris. */}
      <div className="border-t border-nuit-800/80">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-craie-600">
          Donnees du{" "}
          <a
            href="https://mobilelegends.fandom.com"
            rel="noreferrer nofollow"
            target="_blank"
            className="text-craie-500 hover:text-or-400"
          >
            wiki Mobile Legends
          </a>{" "}
          (CC BY-SA) et de l&apos;API communautaire arena.rone.dev. Aucune
          statistique de partie n&apos;est disponible.
        </p>
      </div>

      {/*
        Mention obligatoire : le jeu, ses noms et son univers appartiennent a
        Moonton. Ce site est un projet de fan, sans lien avec l'editeur.
      */}
      <div className="border-t border-nuit-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-craie-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {ANNEE} {site.nom} — projet de fan independant. Contenus publies
            par {site.auteur}.
          </p>
          <p className="text-craie-600">
            Mobile Legends: Bang Bang™ Shanghai Moonton Technology Co., Ltd.
          </p>
        </div>
      </div>
    </footer>
  );
}
