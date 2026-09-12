import type { Metadata } from "next";
import { CreditWiki } from "@/components/credit-wiki";
import Link from "@/components/lien";
import { ListeHistoires, type EntreeHistoire } from "@/components/liste-histoires";
import { PaireLoreCarte } from "@/components/paire-lore";
import { PortraitHeros } from "@/components/portrait-heros";
import { EnTetePage, TitreSection } from "@/components/ui";
import type { Langue } from "@/i18n/config";
import { libelleHeros } from "@/i18n/donnees-heros";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesListeHeros, metaPage } from "@/i18n/seo";
import { creerT, messagesPage } from "@/i18n/traductions";
import { histoires, synchro } from "@/lib/donnees";
import { listeNoms } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { factionsLore, nomsHeros, pairesDe, pairesVedettes, regionDe, regionsLore, termesLore } from "@/lib/lore";

type Params = { params: Promise<{ locale: Langue }> };

/** Heros dont le wiki publie un recit ou une fiche narrative. */
function nombreHistoires(locale: Langue): number {
  const h = histoires(locale);
  return regionsLore.reduce((n, r) => n + r.heros.filter((x) => h[x.slug]?.lore.length || h[x.slug]?.profile).length, 0);
}

function description(locale: Langue): string {
  const t = creerT(locale);
  return t("pages.seo.lore.description", {
    n: nombreHistoires(locale),
    regions: regionsLore.length,
    exemples: listeNoms(locale, regionsLore.slice(0, 3).map((r) => libelleHeros(t, "region", r.nom)!)),
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.lore.titre"),
    description: description(locale),
    chemin: "/lore",
    motsCles: ["MLBB lore", "Mobile Legends lore", "Land of Dawn", "Moniyan Empire", "hero story"],
  });
}

export default async function PageLore({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const h = histoires(locale);
  const nomRegion = (nom: string) => libelleHeros(t, "region", nom)!;
  const paires = pairesDe(locale);
  const vedettes = pairesVedettes(paires, 8);
  // Les factions de deux heros restent sur les pages de region : le hub garde les plus grandes.
  const factions = factionsLore(locale, 3);
  const total = regionsLore.reduce((n, r) => n + r.heros.length, 0);
  const nHeros = (n: number) => t(n === 1 ? "pages.lore.nHeros1" : "pages.lore.nHeros", { n });
  const regionLibelle = (slug: string) => {
    const cle = regionDe(slug);
    const r = regionsLore.find((x) => x.cle === cle);
    return r ? nomRegion(r.nom) : null;
  };

  const donneesStructurees = donneesListeHeros(locale, {
    nom: t("pages.lore.listeLd"),
    description: description(locale),
    chemin: "/lore",
    heros: regionsLore.flatMap((r) => r.heros.map((x) => ({ nom: x.name, slug: x.slug }))),
  });

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.loreUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />
      <EnTetePage
        titre={t("pages.lore.titre")}
        chapeau={t("pages.lore.chapeau", { n: nombreHistoires(locale), regions: regionsLore.length, liens: paires.length })}
      />

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        <section id="regions">
          <TitreSection chapeau={t("pages.lore.regionsChapeau")}>{t("pages.lore.regionsTitre")}</TitreSection>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regionsLore.map((r) => (
              <li key={r.cle}>
                <Link
                  href={`/lore/${r.cle}`}
                  className="bevel group flex h-full flex-col gap-3 border border-night-700/70 bg-night-900/60 p-4 transition-colors hover:border-gold-500/60"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-heading text-lg font-bold text-chalk-100 group-hover:text-gold-400">{nomRegion(r.nom)}</span>
                    <span className="shrink-0 text-xs text-chalk-500">{nHeros(r.heros.length)}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {r.heros.slice(0, 5).map((x) => (
                      <PortraitHeros key={x.slug} source={x.images.icon ?? x.images.portrait} nom={x.name} taille="mini" decoratif />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {vedettes.length > 0 && (
          <section id="liens">
            <TitreSection chapeau={t("pages.lore.liensChapeau")}>{t("pages.lore.liensTitre")}</TitreSection>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {vedettes.map((p) => (
                <li key={`${p.a}-${p.b}`}>
                  <PaireLoreCarte paire={p} t={t} regions={[regionLibelle(p.a), regionLibelle(p.b)]} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {factions.length > 0 && (
          <section id="factions">
            <TitreSection chapeau={t("pages.lore.factionsChapeau")}>{t("pages.lore.factionsTitre")}</TitreSection>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {factions.map((f) => (
                <li key={f.cle} className="bevel-sm border border-night-700/60 bg-night-900/40 p-4">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-chalk-100">{f.nom}</span>
                    <span className="shrink-0 text-xs text-chalk-500">{nHeros(f.heros.length)}</span>
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {f.heros.map((s) => (
                      <li key={s}>
                        <Link
                          href={`/heroes/${s}#histoire`}
                          className="bevel-sm inline-block border border-night-700/70 bg-night-800/60 px-2 py-1 text-xs text-chalk-200 transition-colors hover:border-gold-500/60 hover:text-gold-400"
                        >
                          {nomsHeros.get(s) ?? s}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section id="histoires">
          <TitreSection chapeau={t("pages.lore.histoiresChapeau")}>{t("pages.lore.histoiresTitre")}</TitreSection>
          <ListeHistoires
            total={total}
            groupes={regionsLore.map((r) => ({
              cle: r.cle,
              nom: nomRegion(r.nom),
              heros: r.heros.map(
                (x): EntreeHistoire => [
                  x.slug,
                  x.name,
                  h[x.slug]?.tagline ?? h[x.slug]?.profile?.title ?? x.title,
                  x.images.icon ?? x.images.portrait,
                  termesLore(x, locale, nomRegion(r.nom)),
                ],
              ),
            }))}
          />
        </section>

        <CreditWiki t={t} href={synchro.source} cle="pages.lore.source" />
      </div>
    </CompleterMessages>
  );
}
