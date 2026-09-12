import type { Metadata } from "next";
import { LOCALE_HTML } from "@/i18n/config";
import Image from "next/image";
import { notFound } from "next/navigation";
import { FilAriane } from "@/components/fil-ariane";
import { donneesLd } from "@/lib/html";
import { modeParSlug, modesSlugs } from "@/lib/donnees";
import { ACCENT_MODE_DEFAUT, ACCENTS_MODES } from "@/lib/modes";
import { creerT } from "@/i18n/traductions";
import { CreditWiki } from "@/components/credit-wiki";
import { site } from "@/lib/site";
import type { Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import type { SectionMode } from "@/lib/types";

type Params = { params: Promise<{ locale: Langue; slug: string }> };

export function generateStaticParams() {
  return modesSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const mode = modeParSlug(locale, slug);
  if (!mode) return {};
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.modes.titleMode", { nom: mode.name }),
    description: t(`modeSheet.${slug}.text`),
    chemin: `/game-modes/${slug}`,
    type: "article",
  });
}

/** Regroupe les points de liste consecutifs pour les rendre dans un seul `<ul>`. */
function rendreElements(elements: SectionMode["elements"]) {
  const blocs: React.ReactNode[] = [];
  let liste: string[] = [];

  const viderListe = (cle: number) => {
    if (!liste.length) return;
    blocs.push(
      <ul key={`ul-${cle}`} className="space-y-2.5">
        {liste.map((texte, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-chalk-300">
            <span aria-hidden className="mt-2 size-1 shrink-0 bg-gold-500" />
            {texte}
          </li>
        ))}
      </ul>,
    );
    liste = [];
  };

  elements.forEach((e, i) => {
    if (e.type === "li") {
      liste.push(e.text);
    } else {
      viderListe(i);
      blocs.push(
        <p key={`p-${i}`} className="text-sm leading-relaxed text-chalk-300">
          {e.text}
        </p>,
      );
    }
  });
  viderListe(elements.length);
  return blocs;
}

export default async function PageMode({ params }: Params) {
  const { locale, slug } = await params;
  const mode = modeParSlug(locale, slug);
  if (!mode) notFound();

  const t = creerT(locale);
  const [sombre, clair] = ACCENTS_MODES[slug] ?? ACCENT_MODE_DEFAUT;

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${t("pages.modes.titleMode", { nom: mode.name })} — Mobile Legends: Bang Bang`,
    description: t(`modeSheet.${slug}.text`),
    inLanguage: LOCALE_HTML[locale],
    author: { "@type": "Person", name: site.auteur },
    publisher: { "@type": "Organization", name: site.nom, url: site.url },
    mainEntityOfPage: `${site.url}/${locale}/game-modes/${slug}`,
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: "Moonton" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />

      {/* Banniere de tete, reprenant l'accent du mode. */}
      <div className="relative isolate overflow-hidden border-b border-night-700/70">
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{ background: `linear-gradient(115deg, ${sombre} 0%, #0a0e1a 58%, #06080f 100%)` }}
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
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-night-950/90 via-night-950/50 to-transparent" />

        <div className="mx-auto max-w-4xl px-4 py-12">
          <FilAriane
            miettes={[
              { nom: t("nav.gameModes.label"), href: "/game-modes" },
              {
                nom: mode.name,
                freres: modesSlugs.map((s) => ({ nom: modeParSlug(locale, s)?.name ?? s, href: `/game-modes/${s}` })),
              },
            ]}
          />
          <p className="mt-6 font-heading text-xs font-bold uppercase tracking-[0.2em]" style={{ color: clair }}>
            {t(`modeSheet.${slug}.tagline`)}
          </p>
          <h1 className="mt-2 font-heading text-4xl font-bold text-chalk-100 sm:text-5xl">{mode.name}</h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-chalk-200">{t(`modeSheet.${slug}.text`)}</p>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-12">
        {mode.description && mode.description !== t(`modeSheet.${slug}.text`) && (
          <p className="mb-10 border-l-2 pl-4 leading-relaxed text-chalk-300" style={{ borderColor: clair }}>
            {mode.description}
          </p>
        )}

        {mode.sections.length > 0 ? (
          <div className="space-y-10">
            {mode.sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-heading text-xl font-bold text-chalk-100">{section.title}</h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-12" />
                <div className="mt-4 space-y-4">{rendreElements(section.elements)}</div>
              </section>
            ))}
          </div>
        ) : (
          <p className="leading-relaxed text-chalk-500">{t("pages.modeDetail.undocumented")}</p>
        )}

        <CreditWiki t={t} href="https://mobilelegends.fandom.com/wiki/Game_Modes" className="mt-12 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500" />
      </article>
    </>
  );
}
