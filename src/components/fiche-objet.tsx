import Image from "next/image";
import type { ReactNode } from "react";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import type { ObjetGenere } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Pieces de la fiche d'un objet, communes au catalogue (panneau lateral et
 * tiroir, dans le navigateur) et a la page de chaque objet (rendue au serveur).
 *
 * Aucun hook : l'appelant fournit la traduction, la langue, et la facon
 * d'ouvrir un autre objet — un bouton qui change l'ancre dans le catalogue, un
 * lien vers sa page ailleurs.
 */
export interface ApercuObjet extends ObjetGenere {
  image: string | null;
}

/** Les objets par nom, et ce que chacun sert a fabriquer (recettes lues a l'envers). */
export interface CatalogueRecettes {
  parNom: Map<string, ApercuObjet>;
  debouches: Map<string, ApercuObjet[]>;
}

export function catalogueRecettes(objets: ApercuObjet[]): CatalogueRecettes {
  const parNom = new Map(objets.map((o) => [o.nom, o]));
  const debouches = new Map<string, ApercuObjet[]>();
  for (const o of objets) {
    for (const c of new Set(o.recette)) debouches.set(c, [...(debouches.get(c) ?? []), o]);
  }
  return { parNom, debouches };
}

/** Ouvre un autre objet : recoit l'objet vise, le contenu du lien et ses classes. */
export type VersObjet = (o: ApercuObjet, contenu: ReactNode, className: string) => ReactNode;

/** Ce que coute l'assemblage lui-meme, une fois les composants en poche. */
export function coutFusion(objet: ApercuObjet, catalogue: CatalogueRecettes): number | null {
  const composants = objet.recette.map((nom) => catalogue.parNom.get(nom));
  if (objet.prix === null || composants.length === 0 || !composants.every((c) => c?.prix != null)) return null;
  return objet.prix - composants.reduce((somme, c) => somme + (c?.prix ?? 0), 0);
}

const nombre = (langue: Langue, n: number) => n.toLocaleString(LOCALE_HTML[langue]);

/** Statistiques et effets, en paires `dt`/`dd` a placer dans un `dl`. */
export function EffetsObjet({ objet, t }: { objet: ApercuObjet; t: T }) {
  return (
    <>
      {objet.bonus && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsListe.statistiques")}</dt>
          <dd className="mt-1 leading-snug text-chalk-100">{objet.bonus}</dd>
        </div>
      )}
      {objet.unique && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsListe.unique")}</dt>
          <dd className="mt-1 leading-snug text-azure-400">{objet.unique}</dd>
        </div>
      )}
      {objet.passif && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsListe.passif")}</dt>
          <dd className="mt-1 leading-relaxed text-chalk-300">{objet.passif}</dd>
        </div>
      )}
      {objet.actif && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsListe.actif")}</dt>
          <dd className="mt-1 leading-relaxed text-chalk-300">{objet.actif}</dd>
        </div>
      )}
    </>
  );
}

/** Recette (avec le cout de fusion) et objets que celui-ci sert a fabriquer, en paires `dt`/`dd`. */
export function RecetteObjet({
  objet,
  catalogue,
  t,
  langue,
  vers,
}: {
  objet: ApercuObjet;
  catalogue: CatalogueRecettes;
  t: T;
  langue: Langue;
  vers: VersObjet;
}) {
  const fusion = coutFusion(objet, catalogue);
  const fabrique = catalogue.debouches.get(objet.nom) ?? [];
  return (
    <>
      {objet.recette.length > 0 && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsListe.recette")}</dt>
          <dd className="mt-2">
            <ArbreRecette noms={objet.recette} catalogue={catalogue} t={t} langue={langue} vers={vers} />
            {fusion !== null && (
              <p className="mt-2 text-xs text-chalk-500">
                {t("pages.itemsListe.fusion", { prix: nombre(langue, fusion) })}
              </p>
            )}
          </dd>
        </div>
      )}
      {fabrique.length > 0 && (
        <div>
          <dt className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.itemsListe.fabrique")}</dt>
          <dd className="mt-2 flex flex-wrap gap-1.5">
            {fabrique.map((o) => (
              <span key={o.slug} className="contents">
                {vers(
                  o,
                  <>
                    <IconeObjet image={o.image} taille={22} />
                    <span className="text-xs text-chalk-300 group-hover:text-gold-400">{o.nom}</span>
                  </>,
                  "bevel-sm group flex items-center gap-1.5 border border-night-700/70 bg-night-900/60 py-1 pl-1 pr-2 transition-colors hover:border-gold-500/60",
                )}
              </span>
            ))}
          </dd>
        </div>
      )}
    </>
  );
}

/**
 * Arbre de fabrication : chaque composant avec son icone et son prix, puis ses
 * propres composants en retrait. Chaque composant ouvre sa propre fiche.
 */
export function ArbreRecette({
  noms,
  catalogue,
  t,
  langue,
  vers,
  profondeur = 0,
}: {
  noms: string[];
  catalogue: CatalogueRecettes;
  t: T;
  langue: Langue;
  vers: VersObjet;
  profondeur?: number;
}) {
  return (
    <ul className={cn("space-y-1.5", profondeur > 0 && "ml-3.5 mt-1.5 border-l border-night-700 pl-3")}>
      {noms.map((nom, i) => {
        const o = catalogue.parNom.get(nom);
        const contenu = (
          <>
            <IconeObjet image={o?.image ?? null} taille={28} />
            <span className="min-w-0 flex-1 truncate text-sm text-chalk-100 group-hover:text-gold-400">{nom}</span>
            {o?.prix != null && (
              <span className="shrink-0 text-xs tabular-nums text-gold-400">
                {nombre(langue, o.prix)} {t("pages.itemsListe.or")}
              </span>
            )}
          </>
        );
        const classe = "group flex w-full items-center gap-2 text-left";
        return (
          <li key={`${nom}-${i}`}>
            {o ? vers(o, contenu, classe) : <span className={classe}>{contenu}</span>}
            {/* Garde-fou : une recette mal saisie ne doit pas boucler sans fin. */}
            {o && o.recette.length > 0 && profondeur < 4 && (
              <ArbreRecette
                noms={o.recette}
                catalogue={catalogue}
                t={t}
                langue={langue}
                vers={vers}
                profondeur={profondeur + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Icone a taille fixe : largeur et hauteur connues, le navigateur n'a que deux
 * versions a choisir (1x, 2x). En `fill`, chaque icone emportait les quinze
 * largeurs de la configuration, soit 1 Ko de HTML par vignette.
 */
export function IconeObjet({ image, taille }: { image: string | null; taille: number }) {
  return (
    <span className="relative shrink-0" style={{ width: taille, height: taille }}>
      {image ? (
        <Image src={image} alt="" width={taille} height={taille} className="size-full object-contain" />
      ) : (
        <span className="grid size-full place-items-center bg-night-800 text-[0.6rem] text-chalk-500">—</span>
      )}
    </span>
  );
}
