import { cleValeur } from "@/i18n/donnees-heros";
import { herosDraft } from "./catalogue-draft";
import type { Ecart, HerosEquipe, MesuresRang, Tranche, TypeDegats } from "./composition";
import { coequipiers, contres, heros, herosParSlug } from "./donnees";
import { dureeDe } from "./evolution";
import type { RangMesure } from "./rangs-mesure";
import { classementDuRang } from "./tier-list";

/**
 * Donnees de l'analyse d'equipe, preparees cote serveur : le catalogue, qui
 * part avec la page, et les mesures d'un rang, servies a part
 * (`/composition/<rang>.json`).
 */

const TYPES_DEGATS: TypeDegats[] = ["physical", "magic", "mixed"];

/** Type de degats du wiki ramene a sa cle ; coquilles comprises (« Phyiscal »). */
function degatsDe(valeur: string | null): TypeDegats | null {
  const cle = valeur ? cleValeur(valeur) : null;
  return TYPES_DEGATS.find((t) => t === cle) ?? null;
}

/** Le roster, reduit a ce que l'analyse lit. Taux et relations de contre dependent du rang : ils n'y sont pas. */
export function catalogueEquipe(): HerosEquipe[] {
  return herosDraft().map((h) => {
    const fiche = herosParSlug.get(h.slug);
    return {
      slug: h.slug,
      nom: h.nom,
      lanes: h.lanes,
      roles: h.roles,
      icone: h.icone,
      synergies: h.synergies,
      degats: degatsDe(fiche?.damageType ?? null),
      notes: fiche?.ratings ?? { offense: null, durability: null, abilityEffects: null, difficulty: null },
    };
  });
}

const ecarts = (liste: { slug: string; advantage: number }[] | undefined): Ecart[] =>
  (liste ?? []).map((e) => [e.slug, e.advantage]);

export function mesuresRang(rang: RangMesure): MesuresRang {
  const stats: MesuresRang["stats"] = Object.fromEntries(
    classementDuRang(rang).map((e) => [e.hero.slug, [e.winRate, e.tier]]),
  );

  // Les tranches de duree sont les memes pour tous les heros : on les ecrit
  // une fois. Un heros decoupe autrement (fichier plus ancien) est ecarte
  // plutot que de fausser la moyenne.
  let tranches: Tranche[] = [];
  const duree: MesuresRang["duree"] = {};
  for (const h of heros) {
    const liste = dureeDe(h.slug)[rang];
    if (!liste?.length) continue;
    if (tranches.length === 0) tranches = liste.map(({ from, to }) => ({ from, to }));
    if (liste.length === tranches.length && liste.every((x, i) => x.from === tranches[i].from)) {
      duree[h.slug] = liste.map((x) => x.winRate);
    }
  }

  const parHeros = (lire: (slug: string) => Ecart[]) =>
    Object.fromEntries(heros.flatMap((h) => (lire(h.slug).length ? [[h.slug, lire(h.slug)]] : [])));

  return {
    rang,
    stats,
    tranches,
    duree,
    coequipiers: parHeros((s) => ecarts(coequipiers[s]?.[rang])),
    faible: parHeros((s) => ecarts(contres[s]?.[rang]?.weak)),
  };
}
