import type { Metadata } from "next";
import Link from "@/components/lien";
import { ComparateurHeros, type BornesRang, type HerosComparable, type TauxRang } from "@/components/comparateur-heros";
import { EnTetePage } from "@/components/ui";
import { contres, heros, herosParSlug } from "@/lib/donnees";
import { classementComplet, classementDuRang, RANGS_CLASSES, statsParRang } from "@/lib/tier-list";
import { dateLongue, patchActuel } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { adversairesMesures, cheminPaire, segmentPaire } from "@/lib/paires";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { donneesOutil, metaPage } from "@/i18n/seo";

/** Description en donnees : heros comparables, date du releve et patch. */
function descriptionComparateur(locale: Langue): string {
  const t = creerT(locale);
  return t("pages.seo.compare.descriptionTrois", { n: heros.length, date: dateLongue(locale), v: patchActuel.version });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.compare.titre", { v: patchActuel.version }),
    description: descriptionComparateur(locale),
    partage: t("pages.compare.ogDescription"),
    chemin: "/compare",
  });
}

const dixieme = (v: number) => Math.round(v * 10) / 10;

/**
 * Catalogue du comparateur : taux par rang en triplets compacts (victoire,
 * ban, palier) — six rangs pour 133 heros passent dans la page sans l'alourdir.
 */
const comparables: HerosComparable[] = heros.map((h) => ({
  slug: h.slug,
  nom: h.name,
  icone: h.images.icon ?? h.images.portrait,
  roles: h.roles,
  lanes: h.lanes,
  notes: h.ratings,
  taux: Object.fromEntries(
    Object.entries(statsParRang(h.slug)).map(([r, s]) => [r, [dixieme(s.winRate), dixieme(s.banRate), s.tier] satisfies TauxRang]),
  ),
  skins: h.skins.length,
}));

/** Etendue des taux de chaque rang, sur tout le catalogue : l'echelle des axes « taux » du radar. */
const bornes: Partial<Record<(typeof RANGS_CLASSES)[number], BornesRang>> = Object.fromEntries(
  RANGS_CLASSES.map((r) => {
    const entrees = classementDuRang(r);
    const etendue = (valeurs: number[]): [number, number] => [Math.min(...valeurs), Math.max(...valeurs)];
    return [r, { victoire: etendue(entrees.map((e) => e.winRate)), ban: etendue(entrees.map((e) => e.banRate)) }];
  }),
);

/**
 * Face-a-face mis en avant sous l'outil : pour chacun des heros les mieux
 * classes, son duel mesure le plus tranche. Le chemin des moteurs vers les
 * pages `/compare/{a}-vs-{b}`, qu'aucun menu ne liste.
 */
const DUELS_EN_AVANT = 12;
function duelsEnAvant(): { a: string; b: string }[] {
  const vus = new Set<string>();
  const sortie: { a: string; b: string }[] = [];
  for (const e of classementComplet) {
    const autre = adversairesMesures(contres, e.hero.slug).find(
      (x) => herosParSlug.has(x.slug) && !vus.has(segmentPaire(e.hero.slug, x.slug)),
    );
    if (!autre) continue;
    vus.add(segmentPaire(e.hero.slug, autre.slug));
    sortie.push({ a: e.hero.slug, b: autre.slug });
    if (sortie.length === DUELS_EN_AVANT) break;
  }
  return sortie;
}

export default async function PageComparateur({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const nomDe = (slug: string) => herosParSlug.get(slug)?.name ?? slug;

  const donneesStructurees = donneesOutil(locale, {
    nom: t("pages.compare.titre"),
    description: descriptionComparateur(locale),
    chemin: "/compare",
    categorie: "GameApplication",
  });

  const lien = "bevel-sm inline-block border border-night-700 px-2.5 py-1 text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <EnTetePage
        titre={t("pages.compare.titre")}
        chapeau={t("pages.compare.chapeauTrois")}
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ComparateurHeros heros={comparables} rangs={[...RANGS_CLASSES]} bornes={bornes} />

        <section aria-labelledby="duels" className="mt-14">
          <h2 id="duels" className="font-heading text-xl font-bold text-chalk-100">
            {t("pages.compare.duels.titre")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-chalk-500">{t("pages.compare.duels.intro")}</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {duelsEnAvant().map(({ a, b }) => (
              <li key={segmentPaire(a, b)}>
                <Link href={cheminPaire(a, b)} className={lien}>
                  {t("pages.versus.titre", { a: nomDe(a), b: nomDe(b) })}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
