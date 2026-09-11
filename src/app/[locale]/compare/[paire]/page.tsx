import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/lien";
import { LigneFraicheur } from "@/components/fraicheur";
import { PortraitHeros } from "@/components/portrait-heros";
import { STYLES_SERIES, TraitLegende } from "@/components/radar-heros";
import { Carte, EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import { formaterEcart, objetsContre, porteVolDeVie } from "@/lib/contrer";
import { buildsJoues, coequipiers, contres, herosParSlug, objets } from "@/lib/donnees";
import { duos } from "@/lib/duos";
import { dureeDe } from "@/lib/evolution";
import { dateLongue, dateMesure, patchActuel, pourcentage } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import { adversairesMesures, cheminPaire, duelDeReference, duelParRang, lecturePhases, liensEquipe, lirePaire, phasesDuel, rangsGagnes, SEUIL_EQUILIBRE, type DuelRang } from "@/lib/paires";
import type { RangMesure } from "@/lib/rangs-mesure";
import { site } from "@/lib/site";
import { statsParRang } from "@/lib/tier-list";
import type { Heros } from "@/lib/types";
import { cn } from "@/lib/utils";
import { visuelObjet } from "@/lib/visuels-build";

/**
 * Page face-a-face « {a} vs {b} » : qui gagne le duel, rang par rang.
 *
 * Seules les paires au duel mesure ont une page — b parmi les ecarts les plus
 * marques de a, ou l'inverse, a un rang au moins —, dans l'ordre alphabetique
 * des slugs : l'ordre inverse n'est pas genere et tombe sur la 404. Page
 * sobre, tout en composants serveur : quelques milliers d'adresses par langue.
 */

type Params = { params: Promise<{ locale: Langue; paire: string }> };

// Pres de 3 000 paires en quatre langues : les generer au build ajouterait des
// gigaoctets pour des pages que l'on visite une a une. Chacune est rendue a sa
// premiere demande, puis servie depuis le cache une journee ; une paire non
// mesuree ou dans l'ordre inverse tombe toujours sur la 404 (`resoudre`).
export const dynamicParams = true;
export const revalidate = 86400;

export function generateStaticParams() {
  return [];
}

const nomDe = (slug: string) => herosParSlug.get(slug)?.nom ?? slug;

/** Les deux heros d'un segment canonique, ou null. */
function resoudre(paire: string): { a: Heros; b: Heros } | null {
  const p = lirePaire(paire);
  const a = p?.canonique ? herosParSlug.get(p.a) : undefined;
  const b = p?.canonique ? herosParSlug.get(p.b) : undefined;
  return a && b ? { a, b } : null;
}

const contexteDe = (t: T, rang: RangMesure) =>
  rang === "all" ? t("pages.duos.tousRangs") : t("pages.duos.auRang", { rang: t(`rangsMesure.${rang}`) });

/** Verdict du duel, commun a la description, au chapeau et a la reponse de la FAQ. */
function verdict(locale: Langue, a: Heros, b: Heros) {
  const t = creerT(locale);
  const duels = duelParRang(contres, a.slug, b.slug);
  const ref = duelDeReference(duels);
  if (!ref) return { duels, ref, phrase: t("pages.versus.aucuneMesure", { a: a.nom, b: b.nom }) };
  const points = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const [gagnant, perdant] = ref.avantage >= 0 ? [a, b] : [b, a];
  const contexte = contexteDe(t, ref.rang);
  const tete =
    Math.abs(ref.avantage) < SEUIL_EQUILIBRE
      ? t("pages.versus.equilibre", { contexte, a: a.nom, b: b.nom })
      : t("pages.versus.verdict", {
          contexte,
          gagnant: gagnant.nom,
          perdant: perdant.nom,
          ecart: `${points.format(Math.abs(ref.avantage))} ${t("contres.pts")}`,
        });
  const g = rangsGagnes(duels);
  const suite = g.total > 1 ? ` ${t("pages.versus.rangs", { a: a.nom, na: g.a, b: b.nom, nb: g.b, total: g.total })}` : "";
  return { duels, ref, phrase: `${tete}${suite}` };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, paire } = await params;
  const p = resoudre(paire);
  if (!p) return {};
  const t = creerT(locale);
  const noms = { a: p.a.nom, b: p.b.nom };
  return metaPage(locale, {
    titre: patchActuel ? t("pages.versus.metaTitre", { ...noms, v: patchActuel.version }) : t("pages.versus.metaTitreSansPatch", noms),
    description: `${verdict(locale, p.a, p.b).phrase} ${t("pages.duos.majLe", { date: dateLongue(locale) })}`,
    chemin: cheminPaire(p.a.slug, p.b.slug),
    type: "article",
  });
}

/** Build le plus joue d'un heros sur sa position principale, au rang demande ou tous rangs. */
function buildDe(h: Heros, rang: RangMesure) {
  const parLane = buildsJoues[h.slug] ?? {};
  const lane = h.lanes.find((l) => parLane[l]) ?? Object.keys(parLane)[0];
  const build = lane ? (parLane[lane]?.[rang]?.[0] ?? parLane[lane]?.all?.[0]) : undefined;
  return lane && build ? { lane, build } : null;
}

export default async function PageFaceAFace({ params }: Params) {
  const { locale, paire } = await params;
  const p = resoudre(paire);
  if (!p) notFound();
  const { a, b } = p;

  const t = creerT(locale);
  const ecart = (v: number) => formaterEcart(locale, t, v);
  const decimal = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const { duels, ref, phrase } = verdict(locale, a, b);
  const rangRef: RangMesure = ref?.rang ?? "all";

  // Taux par duree de partie : au rang du verdict quand les deux y sont mesures.
  const [da, db] = [dureeDe(a.slug), dureeDe(b.slug)];
  const rangDuree: RangMesure | null = da[rangRef] && db[rangRef] ? rangRef : da.all && db.all ? "all" : null;
  const parPhase = rangDuree ? phasesDuel(da[rangDuree], db[rangDuree]) : [];
  const lecture = lecturePhases(parPhase);
  const ecarts = parPhase.flatMap((x) => (x.ecart === null ? [] : [x.ecart]));
  const phraseDuree =
    ecarts.length === 0
      ? null
      : ecarts.every((e) => e > 0)
        ? t("pages.versus.duree.toujours", { nom: a.nom })
        : ecarts.every((e) => e < 0)
          ? t("pages.versus.duree.toujours", { nom: b.nom })
          : lecture.a && lecture.b
            ? t("pages.versus.duree.phrase", {
                a: a.nom,
                phaseA: t(`pages.versus.phaseEn.${lecture.a}`),
                b: b.nom,
                phaseB: t(`pages.versus.phaseEn.${lecture.b}`),
              })
            : t("pages.versus.duree.egal", { a: a.nom, b: b.nom });

  // Profils au rang du verdict : taux de la tier list et notes du jeu.
  const [sa, sb] = [statsParRang(a.slug)[rangRef], statsParRang(b.slug)[rangRef]];

  // Builds : le plus joue de chacun, et les objets qu'une regle oppose a l'autre.
  const catalogue = new Map(objets(locale).map((o) => [o.slug, o]));
  const bonusAnglais = new Map(objets("en").map((o) => [o.slug, o.bonus]));
  const contreDe = (h: Heros) => {
    const bonus = (buildDe(h, "all")?.build.objets ?? []).map((o) => bonusAnglais.get(visuelObjet(o).slug ?? "") ?? null);
    return objetsContre(
      { typeDegats: h.typeDegats, roles: h.roles, specialites: h.specialites, volDeVie: porteVolDeVie(bonus) },
      (s) => catalogue.has(s),
    )
      .slice(0, 4)
      .map((c) => catalogue.get(c.slug)!);
  };
  const builds = [
    { h: a, autre: b, joue: buildDe(a, rangRef), contre: contreDe(b) },
    { h: b, autre: a, joue: buildDe(b, rangRef), contre: contreDe(a) },
  ];

  const equipe = liensEquipe(duos, coequipiers, a.slug, b.slug);
  const autresDe = (x: Heros, sauf: Heros) =>
    adversairesMesures(contres, x.slug)
      .filter((e) => e.slug !== sauf.slug && herosParSlug.has(e.slug))
      .slice(0, 6);

  const titre = t("pages.versus.titre", { a: a.nom, b: b.nom });
  const question = t("pages.versus.question", { a: a.nom, b: b.nom });
  const chemin = cheminPaire(a.slug, b.slug);
  const adresse = `${site.url}/${locale}${chemin}`;
  const donneesStructurees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${adresse}#article`,
        headline: titre,
        description: phrase,
        inLanguage: LOCALE_HTML[locale],
        dateModified: dateMesure,
        author: { "@type": "Person", name: site.auteur },
        publisher: { "@type": "Organization", name: site.nom, url: site.url },
        mainEntityOfPage: adresse,
        about: [a, b].map((h) => ({ "@type": "Thing", name: h.nom, url: `${site.url}/${locale}/heroes/${h.slug}` })),
        isPartOf: {
          "@type": "VideoGame",
          name: "Mobile Legends: Bang Bang",
          publisher: { "@type": "Organization", name: "Moonton" },
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${adresse}#faq`,
        inLanguage: LOCALE_HTML[locale],
        mainEntity: [{ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: phrase } }],
      },
    ],
  };

  const puce = "biseau-sm inline-block border border-nuit-700 px-2.5 py-1 text-craie-300 hover:text-or-400";
  const h2 = "font-titre text-2xl font-bold text-craie-100";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }} />

      <EnTetePage
        titre={titre}
        chapeau={t("pages.versus.chapeau", { a: a.nom, b: b.nom })}
        miettes={[
          { nom: t("pages.compare.titre"), href: "/compare" },
          {
            nom: titre,
            // Pages soeurs : les autres duels mesures du premier heros.
            freres: adversairesMesures(contres, a.slug)
              .filter((e) => herosParSlug.has(e.slug))
              .slice(0, 20)
              .map((e) => ({ nom: t("pages.versus.titre", { a: a.nom, b: nomDe(e.slug) }), href: cheminPaire(a.slug, e.slug) }))
              .sort((x, y) => x.nom.localeCompare(y.nom)),
          },
        ]}
      >
        <LigneFraicheur langue={locale} className="mt-4" />
      </EnTetePage>

      <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">
        {/* ── Les deux heros ──────────────────────────────────────────── */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {[
            { h: a, s: sa },
            { h: b, s: sb },
          ].map(({ h, s }, i) => (
            <Link
              key={h.slug}
              href={`/heroes/${h.slug}`}
              className={cn(
                "biseau flex min-w-0 flex-col items-center gap-2 border border-nuit-700/70 bg-nuit-900/60 p-3 text-center transition-colors hover:border-or-500/60",
                i === 1 && "order-3",
              )}
            >
              <PortraitHeros source={h.visuels.icone ?? h.visuels.portrait} nom={h.nom} taille="vignette" decoratif />
              <span className="font-titre text-lg font-bold text-craie-100">{h.nom}</span>
              {s && (
                <span className="text-xs text-craie-500">
                  {t("pages.heroDetail.palier", { p: s.palier })} · {pourcentage(locale, s.victoire)}
                </span>
              )}
              <TraitLegende {...STYLES_SERIES[i]} />
            </Link>
          ))}
          <span aria-hidden className="order-2 font-titre text-xl font-bold text-or-400">
            VS
          </span>
        </div>

        {/* ── Verdict, rang par rang ──────────────────────────────────── */}
        <section aria-labelledby="verdict">
          <h2 id="verdict" className={h2}>
            {question}
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-craie-300">{phrase}</p>
          {duels.length > 0 && (
            <div className="biseau mt-5 relative overflow-x-auto border border-nuit-700/70 bg-nuit-900/60 p-3">
              <TableauDuel t={t} duels={duels} a={a} b={b} ecart={ecart} />
            </div>
          )}
          <p className="mt-2 text-xs leading-relaxed text-craie-500">{t("pages.versus.noteEcarts", { a: a.nom, b: b.nom })}</p>
        </section>

        {/* ── Debut ou fin de partie ──────────────────────────────────── */}
        {rangDuree && phraseDuree && (
          <section aria-labelledby="duree">
            <h2 id="duree" className={h2}>
              {t("pages.versus.duree.titre")}
            </h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-craie-300">{phraseDuree}</p>
            <div className="biseau mt-4 relative overflow-x-auto border border-nuit-700/70 bg-nuit-900/60 p-3">
              <table className="w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-3 [&_td+td]:text-right [&_td+td]:tabular-nums [&_th+th]:pl-3 [&_th+th]:text-right">
                <thead className="text-xs uppercase tracking-wide text-craie-500 [&_th]:pb-2 [&_th]:font-medium">
                  <tr>
                    <th scope="col" className="text-left">{t("pages.versus.duree.colPhase")}</th>
                    <th scope="col">{a.nom}</th>
                    <th scope="col">{b.nom}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nuit-800">
                  {parPhase.map((x) => (
                    <tr key={x.phase}>
                      <th scope="row" className="py-1.5 text-left font-normal text-craie-300">
                        {t(`pages.duos.phase.${x.phase}`)}{" "}
                        <span className="text-xs text-craie-500">({t(`pages.duos.phaseMinutes.${x.phase}`)})</span>
                      </th>
                      {[x.a, x.b].map((v, k) => {
                        const tete = x.ecart !== null && (k === 0 ? x.ecart > 0 : x.ecart < 0);
                        return (
                          <td key={k} className={cn("font-semibold", tete ? "text-or-400" : "text-craie-300")}>
                            {v === null ? "—" : pourcentage(locale, v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-craie-500">
              {t("pages.versus.duree.note", { rang: t(`rangsMesure.${rangDuree}`) })}
            </p>
          </section>
        )}

        {/* ── Profils ─────────────────────────────────────────────────── */}
        {/* Tableau seul, sans radar : la page reste legere, et le radar vit au comparateur. */}
        <section aria-labelledby="profils">
          <h2 id="profils" className={h2}>
            {t("pages.versus.profils", { rang: t(`rangsMesure.${rangRef}`) })}
          </h2>
          <div className="mt-4 max-w-xl">
            <div className="biseau relative overflow-x-auto border border-nuit-700/70 bg-nuit-900/60 p-3">
              <table className="w-full text-sm [&_td]:py-1.5 [&_td]:pl-3 [&_td]:text-right [&_td]:tabular-nums [&_td]:text-craie-200">
                <thead className="text-xs uppercase tracking-wide text-craie-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
                  <tr>
                    <th scope="col" className="text-left">
                      <span className="sr-only">{t("compareUI.critere")}</span>
                    </th>
                    <th scope="col">{a.nom}</th>
                    <th scope="col">{b.nom}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nuit-800 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-craie-500">
                  <tr>
                    <th scope="row">{t("compareUI.tauxVictoire")}</th>
                    <td>{sa ? pourcentage(locale, sa.victoire) : "—"}</td>
                    <td>{sb ? pourcentage(locale, sb.victoire) : "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">{t("compareUI.tauxBan")}</th>
                    <td>{sa ? pourcentage(locale, sa.ban) : "—"}</td>
                    <td>{sb ? pourcentage(locale, sb.ban) : "—"}</td>
                  </tr>
                  {(["offensive", "resistance", "effets", "difficulte"] as const).map((cle) => (
                    <tr key={cle}>
                      <th scope="row">{t(`compareUI.${cle}`)}</th>
                      <td>{a.notes[cle] ?? "—"}</td>
                      <td>{b.notes[cle] ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Builds ──────────────────────────────────────────────────── */}
        {builds.some((x) => x.joue || x.contre.length > 0) && (
          <section aria-labelledby="builds">
            <h2 id="builds" className={h2}>
              {t("pages.versus.builds.titre")}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {builds.map(({ h, autre, joue, contre }) => (
                <Carte key={h.slug} className="p-4">
                  <h3 className="font-titre text-lg font-bold text-craie-100">{h.nom}</h3>
                  {joue && (
                    <>
                      <p className="mt-2 text-xs uppercase tracking-wide text-craie-500">
                        {t("pages.versus.builds.joue", { lane: t(`lanes.${joue.lane}`) })}
                      </p>
                      <ListeObjets
                        objets={joue.build.objets.map((nom) => {
                          const slugObjet = visuelObjet(nom).slug;
                          return { nom: (slugObjet && catalogue.get(slugObjet)?.nom) || nom, slug: slugObjet };
                        })}
                      />
                      {(joue.build.embleme || joue.build.sort) && (
                        <p className="mt-2 text-xs text-craie-400">
                          {[joue.build.embleme, joue.build.sort].filter(Boolean).join(" · ")}
                          {joue.build.victoire != null && ` · ${t("builds.victoire", { taux: decimal.format(joue.build.victoire) })}`}
                        </p>
                      )}
                    </>
                  )}
                  {contre.length > 0 && (
                    <>
                      <p className="mt-4 text-xs uppercase tracking-wide text-craie-500">
                        {t("pages.versus.builds.contre", { nom: autre.nom })}{" "}
                        <span className="normal-case tracking-normal">· {t("pages.versus.builds.regle")}</span>
                      </p>
                      <ListeObjets objets={contre.map((o) => ({ nom: o.nom, slug: o.slug }))} />
                    </>
                  )}
                </Carte>
              ))}
            </div>
          </section>
        )}

        {/* ── Dans la meme equipe ─────────────────────────────────────── */}
        {equipe.length > 0 && (
          <section aria-labelledby="equipe">
            <h2 id="equipe" className={h2}>
              {t("pages.versus.equipe.titre", { a: a.nom, b: b.nom })}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-craie-300">
              {equipe.map((e) => (
                <li key={`${e.rang}-${e.de}`}>
                  {t("pages.versus.equipe.ligne", {
                    contexte: contexteDe(t, e.rang),
                    de: nomDe(e.de),
                    avec: nomDe(e.avec),
                    ecart: ecart(e.avantage),
                  })}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-craie-500">{t("pages.versus.equipe.note")}</p>
          </section>
        )}

        {/* ── Pour aller plus loin ────────────────────────────────────── */}
        <section aria-labelledby="liens">
          <h2 id="liens" className="font-titre text-xl font-bold text-craie-100">
            {t("pages.versus.liens.titre")}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            <li>
              <Link href={`/compare?a=${a.slug}&b=${b.slug}`} className={puce}>
                {t("pages.versus.liens.comparateur")}
              </Link>
            </li>
            {[a, b].flatMap((h) => [
              <li key={`${h.slug}-fiche`}>
                <Link href={`/heroes/${h.slug}`} className={puce}>
                  {t("pages.duos.lienFiche", { nom: h.nom })}
                </Link>
              </li>,
              <li key={`${h.slug}-contres`}>
                <Link href={`/heroes/${h.slug}/counters`} className={puce}>
                  {t("pages.duos.lienContres", { nom: h.nom })}
                </Link>
              </li>,
              <li key={`${h.slug}-duos`}>
                <Link href={`/heroes/${h.slug}/duos`} className={puce}>
                  {t("pages.duos.titre", { nom: h.nom })}
                </Link>
              </li>,
            ])}
          </ul>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {[
              { h: a, autres: autresDe(a, b) },
              { h: b, autres: autresDe(b, a) },
            ].map(({ h, autres }) =>
              autres.length > 0 ? (
                <div key={h.slug}>
                  <h3 className="text-sm font-semibold text-craie-100">{t("pages.versus.liens.autres", { nom: h.nom })}</h3>
                  <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                    {autres.map((e) => (
                      <li key={e.slug}>
                        <Link href={cheminPaire(h.slug, e.slug)} className={puce}>
                          {t("pages.versus.titre", { a: h.nom, b: nomDe(e.slug) })}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        </section>
      </div>
    </>
  );
}

/** Ecarts du duel par rang : l'avantage net, puis ce que chacun perd ou gagne face a l'autre. */
function TableauDuel({
  t,
  duels,
  a,
  b,
  ecart,
}: {
  t: T;
  duels: DuelRang[];
  a: Heros;
  b: Heros;
  ecart: (v: number) => string;
}) {
  const valeur = (v: number | null) =>
    v === null ? "—" : <span className={v >= 0 ? "text-emerald-400" : "text-sang-500"}>{ecart(v)}</span>;
  return (
    <table className="w-full text-sm [&_td]:py-1.5 [&_td+td]:pl-3 [&_td+td]:text-right [&_td+td]:whitespace-nowrap [&_td+td]:tabular-nums">
      <thead className="text-xs uppercase tracking-wide text-craie-500 [&_th]:pb-2 [&_th]:font-medium [&_th+th]:pl-3 [&_th+th]:text-right">
        <tr>
          <th scope="col" className="text-left">{t("pages.versus.colRang")}</th>
          <th scope="col">{t("pages.versus.colAvantage")}</th>
          <th scope="col">{t("pages.versus.colFace", { de: a.nom, face: b.nom })}</th>
          <th scope="col">{t("pages.versus.colFace", { de: b.nom, face: a.nom })}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-nuit-800">
        {duels.map((d) => {
          const equilibre = Math.abs(d.avantage) < SEUIL_EQUILIBRE;
          return (
            <tr key={d.rang}>
              <td className="text-craie-300">{t(`rangsMesure.${d.rang}`)}</td>
              <td className="font-semibold">
                {equilibre ? (
                  <span className="text-craie-400">{t("pages.versus.equilibreCourt")}</span>
                ) : (
                  <span className="text-or-400">
                    {(d.avantage > 0 ? a : b).nom} {ecart(Math.abs(d.avantage))}
                  </span>
                )}
              </td>
              <td>{valeur(d.aContreB)}</td>
              <td>{valeur(d.bContreA)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Objets en ligne, par leur nom, lien vers le catalogue quand l'objet y figure.
 * Sans icone : des milliers de pages face-a-face, chacune doit rester legere.
 */
function ListeObjets({ objets: liste }: { objets: { nom: string; slug: string | null }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5 text-sm text-craie-100 [&_a]:hover:text-or-400 [&_li]:border [&_li]:border-nuit-700 [&_li]:px-2 [&_li]:py-0.5">
      {liste.map((o, i) => (
        <li key={`${o.nom}-${i}`} className="biseau-sm">
          {o.slug ? <Link href={`/items#${o.slug}`}>{o.nom}</Link> : o.nom}
        </li>
      ))}
    </ul>
  );
}
