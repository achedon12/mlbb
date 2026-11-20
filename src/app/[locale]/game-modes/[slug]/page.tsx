import type { Metadata } from "next";
import { LOCALE_HTML } from "@/i18n/config";
import Image from "next/image";
import { Breadcrumb } from "@/components/breadcrumb";
import { serializeJsonLd } from "@/lib/html";
import { modeBySlug, modesSlugs } from "@/lib/data";
import { DexSays } from "@/components/mascot";
import { createT } from "@/i18n/translations";
import { WikiCredit } from "@/components/wiki-credit";
import { site } from "@/lib/site";
import type { Locale } from "@/i18n/config";
import { metaPage, notFoundMetadata } from "@/i18n/seo";
import type { ModeSection } from "@/lib/types";
import { NotFoundPage } from "@/components/not-found-page";

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return modesSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const mode = modeBySlug(locale, slug);
  if (!mode) return notFoundMetadata(locale);
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.modes.titleMode", { name: mode.name }),
    description: t(`modeSheet.${slug}.text`),
    path: `/game-modes/${slug}`,
    type: "article",
  });
}

/** Groups consecutive list items to render them in a single `<ul>`. */
function renderElements(elements: ModeSection["elements"]) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const clearList = (key: number) => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${key}`} className="space-y-2">
        {list.map((text, i) => (
          <li key={i} className="bevel-sm flex gap-3 bg-night-900 px-4 py-3 leading-relaxed text-chalk-200">
            <span aria-hidden className="mt-2.5 h-[3px] w-3 shrink-0 -skew-x-[25deg] bg-gold-400" />
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
        <p key={`p-${i}`} className="leading-relaxed text-chalk-200">
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
  if (!mode) return <NotFoundPage />;

  const t = createT(locale);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${t("pages.modes.titleMode", { name: mode.name })} — Mobile Legends: Bang Bang`,
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

      {/*
        Poster of the mode: its artwork shown whole on the right, the name
        in giant slanted capitals over the night, the tagline above it.
      */}
      <section aria-labelledby="mode-title" className="relative isolate overflow-hidden">
        <span aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(115deg,var(--color-night-800),var(--color-night-900)_50%,var(--color-night-950))]" />
        {mode.image && (
          <span aria-hidden className="absolute -right-10 bottom-0 top-16 -z-10 w-[85%] opacity-60 sm:right-[4%] sm:top-10 sm:w-[46%] sm:opacity-100">
            <Image
              src={mode.image}
              alt=""
              fill
              priority
              sizes="(min-width: 640px) 46vw, 85vw"
              className="affiche-art object-contain object-right-bottom drop-shadow-[0_24px_40px_rgb(0_0_0/0.6)]"
            />
          </span>
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-night-950/90 via-night-950/40 to-transparent" />

        <div className="page-wrap pb-10 pt-3 sm:pb-16 sm:pt-5">
          <Breadcrumb
            crumbs={[
              { name: t("nav.gameModes.label"), href: "/game-modes" },
              {
                name: mode.name,
                siblings: modesSlugs.map((s) => ({ name: modeBySlug(locale, s)?.name ?? s, href: `/game-modes/${s}` })),
              },
            ]}
            className="[&_ol]:flex-nowrap [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs"
          />
          <div className="mt-16 max-w-2xl sm:mt-24 lg:mt-32">
            <p className="font-heading text-lg font-bold uppercase text-gold-400">{t(`modeSheet.${slug}.tagline`)}</p>
            <h1 id="mode-title" className="affiche-name type-giant mt-1 break-words text-chalk-100">
              {mode.name}
            </h1>
            <div aria-hidden className="eclat mt-5 h-[3px] w-28" />
            <p className="mt-5 max-w-xl text-base leading-relaxed text-chalk-200 sm:text-lg">{t(`modeSheet.${slug}.text`)}</p>
          </div>
        </div>
        <div aria-hidden className="eclat-rule" />
      </section>

      <article className="page-wrap max-w-4xl py-10 sm:py-14">
        {mode.description && mode.description !== t(`modeSheet.${slug}.text`) && (
          <DexSays pose="reflexion" height={120} className="mb-12">
            <p className="leading-relaxed">{mode.description}</p>
          </DexSays>
        )}

        {mode.sections.length > 0 ? (
          <div className="space-y-12">
            {mode.sections.map((section) => (
              <section key={section.title}>
                <h2 className="display-caps text-[clamp(1.9rem,1.5rem+1.4vw,2.6rem)] text-chalk-100">{section.title}</h2>
                <div aria-hidden className="eclat mt-3 h-[3px] w-20" />
                <div className="mt-5 space-y-4">{renderElements(section.elements)}</div>
              </section>
            ))}
          </div>
        ) : (
          <DexSays pose="surpris" height={110}>
            <p>{t("pages.modeDetail.undocumented")}</p>
          </DexSays>
        )}

        <WikiCredit t={t} href="https://mobilelegends.fandom.com/wiki/Game_Modes" className="mt-12 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500" />
      </article>
    </>
  );
}
