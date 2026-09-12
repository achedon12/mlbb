import { NextResponse } from "next/server";
import visuels from "@/data/jeu/visuels.json";
import { LANGUES, type Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { article, articles } from "@/lib/contenu";
import { competences, contres, heros, objets, patchsDetail } from "@/lib/donnees";
import { duos } from "@/lib/duos";
import { regionsLore } from "@/lib/lore";
import { emblemesFiches, sortsFiches } from "@/lib/fiches-usage";
import type { EntreeRecherche } from "@/lib/recherche";
import { ACTUALITE, BASE } from "@/lib/rubriques";

/**
 * Index de la recherche globale, un fichier statique par langue. Le navigateur
 * ne le demande qu'a la premiere ouverture de la recherche.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return LANGUES.map((locale) => ({ locale }));
}

export async function GET(_requete: Request, { params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Langue;
  const t = creerT(locale);
  const images = (visuels as unknown as { items: Record<string, string> }).items;
  const competencesLangue = competences(locale);

  const entrees: EntreeRecherche[] = [
    ...heros.map((h) => ({
      type: "heros" as const,
      title: h.name,
      detail: [h.title, h.roles.map((r) => t(`roles.${r}`)).join(" / ")].filter(Boolean).join(" · "),
      href: `/heroes/${h.slug}`,
      image: h.images.icon ?? h.images.portrait,
    })),
    // Une entree « counters » par heros mesure : la requete « {heros} counter » est la plus cherchee.
    ...heros
      .filter((h) => contres[h.slug])
      .map((h) => ({
        type: "heros" as const,
        title: `${h.name} · ${t("pages.heroDetail.tab.counters")}`,
        href: `/heroes/${h.slug}/counters`,
        image: h.images.icon ?? h.images.portrait,
      })),
    ...heros
      .filter((h) => duos[h.slug])
      .map((h) => ({
        type: "heros" as const,
        title: `${h.name} · ${t("pages.heroDetail.duosShort")}`,
        href: `/heroes/${h.slug}/duos`,
        image: h.images.icon ?? h.images.portrait,
      })),
    // Regions du lore : la page de chaque region regroupe ses heros et leurs histoires.
    ...regionsLore.map((r) => ({ type: "page" as const, title: r.nom, detail: t("nav.lore.label"), href: `/lore/${r.cle}` })),
    ...objets(locale).map((o) => ({
      type: "objet" as const,
      title: o.name,
      detail: t(`categories.${o.category}`),
      href: `/items/${o.slug}`,
      image: images[o.slug] ?? null,
    })),
    ...emblemesFiches.map((f) => {
      const cle = `emblemData.${f.embleme.key}.nom`;
      const nom = t(cle);
      return {
        type: "embleme" as const,
        title: nom === cle ? f.embleme.name : nom,
        href: `/emblems/${f.slug}`,
        image: (visuels as unknown as { emblems: Record<string, string> }).emblems[f.embleme.key] ?? null,
      };
    }),
    ...sortsFiches.map((s) => ({ type: "sort" as const, title: s.nom, href: `/spells/${s.slug}`, image: s.image })),
    // Skins et competences menent a l'onglet de la fiche, ouvert par l'ancre.
    // Sans image : 1 600 chemins de visuels multipliaient l'index par huit. La
    // recherche leur prete l'icone de leur heros, deja dans l'index.
    ...heros.flatMap((h) =>
      (competencesLangue[h.slug] ?? []).flatMap((c) =>
        c ? [{ type: "competence" as const, title: c.name, detail: h.name, href: `/heroes/${h.slug}#competences` }] : [],
      ),
    ),
    ...heros.flatMap((h) =>
      h.skins.map((s) => ({ type: "skin" as const, title: s.name, detail: h.name, href: `/heroes/${h.slug}#skins` })),
    ),
    ...Object.values(patchsDetail).map((p) => ({
      type: "patch" as const,
      title: `Patch ${p.version}`,
      detail: p.title,
      href: `/patch-notes/${p.version}`,
    })),
    ...articles("patch-notes").map((a) => ({
      type: "patch" as const,
      title: article("patch-notes", a.slug, locale)?.title ?? a.title,
      href: `/patch-notes/${a.slug}`,
    })),
    ...articles("actualites").map((a) => ({
      type: "page" as const,
      title: article("actualites", a.slug, locale)?.title ?? a.title,
      href: `/news/${a.slug}`,
    })),
    ...[...BASE, ...ACTUALITE].map((e) => ({
      type: "page" as const,
      title: t(`nav.${e.cle}.label`),
      detail: t(`nav.${e.cle}.desc`),
      href: e.href,
    })),
    { type: "page" as const, title: t("pages.contribute.title"), detail: t("pages.contribute.summary"), href: "/contribute" },
  ];

  return NextResponse.json(entrees, { headers: { "Cache-Control": "public, max-age=3600" } });
}
