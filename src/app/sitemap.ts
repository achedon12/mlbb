import type { MetadataRoute } from "next";
import veille from "@/data/jeu/veille.json";
import { contres, heros, modesSlugs, objets, patchsDetail, synchro } from "@/lib/donnees";
import { duos } from "@/lib/duos";
import { rangsParPaire } from "@/lib/paires";
import { emblemesFiches, sortsFiches } from "@/lib/fiches-usage";
import { anneesCalendrier } from "@/lib/catalogue-skins-serveur";
import { regionsLore } from "@/lib/lore";
import { herosAvecSkins } from "@/lib/skins-heros";
import { articles } from "@/lib/contenu";
import { ROLES } from "@/lib/draft";
import { cheminFiltre, cheminRole, FILTRES_LANE, FILTRES_ROLE } from "@/lib/filtres-tier-list";
import { site } from "@/lib/site";
import { mesureLe, RANGS_CLASSES } from "@/lib/tier-list";
import { LANGUES } from "@/i18n/config";
import { monthKeys } from "@/lib/events-server";
import { CHECKED_ON } from "@/lib/objectives";
import { esportsUpdatedAt, tournaments } from "@/lib/esports";
import { advanceSyncedAt, advanceVersion, advanceVersionNumbers, advanceVersions } from "@/lib/advance-server";

/**
 * Plan du site, multilingue.
 *
 * Chaque page existe dans chaque langue, sous son prefixe (`/fr/heroes`…) : on
 * emet une entree par langue. Les versions d'une meme page sont reliees par les
 * `hreflang` de son en-tete HTML (`metaLangues`), pas ici : Google n'en demande
 * qu'une declaration, et les liens `xhtml:link` faisaient afficher le plan par
 * les navigateurs comme un bloc de texte plutot que comme un arbre XML.
 *
 * `lastModified` dit quand le contenu a vraiment change : date du releve des
 * taux pour les pages de statistiques, date du patch pour ses notes, date de
 * l'article, date de synchronisation pour les autres donnees du jeu. Les
 * textes fixes (mentions, confidentialite…) n'en portent pas : une date qui
 * bougerait chaque jour sans raison apprendrait aux moteurs a l'ignorer.
 */
type Chemin = {
  chemin: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified?: Date;
};

/** Date AAAA-MM-JJ ou ISO complete ; rien pour une date absente ou illisible. */
function dateDe(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** La plus recente de plusieurs dates ISO. */
const plusRecente = (...isos: (string | null | undefined)[]) =>
  dateDe(isos.filter((d): d is string => !!d).sort().at(-1));

export default function sitemap(): MetadataRoute.Sitemap {
  const mesure = dateDe(mesureLe);
  const synchronise = dateDe(synchro.date);
  const actualites = articles("actualites");
  const analysesPatch = articles("patch-notes");
  const patchs = Object.values(patchsDetail);

  const statistiques = (chemin: string, changeFrequency: Chemin["changeFrequency"], priority: number): Chemin => ({
    chemin,
    changeFrequency,
    priority,
    lastModified: mesure,
  });

  const chemins: Chemin[] = [
    statistiques("", "daily", 1),
    statistiques("/heroes", "weekly", 0.9),
    statistiques("/tier-list", "daily", 0.9),
    statistiques("/meta", "daily", 0.8),
    statistiques("/compare", "weekly", 0.7),
    statistiques("/draft", "weekly", 0.8),
    statistiques("/tools/team", "weekly", 0.7),
    statistiques("/items", "weekly", 0.7),
    statistiques("/emblems", "weekly", 0.7),
    { chemin: "/tools/win-rate", changeFrequency: "yearly", priority: 0.6 },
    { chemin: "/tools/retribution", changeFrequency: "monthly", priority: 0.6, lastModified: synchronise },
    { chemin: "/tools/tier-list-maker", changeFrequency: "monthly", priority: 0.6, lastModified: mesure },
    { chemin: "/quiz", changeFrequency: "daily", priority: 0.6 },
    { chemin: "/mlbbdle", changeFrequency: "daily", priority: 0.6 },
    // Objective timings, dated by the day they were checked on the wiki.
    { chemin: "/tools/timer", changeFrequency: "monthly", priority: 0.6, lastModified: dateDe(CHECKED_ON) },
    { chemin: "/map", changeFrequency: "monthly", priority: 0.6, lastModified: dateDe(CHECKED_ON) },
    { chemin: "/tools/nickname", changeFrequency: "yearly", priority: 0.5 },
    { chemin: "/tools/draw-calculator", changeFrequency: "yearly", priority: 0.5 },
    { chemin: "/tools/build", changeFrequency: "monthly", priority: 0.6, lastModified: synchronise },
    { chemin: "/builds", changeFrequency: "daily", priority: 0.5 },
    // Monthly skin calendar: one page per month the data documents.
    { chemin: "/events", changeFrequency: "weekly", priority: 0.7, lastModified: synchronise },
    ...monthKeys().map((month) => ({
      chemin: `/events/${month}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      lastModified: synchronise,
    })),
    // Esports hub and one page per covered tournament, dated by the last refresh.
    { chemin: "/esports", changeFrequency: "weekly", priority: 0.6, lastModified: dateDe(esportsUpdatedAt) },
    ...tournaments.map((t) => ({
      chemin: `/esports/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
      lastModified: dateDe(esportsUpdatedAt),
    })),
    // Advance Server notes, dated by the version they describe.
    {
      chemin: "/patch-notes/advance-server",
      changeFrequency: "weekly",
      priority: 0.5,
      lastModified: dateDe(advanceVersions("en")[0]?.date ?? advanceSyncedAt),
    },
    ...advanceVersionNumbers.map((version) => ({
      chemin: `/patch-notes/advance-server/${version}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
      lastModified: dateDe(advanceVersion("en", version)?.date),
    })),
    { chemin: "/tools/collection", changeFrequency: "monthly", priority: 0.5, lastModified: synchronise },
    { chemin: "/lore", changeFrequency: "monthly", priority: 0.6, lastModified: synchronise },
    ...regionsLore.map((r) => ({
      chemin: `/lore/${r.cle}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
      lastModified: synchronise,
    })),
    { chemin: "/skins/calendar", changeFrequency: "weekly", priority: 0.6, lastModified: synchronise },
    ...anneesCalendrier().map((annee) => ({
      chemin: `/skins/calendar/${annee}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
      lastModified: synchronise,
    })),
    { chemin: "/tools/server-time", changeFrequency: "weekly", priority: 0.6, lastModified: synchronise },
    { chemin: "/ranks", changeFrequency: "weekly", priority: 0.6, lastModified: mesure },
    { chemin: "/game-modes", changeFrequency: "monthly", priority: 0.6, lastModified: synchronise },
    { chemin: "/news", changeFrequency: "daily", priority: 0.8, lastModified: dateDe(actualites[0]?.date) },
    { chemin: "/watch", changeFrequency: "hourly", priority: 0.6, lastModified: dateDe(veille.mesure) },
    {
      chemin: "/patch-notes",
      changeFrequency: "weekly",
      priority: 0.8,
      lastModified: plusRecente(...patchs.map((p) => p.date), analysesPatch[0]?.date),
    },
    { chemin: "/api-doc", changeFrequency: "monthly", priority: 0.5, lastModified: synchronise },
    { chemin: "/contribute", changeFrequency: "monthly", priority: 0.4, lastModified: synchronise },
    { chemin: "/about", changeFrequency: "yearly", priority: 0.3 },
    { chemin: "/legal", changeFrequency: "yearly", priority: 0.2 },
    { chemin: "/privacy", changeFrequency: "yearly", priority: 0.2 },
    ...RANGS_CLASSES.filter((r) => r !== "all").map((r) => statistiques(`/tier-list/${r}`, "daily", 0.7)),
    ...[...FILTRES_LANE, ...FILTRES_ROLE].map((f) => statistiques(cheminFiltre(f), "daily", 0.7)),
    ...ROLES.map((r) => statistiques(cheminRole(r), "weekly", 0.6)),
    ...modesSlugs.map((slug) => ({
      chemin: `/game-modes/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      lastModified: synchronise,
    })),
    ...heros.map((h) => statistiques(`/heroes/${h.slug}`, "weekly", 0.6)),
    // Pages derivees des mesures : datees du releve, comme les fiches.
    ...heros.filter((h) => contres[h.slug]).map((h) => statistiques(`/heroes/${h.slug}/counters`, "weekly", 0.6)),
    ...heros.filter((h) => duos[h.slug]).map((h) => statistiques(`/heroes/${h.slug}/duos`, "weekly", 0.5)),
    // Duels : seules les paires mesurees a deux rangs au moins, les autres
    // restent accessibles mais trop minces pour etre proposees aux moteurs.
    ...[...rangsParPaire(contres, (s) => heros.some((h) => h.slug === s))]
      .filter(([, n]) => n >= 2)
      .map(([segment]) => statistiques(`/compare/${segment}`, "weekly", 0.4)),
    ...objets("en").map((o) => statistiques(`/items/${o.slug}`, "weekly", 0.5)),
    ...emblemesFiches.map((e) => statistiques(`/emblems/${e.slug}`, "weekly", 0.5)),
    statistiques("/spells", "monthly", 0.5),
    ...sortsFiches.map((sort) => statistiques(`/spells/${sort.slug}`, "weekly", 0.4)),
    statistiques("/statistics", "daily", 0.8),
    ...RANGS_CLASSES.filter((r) => r !== "all").map((r) => statistiques(`/statistics/${r}`, "daily", 0.6)),
    { chemin: "/skins", changeFrequency: "weekly", priority: 0.6, lastModified: synchronise },
    ...herosAvecSkins.map((h) => ({
      chemin: `/heroes/${h.slug}/skins`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
      lastModified: synchronise,
    })),
    ...patchs.map((p) => ({
      chemin: `/patch-notes/${p.version}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      lastModified: dateDe(p.date) ?? synchronise,
    })),
    ...([["news", actualites], ["patch-notes", analysesPatch]] as const).flatMap(([route, liste]) =>
      liste.map((a) => ({
        chemin: `/${route}/${a.slug}`,
        changeFrequency: "yearly" as const,
        priority: 0.7,
        lastModified: dateDe(a.date),
      })),
    ),
  ];

  // Pour chaque chemin, une URL par langue ; les hreflang vivent dans les pages.
  return chemins.flatMap(({ chemin, changeFrequency, priority, lastModified }) =>
    LANGUES.map((l) => ({
      url: `${site.url}/${l}${chemin}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency,
      priority,
    })),
  );
}
