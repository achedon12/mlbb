import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "@/components/lien";
import { EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { creerT, type T } from "@/i18n/traductions";
import { herosParSlug, synchro } from "@/lib/donnees";
import { donneesLd } from "@/lib/html";
import { rarete, raretesPresentes } from "@/lib/raretes";
import { site } from "@/lib/site";
import { formaterSortie, MONNAIES, type SkinComplet } from "@/lib/skins";
import { ancresGalerie, elide, galerieHeros, herosAvecSkins, titreGalerie, type GalerieHeros } from "@/lib/skins-heros";
import type { Heros } from "@/lib/types";

/**
 * Galerie des skins d'un heros : chaque skin avec son illustration, son
 * portrait de boutique, sa rarete, sa sortie, sa disponibilite et son prix,
 * tout rendu par le serveur. La vitrine de la fiche montre un skin a la fois ;
 * ici, tout se lit — et s'indexe — d'un coup.
 */

type Params = { params: Promise<{ locale: Langue; slug: string }> };

export const dynamicParams = false;

/** Une galerie par heros qui a au moins un skin ou une illustration. */
export function generateStaticParams() {
  return herosAvecSkins.map((h) => ({ slug: h.slug }));
}

/** Date lisible par une machine : jour, mois ou annee (« 201X » n'en est pas une). */
const DATE_ISO = /^\d{4}(-\d{2}){0,2}$/;

/** Skin du catalogue le plus recent parmi ceux dont la date se lit. */
function plusRecent(g: GalerieHeros): SkinComplet | null {
  return g.skins.filter((s) => DATE_ISO.test(s.release ?? "")).sort((a, b) => b.release!.localeCompare(a.release!))[0] ?? null;
}

function description(t: T, locale: Langue, h: Heros, g: GalerieHeros): string {
  const base = t("pages.heroSkins.metaDescription", { nom: h.name, n: g.total });
  const recent = plusRecent(g);
  if (!recent) return base;
  return `${base} ${t("pages.heroSkins.dernier", { skin: recent.name, date: formaterSortie(recent.release!, locale) })}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) return {};
  const t = creerT(locale);
  const g = galerieHeros(h);
  const el = elide(locale, h.name);
  return metaPage(locale, {
    titre: t(el ? "pages.heroSkins.metaTitreElision" : "pages.heroSkins.metaTitre", { nom: h.name, n: g.total }),
    description: description(t, locale, h, g),
    chemin: `/heroes/${slug}/skins`,
    image: `/${locale}/heroes/${slug}/opengraph-image`,
  });
}

export default async function PageSkinsHeros({ params }: Params) {
  const { locale, slug } = await params;
  const h = herosParSlug.get(slug);
  if (!h) notFound();
  const g = galerieHeros(h);
  if (g.total === 0) notFound();

  const t = creerT(locale);
  // Rarete, disponibilite et etiquette inconnues du catalogue gardent leur libelle d'origine.
  const tr = (ns: string, v: string) => {
    const cle = `${ns}.${v}`;
    const trad = t(cle);
    return trad === cle ? v : trad;
  };
  const nombre = new Intl.NumberFormat(locale);
  const titre = titreGalerie(t, locale, h.name);
  const ancres = ancresGalerie(g);
  const recent = plusRecent(g);
  const absolue = (chemin: string) => new URL(chemin, site.url).toString();
  const altIllustration = (skin: string) => t("pages.heroSkins.altIllustration", { skin, nom: h.name });
  const altPortrait = (skin: string) => t("pages.heroSkins.altPortrait", { skin, nom: h.name });
  const prix = (s: SkinComplet) =>
    Object.entries(s.price)
      .map(([m, v]) => {
        // « other » porte un texte (« Twilight Pass »), pas un montant.
        if (m === "other") return v;
        const montant = /^\d+$/.test(v) ? nombre.format(Number(v)) : v;
        return `${montant} ${MONNAIES[m] ? t(`skinsUI.${MONNAIES[m]}`) : m}`;
      })
      .join(" / ");

  const parDispo = new Map<string, number>();
  for (const s of g.skins) if (s.availability) parDispo.set(s.availability, (parDispo.get(s.availability) ?? 0) + 1);

  const voisins = [...herosAvecSkins].sort((a, b) => a.name.localeCompare(b.name, "en"));
  const position = voisins.findIndex((x) => x.slug === h.slug);
  const precedent = voisins[(position - 1 + voisins.length) % voisins.length];
  const suivant = voisins[(position + 1) % voisins.length];

  const image = (chemin: string, nom: string, legende: string, extra: Record<string, string> = {}) => ({
    "@type": "ImageObject",
    contentUrl: absolue(chemin),
    name: nom,
    caption: legende,
    creditText: "Moonton",
    copyrightNotice: "© Moonton",
    ...extra,
  });
  const donnees = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: titre,
    description: description(t, locale, h, g),
    url: `${site.url}/${locale}/heroes/${h.slug}/skins`,
    inLanguage: LOCALE_HTML[locale],
    dateModified: synchro.date,
    isPartOf: { "@type": "WebSite", name: site.nom, url: site.url },
    about: { "@type": "VideoGame", name: "Mobile Legends: Bang Bang", publisher: { "@type": "Organization", name: "Moonton" } },
    associatedMedia: [
      ...g.skins.flatMap((s) => {
        const chemin = s.illustration ?? s.portrait;
        if (!chemin) return [];
        return [
          image(chemin, s.name, s.illustration ? altIllustration(s.name) : altPortrait(s.name), {
            ...(s.illustration && s.portrait ? { thumbnailUrl: absolue(s.portrait) } : {}),
            ...(s.release && DATE_ISO.test(s.release) ? { datePublished: s.release } : {}),
          }),
        ];
      }),
      ...g.autres.map((a) => image(a.illustration, a.nom, altIllustration(a.nom))),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(donnees) }} />
      <EnTetePage
        titre={titre}
        chapeau={t("pages.heroSkins.chapeau", { nom: h.name, n: g.total })}
        miettes={[
          { nom: t("nav.heroes.label"), href: "/heroes" },
          { nom: h.name, href: `/heroes/${h.slug}` },
          {
            nom: t("pages.heroDetail.onglet.skins"),
            freres: voisins.map((x) => ({ nom: x.name, href: `/heroes/${x.slug}/skins` })),
          },
        ]}
      >
        <div className="mt-6 space-y-3 text-sm text-chalk-500">
          {parDispo.size > 0 && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              {[...parDispo].map(([dispo, n]) => (
                <div key={dispo} className="flex gap-1.5">
                  <dt>{tr("skinDispo", dispo)}</dt>
                  <dd className="font-semibold tabular-nums text-chalk-100">{n}</dd>
                </div>
              ))}
            </dl>
          )}
          {recent && (
            <p>{t("pages.heroSkins.dernier", { skin: recent.name, date: formaterSortie(recent.release!, locale) })}</p>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {raretesPresentes(g.skins.map((s) => s.rarity)).map((r) => (
              <li key={r.nom} className="flex items-center gap-1.5 text-xs">
                <span aria-hidden className="size-2.5 border-2" style={{ borderColor: r.couleur }} />
                {tr("skinRarete", r.cle ?? r.nom)}
              </li>
            ))}
          </ul>
          <p>
            <Link href={`/heroes/${h.slug}`} className="font-semibold text-gold-400 underline-offset-4 hover:underline">
              ← {t("pages.heroDetail.titreFiche", { nom: h.name })}
            </Link>
          </p>
        </div>
      </EnTetePage>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <ol className="grid gap-6 md:grid-cols-2">
          {g.skins.map((s, i) => {
            const r = rarete(s.rarity);
            const origine = !s.rarity;
            const tarif = prix(s);
            return (
              <li key={ancres[i]} id={ancres[i]} className="scroll-mt-24">
                <CarteSkin
                  nom={s.name}
                  illustration={s.illustration}
                  portrait={s.portrait}
                  couleur={r.couleur}
                  premier={i === 0}
                  altIllustration={altIllustration(s.name)}
                  altPortrait={altPortrait(s.name)}
                >
                  <p
                    className={`mt-1 text-xs font-semibold uppercase tracking-wide ${origine ? "text-chalk-500" : ""}`}
                    style={origine ? undefined : { color: r.couleur }}
                  >
                    {tr("skinRarete", r.cle ?? r.nom)}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {s.release && (
                      <Info libelle={t("skinsUI.sortie")}>
                        {DATE_ISO.test(s.release) ? (
                          <time dateTime={s.release}>{formaterSortie(s.release, locale)}</time>
                        ) : (
                          s.release
                        )}
                      </Info>
                    )}
                    {s.availability && (
                      <Info libelle={t("skinsUI.disponibilite")}>{tr("skinDispo", s.availability)}</Info>
                    )}
                    {s.label && <Info libelle={t("skinsUI.obtention")}>{tr("skinEtiquette", s.label)}</Info>}
                    {tarif && <Info libelle={t("pages.heroSkins.prix")}>{tarif}</Info>}
                  </dl>
                </CarteSkin>
              </li>
            );
          })}
          {g.autres.map((a, k) => (
            <li key={ancres[g.skins.length + k]} id={ancres[g.skins.length + k]} className="scroll-mt-24">
              <CarteSkin
                nom={a.nom}
                illustration={a.illustration}
                portrait={null}
                couleur={rarete(null).couleur}
                premier={g.skins.length === 0 && k === 0}
                altIllustration={altIllustration(a.nom)}
                altPortrait=""
              >
                <p className="mt-2 text-sm text-chalk-500">{t("pages.heroSkins.illustrationSeule")}</p>
              </CarteSkin>
            </li>
          ))}
        </ol>

        <nav
          aria-label={t("pages.heroSkins.autres")}
          className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-night-800 pt-6 text-sm"
        >
          <Link href={`/heroes/${precedent.slug}/skins`} className="text-chalk-300 hover:text-gold-400">
            ← {titreGalerie(t, locale, precedent.name)}
          </Link>
          <Link href="/skins" className="font-semibold text-gold-400 hover:text-gold-500">
            {t("pages.skins.titre")}
          </Link>
          <Link href={`/heroes/${suivant.slug}/skins`} className="text-chalk-300 hover:text-gold-400">
            {titreGalerie(t, locale, suivant.name)} →
          </Link>
        </nav>
      </div>
    </>
  );
}

/**
 * Carte d'un skin : l'illustration en 16/9, le portrait de boutique en
 * medaillon, un filet a la couleur de la rarete. Sans illustration, le
 * portrait occupe le cadre.
 */
function CarteSkin({
  nom,
  illustration,
  portrait,
  couleur,
  premier,
  altIllustration,
  altPortrait,
  children,
}: {
  nom: string;
  illustration: string | null;
  portrait: string | null;
  couleur: string;
  premier: boolean;
  altIllustration: string;
  altPortrait: string;
  children: React.ReactNode;
}) {
  return (
    <article className="bevel flex h-full flex-col overflow-hidden border border-night-700/70 bg-night-900/60">
      <div className="relative aspect-video bg-night-800">
        {illustration ? (
          <Image
            src={illustration}
            alt={altIllustration}
            fill
            preload={premier}
            sizes="(min-width: 1152px) 552px, (min-width: 768px) 50vw, 100vw"
            className="object-cover object-top"
          />
        ) : (
          portrait && (
            <Image
              src={portrait}
              alt={altPortrait}
              fill
              preload={premier}
              sizes="(min-width: 768px) 180px, 45vw"
              className="object-contain"
            />
          )
        )}
        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: couleur }} />
        {illustration && portrait && (
          <span
            className="bevel-sm absolute bottom-2 right-2 overflow-hidden border-2 bg-night-900"
            style={{ borderColor: couleur }}
          >
            <Image src={portrait} alt={altPortrait} width={56} height={91} className="block h-[5.7rem] w-14 object-cover" />
          </span>
        )}
      </div>
      <div className="flex-1 p-4">
        <h2 className="font-heading text-xl font-bold text-chalk-100">{nom}</h2>
        {children}
      </div>
    </article>
  );
}

function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-chalk-500">{libelle}</dt>
      <dd className="mt-0.5 text-chalk-100">{children}</dd>
    </div>
  );
}
