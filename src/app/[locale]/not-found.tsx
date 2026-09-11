"use client";

import Link from "@/components/lien";
import { useT } from "@/i18n/fournisseur";

export default function Introuvable() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center">
      <p className="font-heading text-6xl font-bold text-gold-400">404</p>
      <h1 className="mt-4 font-heading text-2xl font-bold text-chalk-100">{t("pages.introuvable.titre")}</h1>
      <p className="mt-4 leading-relaxed text-chalk-500">{t("pages.introuvable.texte")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="bevel-sm bg-gold-500 px-6 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("pages.introuvable.accueil")}
        </Link>
        <Link
          href="/heroes"
          className="bevel-sm border border-night-600 px-6 py-3 font-semibold text-chalk-100 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          {t("pages.introuvable.heros")}
        </Link>
      </div>
    </div>
  );
}
