"use client";

import Link from "next/link";
import { useT } from "@/i18n/fournisseur";

export default function Introuvable() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center">
      <p className="font-titre text-6xl font-bold text-or-400">404</p>
      <h1 className="mt-4 font-titre text-2xl font-bold text-craie-100">{t("pages.introuvable.titre")}</h1>
      <p className="mt-4 leading-relaxed text-craie-500">{t("pages.introuvable.texte")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="biseau-sm bg-or-500 px-6 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
        >
          {t("pages.introuvable.accueil")}
        </Link>
        <Link
          href="/heroes"
          className="biseau-sm border border-nuit-600 px-6 py-3 font-semibold text-craie-100 transition-colors hover:border-or-500/60 hover:text-or-400"
        >
          {t("pages.introuvable.heros")}
        </Link>
      </div>
    </div>
  );
}
