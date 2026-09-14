import { Breadcrumb } from "@/components/breadcrumb";
import { metaLocales } from "@/i18n/seo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { tokenCurrent } from "@/lib/session";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return { title: t("pages.login.metaTitle"), description: t("pages.login.metaDescription"), alternates: metaLocales(locale, "/login"), robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

export default async function LoginPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = createT(locale);
  if (await tokenCurrent()) redirect(`/${locale}/account`);

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <Breadcrumb crumbs={[{ name: t("pages.login.title") }]} className="mb-8" />
      <h1 className="font-heading text-3xl font-bold text-chalk-100">{t("pages.login.title")}</h1>
      <div aria-hidden className="gold-rule mt-3 h-0.5 w-16" />
      <p className="mt-4 text-sm leading-relaxed text-chalk-500">
        {t("pages.login.intro")}
      </p>

      <div className="mt-8">
        <LoginForm />
      </div>

      <p className="mt-8 flex gap-2 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" aria-hidden />
        {t("pages.login.security")}
      </p>
    </div>
  );
}
