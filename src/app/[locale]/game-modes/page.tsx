import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EnTetePage } from "@/components/ui";
import { CreditWiki } from "@/components/credit-wiki";
import { modes } from "@/lib/donnees";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { metaLangues } from "@/i18n/seo";
import { ACCENT_MODE_DEFAUT, ACCENTS_MODES } from "@/lib/modes";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return {
    title: t("pages.modes.titre"),
    description: t("pages.modes.metaDescription"),
    alternates: metaLangues(locale, "/game-modes"),
    openGraph: {
      title: `${t("pages.modes.titre")} — ${site.nom}`,
      description: t("pages.modes.ogDescription"),
      url: `/${locale}/game-modes`,
    },
  };
}

export default async function PageModes({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const liste = modes(locale);
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Modes de jeu de Mobile Legends: Bang Bang",
    numberOfItems: liste.length,
    itemListElement: liste.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nom,
      url: `${site.url}/${locale}/game-modes/${m.slug}`,
      description: t(`modeFiche.${m.slug}.texte`),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees).replace(/</g, "\\u003c") }}
      />
      <EnTetePage
        titre={t("pages.modes.titre")}
        chapeau={t("pages.modes.chapeau")}
      />

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-5">
          {liste.map((mode) => {
            const [sombre, clair] = ACCENTS_MODES[mode.slug] ?? ACCENT_MODE_DEFAUT;
            return (
              <Link
                key={mode.slug}
                href={`/game-modes/${mode.slug}`}
                className="biseau group relative isolate block overflow-hidden border border-nuit-700/70 transition-colors hover:border-nuit-600"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 -z-20"
                  style={{ background: `linear-gradient(115deg, ${sombre} 0%, #0a0e1a 55%, #06080f 100%)` }}
                />
                {mode.image && (
                  <Image
                    aria-hidden
                    src={mode.image}
                    alt=""
                    width={360}
                    height={360}
                    className="pointer-events-none absolute -right-6 top-1/2 -z-10 h-[130%] w-auto -translate-y-1/2 object-contain opacity-25 blur-[1px] transition duration-500 group-hover:opacity-35 sm:-right-2 sm:opacity-30"
                  />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 -z-10 bg-gradient-to-r from-nuit-950/85 via-nuit-950/45 to-transparent"
                />

                <div className="flex min-h-[180px] flex-col justify-end gap-3 p-6 sm:min-h-[200px] sm:p-8">
                  <p
                    className="font-titre text-[0.7rem] font-bold uppercase tracking-[0.2em]"
                    style={{ color: clair }}
                  >
                    {t(`modeFiche.${mode.slug}.accroche`)}
                  </p>
                  <h2 className="font-titre text-2xl font-bold text-craie-100 sm:text-3xl">{mode.nom}</h2>
                  <p className="max-w-xl text-sm leading-relaxed text-craie-300">
                    {t(`modeFiche.${mode.slug}.texte`)}
                  </p>
                  <span
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold transition-transform group-hover:translate-x-0.5"
                    style={{ color: clair }}
                  >
                    {t("pages.modes.decouvrir")}
                    <ArrowRight size={16} aria-hidden />
                  </span>
                </div>

                <div
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ background: `linear-gradient(90deg, ${clair}, transparent)` }}
                />
              </Link>
            );
          })}
        </div>

        <CreditWiki t={t} href="https://mobilelegends.fandom.com/wiki/Game_Modes" />
      </div>
    </>
  );
}
