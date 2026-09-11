import { NextResponse } from "next/server";
import visuels from "@/data/jeu/visuels.json";
import { LANGUES, type Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { article, articles } from "@/lib/contenu";
import { heros, objets, patchsDetail } from "@/lib/donnees";
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
  const images = (visuels as unknown as { objets: Record<string, string> }).objets;

  const entrees: EntreeRecherche[] = [
    ...heros.map((h) => ({
      type: "heros" as const,
      titre: h.nom,
      detail: [h.titre, h.roles.map((r) => t(`roles.${r}`)).join(" / ")].filter(Boolean).join(" · "),
      href: `/heroes/${h.slug}`,
      image: h.visuels.icone ?? h.visuels.portrait,
    })),
    ...objets(locale).map((o) => ({
      type: "objet" as const,
      titre: o.nom,
      detail: t(`categories.${o.categorie}`),
      href: `/items#${o.slug}`,
      image: images[o.slug] ?? null,
    })),
    ...Object.values(patchsDetail).map((p) => ({
      type: "patch" as const,
      titre: `Patch ${p.version}`,
      detail: p.titre,
      href: `/patch-notes/${p.version}`,
    })),
    ...articles("patch-notes").map((a) => ({
      type: "patch" as const,
      titre: article("patch-notes", a.slug, locale)?.titre ?? a.titre,
      href: `/patch-notes/${a.slug}`,
    })),
    ...articles("actualites").map((a) => ({
      type: "page" as const,
      titre: article("actualites", a.slug, locale)?.titre ?? a.titre,
      href: `/news/${a.slug}`,
    })),
    ...[...BASE, ...ACTUALITE].map((e) => ({
      type: "page" as const,
      titre: t(`nav.${e.cle}.label`),
      detail: t(`nav.${e.cle}.desc`),
      href: e.href,
    })),
  ];

  return NextResponse.json(entrees, { headers: { "Cache-Control": "public, max-age=3600" } });
}
