import type { Metadata } from "next";
import { LOCALE_HTML } from "@/i18n/config";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { serializeJsonLd } from "@/lib/html";
import { modeBySlug, modesSlugs } from "@/lib/data";
import { ACCENT_MODE_DEFAULT, ACCENTS_MODES } from "@/lib/modes";
import { createT } from "@/i18n/translations";
import { WikiCredit } from "@/components/wiki-credit";
import { site } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import type { ModeSection } from "@/lib/types";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return modesSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const mode = modeBySlug(locale, slug);
  if (!mode) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.modes.titleMode", { nom: mode.name }),
    description: t(`modeSheet.${slug}.text`),
    path: `/game-modes/${slug}`,
    type: "article",
  });
}

/** Regroupe les points de liste consecutifs pour les rendre dans un seul `<ul>`. */
function renderElements(elements: ModeSection["elements"]) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const clearList = (key: number) => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${key}`} className="space-y-2.5">
        {list.map((text, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
            <span aria-hidden className="mt-2 size-1 shrink-0 bg-gold-500" />
            {text}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  elements.forEach((e, i) => {
    if (e.type === "li") {
      list.push(e.text);
    } else {
      clearList(i);
      blocks.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed text-chalk-300">
          {e.text}
        </p>,
      );
    }
  });
  clearList(elements.length);
  return blocks;
}

export default async function GameModePage({ params }: Params) {
  const { locale, slug } = await params;
  const mode = modeBySlug(locale, slug);
  if (!mode) notFound();

  const t = createT(locale);
  const [dark, light] = ACCENTS_MODES[slug] ?? ACCENT_MODE_DEFAULT;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${t("pages.modes.titleMode", { nom: mode.name })} — Mobile Legends: Bang Bang`,
    description: t(`modeSheet.${slug}.text`),
    inLanguage: LOCALE_HTML[locale],
    author: { "@type": "Person", name: site.author },
    publisher: { "@type": "Organization", name: site.name, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}/game-modes/${slug}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />

      {/* Banniere de tete, reprenant l'accent du mode. */}
      <div className="relative isolate overflow-hidden border-b border-night-700/70">
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{ background: `linear-gradient(115deg, ${dark} 0%, #0a0e1a 58%, #06080f 100%)` }}
        />
        {mode.image && (
          <Image
            aria-hidden
            src={mode.image}
            alt=""
            width={520}
            height={520}
            priority
            className="pointer-events-none absolute -right-10 top-1/2 -z-10 h-[150%] w-auto -translate-y-1/2 object-contain opacity-25 blur-[1px] sm:opacity-30"
          />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-night-950/90 via-night-950/50 to-transparent" />

        <div className="mx-auto max-w-4xl px-4 py-12">
          <Breadcrumb
            crumbs={[
              { name: t("nav.gameModes.label"), href: "/game-modes" },
              {
                name: mode.name,
                siblings: modesSlugs.map((s) => ({ name: modeBySlug(locale, s)?.name ?? s, href: `/game-modes/${s}` })),
              },
            ]}
          />
          <p className="mt-6 font-heading text-xs font-bold uppercase tracking-[0.2em]" style={{ color: light }}>
            {t(`modeSheet.${slug}.tagline`)}
          </p>
          <h1 className="mt-2 font-heading text-4xl font-bold text-chalk-100 sm:text-5xl">{mode.name}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-chalk-200">{t(`modeSheet.${slug}.text`)}</p>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-12">
        {mode.description && mode.description !== t(`modeSheet.${slug}.text`) && (
          <p className="mb-10 border-l-2 pl-4 leading-relaxed text-chalk-300" style={{ borderColor: light }}>
            {mode.description}
          </p>
        )}

        {mode.sections.length > 0 ? (
          <div className="space-y-10">
            {mode.sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-heading text-xl font-bold text-chalk-100">{section.title}</h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-12" />
                <div className="mt-4 space-y-4">{renderElements(section.elements)}</div>
              </section>
            ))}
          </div>
        ) : (
          <p className="leading-relaxed text-chalk-500">{t("pages.modeDetail.undocumented")}</p>
        )}

        <WikiCredit t={t} href="https://mobilelegends.fandom.com/wiki/Game_Modes" className="mt-12 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500" />
      </article>
    </>
  );
}
