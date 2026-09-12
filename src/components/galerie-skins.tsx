"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/lien";
import { ChampRecherche } from "@/components/champ-recherche";
import { ImageLegere } from "@/components/image-legere";
import { ChoixUnique } from "@/components/puce";
import { useLangue, useT } from "@/i18n/fournisseur";
import { RARETE_ORIGINE, RARETES } from "@/lib/raretes";
import { ancresUniques, filtrerGroupes, imageDeVignette, type GroupeSkins } from "@/lib/skins";
import { ROLES } from "@/lib/tableau-statistiques";
import type { Role } from "@/lib/types";

/** Heros affiches par tranche : la premiere part rendue du serveur, la suite a la demande. */
const PAR_TRANCHE = 12;

/** Couleur de contour par rang de rarete ; 0 vaut le skin d'origine ou une rarete inconnue. */
const COULEURS = [
  RARETE_ORIGINE.couleur,
  ...Object.values(RARETES)
    .sort((a, b) => a.rang - b.rang)
    .map((r) => r.couleur),
];

/**
 * Galerie filtrable de tous les skins, groupes par heros.
 *
 * Les vignettes arrivent en tuples compacts (`VignetteSkin`) : un millier de
 * skins passent ainsi au navigateur pour quelques dizaines de Ko. Filtre par
 * role, recherche sur le nom du heros ou du skin, et affichage par tranches de
 * heros : la page ne rend d'emblee qu'une centaine de vignettes, toutes en
 * chargement differe. Les vignettes s'habillent par `.skin-thumb`
 * (globals.css).
 */
export function GalerieSkins({ groupes }: { groupes: GroupeSkins[] }) {
  const t = useT();
  const langue = useLangue();
  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [tranches, setTranches] = useState(1);

  // Meme regle que le catalogue des heros : le rendu serveur part sans filtre,
  // l'URL (?q=, ?role=) n'est lue qu'apres le montage, puis suit chaque changement.
  const monte = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!monte.current) {
      monte.current = true;
      const q = params.get("q");
      const roleUrl = ROLES.find((r) => r === params.get("role")) ?? null;
      if (q || roleUrl) {
        /* eslint-disable react-hooks/set-state-in-effect -- lecture de l'URL apres montage */
        if (q) setRecherche(q);
        if (roleUrl) setRole(roleUrl);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    const valeurs: [string, string | null][] = [
      ["q", recherche.trim() || null],
      ["role", role],
    ];
    for (const [cle, valeur] of valeurs) {
      if (valeur) params.set(cle, valeur);
      else params.delete(cle);
    }
    const suffixe = params.toString();
    window.history.replaceState(null, "", suffixe ? `?${suffixe}` : window.location.pathname);
  }, [recherche, role]);

  // Ancres calculees sur la galerie complete : un filtre ne doit pas les decaler.
  const ancres = useMemo(
    () =>
      new Map(
        groupes.map((g) => {
          const noms = g.skins.map(([nom]) => nom);
          const liste = ancresUniques(noms);
          const parNom = new Map<string, string>();
          noms.forEach((nom, i) => parNom.has(nom) || parNom.set(nom, liste[i]));
          return [g.slug, parNom];
        }),
      ),
    [groupes],
  );

  const resultats = useMemo(() => filtrerGroupes(groupes, { role, recherche }), [groupes, role, recherche]);
  const visibles = resultats.slice(0, tranches * PAR_TRANCHE);
  const reste = resultats.length - visibles.length;
  const total = resultats.reduce((n, g) => n + g.skins.length, 0);
  const nombre = new Intl.NumberFormat(langue);
  const pluriel = new Intl.PluralRules(langue);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <ChampRecherche
          valeur={recherche}
          onChange={(v) => {
            setRecherche(v);
            setTranches(1);
          }}
          libelle={t("pages.heroesList.search")}
          className="max-w-md"
        />
        <ChoixUnique
          legende={t("pages.heroesList.role")}
          valeurs={ROLES}
          actif={role}
          onChange={(r) => {
            setRole(r);
            setTranches(1);
          }}
          libelle={(r) => t(`roles.${r}`)}
        />
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {t("pages.skinsGallery.account", { h: resultats.length, n: nombre.format(total) })}
      </p>

      {resultats.length === 0 ? (
        <p className="mt-10 text-chalk-500">{t("pages.heroesList.none")}</p>
      ) : (
        <div className="mt-6 space-y-10">
          {visibles.map((g) => (
            <section key={g.slug} aria-labelledby={`skins-${g.slug}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-night-800 pb-2">
                <h3 id={`skins-${g.slug}`} className="font-heading text-xl font-bold text-chalk-100">
                  {g.nom}
                  <span className="ml-2 text-sm font-medium text-chalk-500">
                    {t(`pages.skinsGallery.count.${pluriel.select(g.skins.length) === "one" ? "one" : "other"}`, {
                      n: g.skins.length,
                    })}
                  </span>
                </h3>
                <Link
                  href={`/heroes/${g.slug}/skins`}
                  prefetch={false}
                  className="text-sm font-semibold text-gold-400 hover:text-gold-500"
                >
                  {t("pages.skinsGallery.seeAll")} →
                </Link>
              </div>
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                {g.skins.map((vignette, k) => {
                  const [nom, , rarete] = vignette;
                  const src = imageDeVignette(g.slug, vignette);
                  return (
                    <li key={`${nom}-${k}`}>
                      <Link
                        href={`/heroes/${g.slug}/skins#${ancres.get(g.slug)?.get(nom) ?? ""}`}
                        prefetch={false}
                        className="skin-thumb"
                        style={{ borderColor: COULEURS[rarete] ?? COULEURS[0] }}
                      >
                        {src ? (
                          <ImageLegere
                            src={src}
                            alt={t("pages.skinsGallery.alt", { heros: g.nom, skin: nom })}
                            largeur={120}
                            hauteur={195}
                          />
                        ) : (
                          <i aria-hidden />
                        )}
                        {/* Nom visible, deja dit par le texte alternatif : masque aux lecteurs d'ecran quand l'image est la. */}
                        <span aria-hidden={src ? true : undefined}>{nom}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {reste > 0 && (
        <button
          type="button"
          onClick={() => setTranches((n) => n + 1)}
          className="bevel-sm mt-10 w-full border border-night-700 px-4 py-3 text-sm font-semibold text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          {t("pages.skinsGallery.seeMore", { n: reste })}
        </button>
      )}
    </div>
  );
}
