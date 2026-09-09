import Link from "next/link";
import { Github, Rss } from "lucide-react";
import { navigation, site } from "@/lib/site";

export function PiedDePage() {
  return (
    <footer className="mt-24 border-t border-nuit-700/70 bg-nuit-900/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="font-titre text-lg font-bold text-craie-100">{site.nom}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-craie-500">
            Une base de connaissances francophone sur Mobile Legends: Bang Bang.
            Projet independant, ouvert aux contributions.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <a
              href={site.depot}
              className="flex items-center gap-2 text-sm text-craie-300 transition-colors hover:text-or-400"
              rel="noreferrer"
            >
              <Github size={16} aria-hidden />
              Code source
            </a>
            <Link
              href="/feed.xml"
              className="flex items-center gap-2 text-sm text-craie-300 transition-colors hover:text-or-400"
            >
              <Rss size={16} aria-hidden />
              Flux RSS
            </Link>
          </div>
        </div>

        <nav aria-label="Pied de page">
          <p className="font-titre text-sm font-semibold uppercase tracking-wider text-or-400">
            Sections
          </p>
          <ul className="mt-4 space-y-2">
            {navigation.map((lien) => (
              <li key={lien.href}>
                <Link href={lien.href} className="text-sm text-craie-500 transition-colors hover:text-craie-100">
                  {lien.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-titre text-sm font-semibold uppercase tracking-wider text-or-400">
            Le site
          </p>
          <ul className="mt-4 space-y-2">
            <li><Link href="/a-propos" className="text-sm text-craie-500 transition-colors hover:text-craie-100">A propos</Link></li>
            <li><Link href="/compte" className="text-sm text-craie-500 transition-colors hover:text-craie-100">Mon compte</Link></li>
            <li><Link href="/feed.xml" className="text-sm text-craie-500 transition-colors hover:text-craie-100">RSS</Link></li>
          </ul>
        </div>
      </div>

      {/*
        Mention obligatoire : le jeu, ses noms et son univers appartiennent a
        Moonton. Ce site est un projet de fan, sans lien avec l'editeur.
      */}
      <div className="border-t border-nuit-800">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-craie-500">
          Mobile Legends: Bang Bang, son univers, ses heros et leurs noms sont
          des marques deposees de Shanghai Moonton Technology Co., Ltd.
          {" "}{site.nom} est un projet de fan independant, sans affiliation, ni
          approbation, ni parrainage de Moonton. Les contenus editoriaux sont
          publies par {site.auteur}.
        </p>
      </div>
    </footer>
  );
}
