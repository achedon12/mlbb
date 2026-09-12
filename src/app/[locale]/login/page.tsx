import { FilAriane } from "@/components/fil-ariane";
import { metaLangues } from "@/i18n/seo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { FormulaireConnexion } from "@/components/formulaire-connexion";
import { jetonCourant } from "@/lib/session";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return { title: t("pages.login.metaTitle"), description: t("pages.login.metaDescription"), alternates: metaLangues(locale, "/login"), robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

export default async function PageConnexion({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  if (await jetonCourant()) redirect(`/${locale}/account`);

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <FilAriane miettes={[{ nom: t("pages.login.title") }]} className="mb-8" />
      <h1 className="font-heading text-3xl font-bold text-chalk-100">{t("pages.login.title")}</h1>
      <div aria-hidden className="gold-rule mt-3 h-0.5 w-16" />
      <p className="mt-4 text-sm leading-relaxed text-chalk-500">
        {t("pages.login.intro")}
      </p>

      <div className="mt-8">
        <FormulaireConnexion />
      </div>

      <p className="mt-8 flex gap-2 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden />
        {t("pages.login.security")}
      </p>
    </div>
  );
}
