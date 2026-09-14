"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/link";
import { SearchField } from "@/components/search-field";
import { LightImage } from "@/components/light-image";
import { ChoiceUnique } from "@/components/chip";
import { useLocale, useT } from "@/i18n/provider";
import { RARITY_ORIGIN, RARITIES } from "@/lib/rarities";
import { uniqueAnchors, filterGroups, imageOfThumb, type GroupSkins } from "@/lib/skins";
import { ROLES } from "@/lib/statistics-table";
import type { Role } from "@/lib/types";

/** Heros affiches par tranche : la premiere part rendue du serveur, la suite a la demande. */
const BY_BUCKET = 12;

/** Couleur de contour par rang de rarete ; 0 vaut le skin d'origine ou une rarete inconnue. */
const COLORS = [
  RARITY_ORIGIN.color,
  ...Object.values(RARITIES)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.color),
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
export function SkinGallery({ groups }: { groups: GroupSkins[] }) {
  const t = useT();
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [buckets, setBuckets] = useState(1);

  // Meme regle que le catalogue des heros : le rendu serveur part sans filtre,
  // l'URL (?q=, ?role=) n'est lue qu'apres le montage, puis suit chaque changement.
  const rise = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!rise.current) {
      rise.current = true;
      const q = params.get("q");
      const roleUrl = ROLES.find((r) => r === params.get("role")) ?? null;
      if (q || roleUrl) {
        /* eslint-disable react-hooks/set-state-in-effect -- lecture de l'URL apres montage */
        if (q) setSearch(q);
        if (roleUrl) setRole(roleUrl);
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    }
    const values: [string, string | null][] = [
      ["q", search.trim() || null],
      ["role", role],
    ];
    for (const [key, value] of values) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const suffix = params.toString();
    window.history.replaceState(null, "", suffix ? `?${suffix}` : window.location.pathname);
  }, [search, role]);

  // Ancres calculees sur la galerie complete : un filtre ne doit pas les decaler.
  const anchors = useMemo(
    () =>
      new Map(
        groups.map((g) => {
          const names = g.skins.map(([name]) => name);
          const list = uniqueAnchors(names);
          const byName = new Map<string, string>();
          names.forEach((name, i) => byName.has(name) || byName.set(name, list[i]));
          return [g.slug, byName];
        }),
      ),
    [groups],
  );

  const results = useMemo(() => filterGroups(groups, { role, search }), [groups, role, search]);
  const visible = results.slice(0, buckets * BY_BUCKET);
  const rest = results.length - visible.length;
  const total = results.reduce((n, g) => n + g.skins.length, 0);
  const count = new Intl.NumberFormat(locale);
  const plural = new Intl.PluralRules(locale);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setBuckets(1);
          }}
          label={t("pages.heroesList.search")}
          className="max-w-md"
        />
        <ChoiceUnique
          legend={t("pages.heroesList.role")}
          values={ROLES}
          active={role}
          onChange={(r) => {
            setRole(r);
            setBuckets(1);
          }}
          label={(r) => t(`roles.${r}`)}
        />
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-chalk-500">
        {t("pages.skinsGallery.account", { h: results.length, n: count.format(total) })}
      </p>

      {results.length === 0 ? (
        <p className="mt-10 text-chalk-500">{t("pages.heroesList.none")}</p>
      ) : (
        <div className="mt-6 space-y-10">
          {visible.map((g) => (
            <section key={g.slug} aria-labelledby={`skins-${g.slug}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-night-800 pb-2">
                <h3 id={`skins-${g.slug}`} className="font-heading text-xl font-bold text-chalk-100">
                  {g.name}
                  <span className="ml-2 text-sm font-medium text-chalk-500">
                    {t(`pages.skinsGallery.count.${plural.select(g.skins.length) === "one" ? "one" : "other"}`, {
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
                {g.skins.map((thumb, k) => {
                  const [name, , rarity] = thumb;
                  const src = imageOfThumb(g.slug, thumb);
                  return (
                    <li key={`${name}-${k}`}>
                      <Link
                        href={`/heroes/${g.slug}/skins#${anchors.get(g.slug)?.get(name) ?? ""}`}
                        prefetch={false}
                        className="skin-thumb"
                        style={{ borderColor: COLORS[rarity] ?? COLORS[0] }}
                      >
                        {src ? (
                          <LightImage
                            src={src}
                            alt={t("pages.skinsGallery.alt", { heros: g.name, skin: name })}
                            width={120}
                            height={195}
                          />
                        ) : (
                          <i aria-hidden />
                        )}
                        {/* Nom visible, deja dit par le texte alternatif : masque aux lecteurs d'ecran quand l'image est la. */}
                        <span aria-hidden={src ? true : undefined}>{name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {rest > 0 && (
        <button
          type="button"
          onClick={() => setBuckets((n) => n + 1)}
          className="bevel-sm mt-10 w-full border border-night-700 px-4 py-3 text-sm font-semibold text-chalk-300 transition-colors hover:border-gold-500/60 hover:text-gold-400"
        >
          {t("pages.skinsGallery.seeMore", { n: rest })}
        </button>
      )}
    </div>
  );
}
