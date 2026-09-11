import Link from "@/components/lien";
import { Github, Rss } from "lucide-react";
import type { Langue } from "@/i18n/config";
import { creerT, type T } from "@/i18n/traductions";
import { site } from "@/lib/site";

/** Colonne de liens du pied de page. `prefixe` choisit la famille de clés. */
function Colonne({
  titre,
  liens,
  prefixe,
  t,
}: {
  titre: string;
  liens: readonly { href: string; cle: string }[];
  prefixe: "nav" | "pied";
  t: T;
}) {
  return (
    <div>
      <p className="font-titre text-xs font-semibold uppercase tracking-wider text-or-400">{titre}</p>
      <ul className="mt-4 space-y-2.5">
        {liens.map((lien) => (
          <li key={lien.href}>
            <Link href={lien.href} className="text-sm text-craie-500 transition-colors hover:text-craie-100">
              {prefixe === "nav" ? t(`nav.${lien.cle}.label`) : t(`pied.${lien.cle}`)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ANNEE = new Date().getFullYear();

const JEU = [
  { href: "/heroes", cle: "heroes" },
  { href: "/tier-list", cle: "tierList" },
  { href: "/compare", cle: "compare" },
  { href: "/draft", cle: "draft" },
  { href: "/game-modes", cle: "gameModes" },
  { href: "/items", cle: "items" },
  { href: "/emblems", cle: "emblems" },
];

const ACTUALITE = [
  { href: "/news", cle: "news" },
  { href: "/watch", cle: "watch" },
  { href: "/patch-notes", cle: "patchNotes" },
];

const SITE = [
  { href: "/api-doc", cle: "apiPublique" },
  { href: "/about", cle: "apropos" },
  { href: "/account", cle: "monCompte" },
  { href: "/legal", cle: "mentionsLegales" },
  { href: "/privacy", cle: "confidentialite" },
];

export function PiedDePage({ langue }: { langue: Langue }) {
  const t = creerT(langue);

  return (
    <footer className="mt-24 border-t border-nuit-700/70 bg-nuit-900/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Link href={`/${langue}`} className="group flex items-center gap-2.5">
            <span
              aria-hidden
              className="biseau-sm grid size-8 place-items-center bg-linear-to-br from-or-400 to-or-600 font-titre text-sm font-bold text-nuit-950"
            >
              ML
            </span>
            <span className="font-titre text-lg font-bold tracking-wide text-craie-100">{site.nom}</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-craie-500">{t("pied.description")}</p>
          <div className="mt-5 flex items-center gap-4">
            <a
              href={site.depot}
              className="flex items-center gap-2 text-sm text-craie-300 transition-colors hover:text-or-400"
              rel="noreferrer"
              target="_blank"
            >
              <Github size={16} aria-hidden />
              {t("pied.codeSource")}
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

        <nav aria-label={t("pied.leJeu")}>
          <Colonne titre={t("pied.leJeu")} liens={JEU} prefixe="nav" t={t} />
        </nav>
        <nav aria-label={t("pied.actualites")}>
          <Colonne titre={t("pied.actualites")} liens={ACTUALITE} prefixe="nav" t={t} />
        </nav>
        <nav aria-label={t("pied.leSite")}>
          <Colonne titre={t("pied.leSite")} liens={SITE} prefixe="pied" t={t} />
        </nav>
      </div>

      <div className="border-t border-nuit-800/80">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-craie-600">{t("pied.credit")}</p>
      </div>

      <div className="border-t border-nuit-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-craie-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {ANNEE} {site.nom} — {t("pied.droits", { auteur: site.auteur })}
            <span className="text-craie-600"> · {t("pied.version", { v: process.env.VERSION_SITE ?? "" })}</span>
          </p>
          <p className="text-craie-600">{t("pied.marque")}</p>
        </div>
      </div>
    </footer>
  );
}
