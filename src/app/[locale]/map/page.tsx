import type { Metadata } from "next";
import Link from "@/components/lien";
import { MapGuide, type MapCard } from "@/components/map-guide";
import { EnTetePage } from "@/components/ui";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import { CompleterMessages } from "@/i18n/fournisseur";
import { donneesOutil, metaPage } from "@/i18n/seo";
import { creerT, messagesPage, type T } from "@/i18n/traductions";
import { OBJECTIFS } from "@/lib/chatiment";
import { SLUGS_ROLE } from "@/lib/filtres-tier-list";
import { MAP_POINTS, type MapPointKey } from "@/lib/game-map";
import { donneesLd } from "@/lib/html";
import {
  BUFF_EFFECTS,
  BUFFS,
  CAMP_REWARDS,
  CAMPS,
  CHECKED_ON,
  GUIDE_EVENTS,
  HP,
  LORD,
  MINIONS,
  SOURCES,
  TURRETS,
  TURTLE,
  formatTime,
  type CampKey,
} from "@/lib/objectives";
import type { Role } from "@/lib/types";
import { formaterDate } from "@/lib/utils";

type Params = { params: Promise<{ locale: Langue }> };

const PATH = "/map";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.map.title"),
    description: t("pages.seo.map.description"),
    chemin: PATH,
    motsCles: ["MLBB map", "Land of Dawn", "jungle camps", "Turtle", "Lord", "rotation", "Mobile Legends", "MLBB"],
  });
}

const sectionTitle = "font-titre text-2xl font-bold text-craie-100";
const wikiPageName = (url: string) => decodeURIComponent(url.split("/wiki/")[1] ?? url).replaceAll("_", " ");

/** Cards of every point of interest, built here so the browser only receives the finished text. */
function mapCards(t: T, locale: Langue): Record<MapPointKey, MapCard> {
  const number = new Intl.NumberFormat(LOCALE_HTML[locale]);
  const seconds = (n: number) => t("pages.map.seconds", { n: number.format(n) });
  const label = (key: string) => t(`pages.map.fact.${key}`);
  const hp = (key: CampKey) => {
    const v = HP[key];
    const value = v.at12
      ? t("pages.map.hpAt12", { start: number.format(v.start), at12: number.format(v.at12) })
      : number.format(v.start);
    return { label: label("hp"), value };
  };
  const timerLink = { href: "/tools/timer", label: t("pages.map.timerLink") };
  const retributionLink = { href: "/tools/retribution", label: t("pages.map.retributionLink") };
  const heal = t("pages.map.healReward", { hp: CAMP_REWARDS.heal.hp, mana: CAMP_REWARDS.heal.mana, duration: CAMP_REWARDS.heal.duration });
  const waves = {
    label: label("waves"),
    value: t("pages.map.wavesValue", { first: formatTime(MINIONS.firstWave), interval: MINIONS.interval }),
  };
  const source = (key: MapPointKey) => MAP_POINTS.find((p) => p.key === key)!.source;
  const card = (
    key: MapPointKey,
    facts: MapCard["facts"],
    o: { role?: Record<string, string | number>; image?: string; links?: MapCard["links"] } = {},
  ): MapCard => ({
    name: t(`pages.map.point.${key}.name`),
    role: t(`pages.map.point.${key}.role`, o.role),
    facts,
    source: source(key),
    sourceName: wikiPageName(source(key)),
    image: o.image ?? null,
    links: o.links ?? [],
  });
  const smallCamp = (key: "lizard" | "beetle" | "golem", role?: Record<string, number>) =>
    card(
      key,
      [
        { label: label("firstSpawn"), value: formatTime(CAMPS[key].firstSpawn) },
        { label: label("respawn"), value: seconds(CAMPS[key].respawn) },
        hp(key),
        { label: label("reward"), value: heal },
      ],
      { role },
    );

  return {
    turtle: card(
      "turtle",
      [
        { label: label("firstSpawn"), value: formatTime(TURTLE.firstSpawn) },
        {
          label: label("respawn"),
          value: t("pages.map.point.turtle.respawn", { delay: TURTLE.respawn, cutoff: formatTime(TURTLE.cutoff), max: TURTLE.max }),
        },
        hp("turtle"),
        {
          label: label("reward"),
          value: t("pages.map.point.turtle.reward", {
            gold1: TURTLE.goldPerHero[0],
            gold2: TURTLE.goldPerHero[1],
            gold3: TURTLE.goldPerHero[2],
            shield: TURTLE.shield,
          }),
        },
      ],
      { image: OBJECTIFS.tortue.image, links: [timerLink, retributionLink] },
    ),
    lord: card(
      "lord",
      [
        {
          label: label("firstSpawn"),
          value: t("pages.map.point.lord.firstSpawn", {
            after: LORD.afterTurtle / 60,
            from: formatTime(TURTLE.lordFrom),
            latest: formatTime(TURTLE.lordAtLatest),
          }),
        },
        {
          label: label("respawn"),
          value: t("pages.map.point.lord.respawn", {
            respawn: LORD.respawn,
            lateFrom: formatTime(LORD.lateFrom),
            late: LORD.lateRespawn,
            infobox: formatTime(LORD.lateRespawnInfobox),
          }),
        },
        hp("lord"),
        { label: label("reward"), value: t("pages.map.point.lord.reward", { bonus: LORD.allyBonus, cooldown: LORD.allyBonusCooldown }) },
        { label: label("location"), value: t("pages.map.point.lord.location", { from: formatTime(TURTLE.lordFrom) }) },
      ],
      { image: OBJECTIFS.seigneur.image, links: [timerLink, retributionLink] },
    ),
    "purple-buff": card(
      "purple-buff",
      [
        { label: label("firstSpawn"), value: formatTime(BUFFS["purple-buff"].firstSpawn) },
        { label: label("respawn"), value: seconds(BUFFS["purple-buff"].respawn) },
        hp("purple-buff"),
        {
          label: label("reward"),
          value: t("pages.map.point.purple-buff.reward", {
            duration: BUFFS["purple-buff"].duration,
            cooldown: BUFF_EFFECTS.purple.cooldown,
            mana: BUFF_EFFECTS.purple.mana,
            energy: BUFF_EFFECTS.purple.energy,
            minion: BUFF_EFFECTS.purple.healMinion,
            hero: BUFF_EFFECTS.purple.healHero,
            creep: BUFF_EFFECTS.purple.healCreep,
          }),
        },
      ],
      { image: OBJECTIFS["buff-violet"].image, links: [timerLink, retributionLink] },
    ),
    "orange-buff": card(
      "orange-buff",
      [
        { label: label("firstSpawn"), value: formatTime(BUFFS["orange-buff"].firstSpawn) },
        { label: label("respawn"), value: seconds(BUFFS["orange-buff"].respawn) },
        hp("orange-buff"),
        {
          label: label("reward"),
          value: t("pages.map.point.orange-buff.reward", {
            duration: BUFFS["orange-buff"].duration,
            damage: BUFF_EFFECTS.orange.damage,
            slowMelee: BUFF_EFFECTS.orange.slow[0],
            slowRanged: BUFF_EFFECTS.orange.slow[1],
            penMelee: BUFF_EFFECTS.orange.penetration[0],
            penRanged: BUFF_EFFECTS.orange.penetration[1],
          }),
        },
      ],
      { image: OBJECTIFS["buff-orange"].image, links: [timerLink, retributionLink] },
    ),
    lithowanderer: card("lithowanderer", [
      { label: label("firstSpawn"), value: formatTime(CAMPS.lithowanderer.firstSpawn) },
      { label: label("respawn"), value: seconds(CAMPS.lithowanderer.respawn) },
      hp("lithowanderer"),
      {
        label: label("reward"),
        value: t("pages.map.point.lithowanderer.reward", {
          mana: CAMP_REWARDS.lithowanderer.mana,
          speed: CAMP_REWARDS.lithowanderer.speed,
          duration: CAMP_REWARDS.lithowanderer.duration,
          patrol: CAMP_REWARDS.lithowanderer.patrol,
        }),
      },
    ]),
    crab: card("crab", [
      {
        label: label("firstSpawn"),
        value: t("pages.map.point.crab.firstSpawn", {
          little: formatTime(CAMPS["little-crab"].firstSpawn),
          crab: formatTime(CAMPS.crab.firstSpawn),
          guide: formatTime(GUIDE_EVENTS.crabUpgrade),
        }),
      },
      {
        label: label("respawn"),
        value: t("pages.map.point.crab.respawn", { little: CAMPS["little-crab"].respawn, crab: CAMPS.crab.respawn }),
      },
      hp("crab"),
      {
        label: label("reward"),
        value: t("pages.map.point.crab.reward", {
          gold: CAMP_REWARDS.crab.gold,
          duration: CAMP_REWARDS.crab.duration,
          littleGold: CAMP_REWARDS.littleCrab.gold,
          littleDuration: CAMP_REWARDS.littleCrab.duration,
        }),
      },
    ]),
    lizard: smallCamp("lizard"),
    beetle: smallCamp("beetle", { larva: CAMP_REWARDS.larva }),
    golem: smallCamp("golem"),
    cyclone: card(
      "cyclone",
      [
        { label: label("firstSpawn"), value: formatTime(CAMPS.cyclone.firstSpawn) },
        { label: label("respawn"), value: t("pages.map.point.cyclone.respawn", { recharge: CAMPS.cyclone.respawn }) },
        { label: label("count"), value: number.format(CAMP_REWARDS.cycloneCount) },
      ],
      { role: { delay: number.format(CAMP_REWARDS.glideDelay) } },
    ),
    turret: card(
      "turret",
      [
        { label: label("count"), value: t("pages.map.point.turret.count", { perTeam: TURRETS.perTeam, perLane: TURRETS.perLane }) },
        { label: label("range"), value: t("pages.map.point.turret.range", { range: number.format(TURRETS.range), sight: TURRETS.sight }) },
      ],
      { role: { idle: TURRETS.idle, reduction: TURRETS.reduction, ramp: TURRETS.rampUp, rampMax: TURRETS.rampUpMax } },
    ),
    base: card("base", []),
    "exp-lane": card(
      "exp-lane",
      [
        waves,
        {
          label: label("bonus"),
          value: t("pages.map.point.exp-lane.bonus", { bonus: MINIONS.expBonus, waves: MINIONS.bonusWaves, end: formatTime(MINIONS.bonusEnd) }),
        },
      ],
      { links: [{ href: `/tier-list/role/${SLUGS_ROLE.Fighter}`, label: t("pages.map.tierLink", { role: t("roles.Fighter") }) }] },
    ),
    "mid-lane": card(
      "mid-lane",
      [
        waves,
        {
          label: label("bonus"),
          value: t("pages.map.point.mid-lane.bonus", {
            lancers: MINIONS.midLancers,
            infantry: MINIONS.midInfantry,
            waves: MINIONS.bonusWaves,
          }),
        },
      ],
      { links: [{ href: `/tier-list/role/${SLUGS_ROLE.Mage}`, label: t("pages.map.tierLink", { role: t("roles.Mage") }) }] },
    ),
    "gold-lane": card(
      "gold-lane",
      [
        waves,
        {
          label: label("bonus"),
          value: t("pages.map.point.gold-lane.bonus", { bonus: MINIONS.goldBonus, waves: MINIONS.bonusWaves, end: formatTime(MINIONS.bonusEnd) }),
        },
      ],
      { links: [{ href: `/tier-list/role/${SLUGS_ROLE.Marksman}`, label: t("pages.map.tierLink", { role: t("roles.Marksman") }) }] },
    ),
  };
}

type RotationKey = "jungle" | "roam" | "gold" | "exp" | "mid";

/** Role tier lists linked from each rotation. */
const ROTATION_ROLES: Record<RotationKey, Role[]> = {
  jungle: ["Assassin", "Fighter"],
  roam: ["Tank", "Support"],
  gold: ["Marksman"],
  exp: ["Fighter"],
  mid: ["Mage"],
};

export default async function MapPage({ params }: Params) {
  const { locale } = await params;
  const t = creerT(locale);
  const structuredData = donneesOutil(locale, {
    nom: t("pages.map.title"),
    description: t("pages.seo.map.description"),
    chemin: PATH,
    categorie: "GameApplication",
  });

  // Values quoted by the rotation tips, all from the sourced constants.
  const values = {
    orange: formatTime(BUFFS["orange-buff"].firstSpawn),
    purple: formatTime(BUFFS["purple-buff"].firstSpawn),
    litho: formatTime(CAMPS.lithowanderer.firstSpawn),
    turtle: formatTime(TURTLE.firstSpawn),
    buff: BUFFS["purple-buff"].respawn,
    share: formatTime(GUIDE_EVENTS.roamerShare),
    waves: MINIONS.bonusWaves,
    end: formatTime(MINIONS.bonusEnd),
    goldBonus: MINIONS.goldBonus,
    expBonus: MINIONS.expBonus,
    crabGold: CAMP_REWARDS.crab.gold,
    crabDuration: CAMP_REWARDS.crab.duration,
    littleCrab: formatTime(CAMPS["little-crab"].firstSpawn),
    lancers: MINIONS.midLancers,
    infantry: MINIONS.midInfantry,
  };
  const steps: Record<RotationKey, number> = { jungle: 4, roam: 4, gold: 4, exp: 3, mid: 3 };
  const rotations = (Object.keys(steps) as RotationKey[]).map((key) => ({
    key,
    title: t(`pages.map.rotations.${key}.title`),
    steps: Array.from({ length: steps[key] }, (_, i) => t(`pages.map.rotations.${key}.step${i + 1}`, values)),
    links: [
      ...ROTATION_ROLES[key].map((r) => ({ href: `/tier-list/role/${SLUGS_ROLE[r]}`, label: t("pages.map.tierLink", { role: t(`roles.${r}`) }) })),
      ...(key === "jungle" ? [{ href: "/tools/retribution", label: t("pages.map.retributionLink") }] : []),
    ],
  }));

  const sources = [...new Set([...MAP_POINTS.map((p) => p.source), SOURCES.jungle, SOURCES.minions, SOURCES.guide])];

  return (
    <CompleterMessages messages={messagesPage(locale, ["pages.mapUI"])}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: donneesLd(structuredData) }} />
      <EnTetePage titre={t("pages.map.title")} chapeau={t("pages.map.lead")} />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        <section aria-labelledby="map-title">
          <h2 id="map-title" className={sectionTitle}>
            {t("pages.map.mapTitle")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-craie-400">{t("pages.map.reading")}</p>
          <div className="mt-6">
            <MapGuide cards={mapCards(t, locale)} />
          </div>
        </section>

        <section aria-labelledby="rotations-title">
          <h2 id="rotations-title" className={sectionTitle}>
            {t("pages.map.rotations.title")}
          </h2>
          <div aria-hidden className="filet-or mt-2 h-0.5 w-16" />
          <p className="mt-3 max-w-3xl leading-relaxed text-craie-300">{t("pages.map.rotations.intro")}</p>
          <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rotations.map((r) => (
              <li key={r.key} className="relative">
                <div aria-hidden className="biseau absolute inset-0 border border-nuit-700/70 bg-nuit-900/60" />
                <div className="relative flex h-full flex-col p-5">
                  <h3 className="font-titre text-xl font-bold text-or-400">{r.title}</h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-craie-300 marker:text-craie-500">
                    {r.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-sm">
                    {r.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="font-semibold text-or-400 transition-colors hover:text-or-500">
                          {l.label} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm">
            <Link href="/tools/timer" className="font-semibold text-or-400 transition-colors hover:text-or-500">
              {t("pages.map.timerCta")} →
            </Link>
          </p>
        </section>

        <section aria-labelledby="sources-title" className="border-t border-nuit-800 pt-6 text-sm text-craie-500">
          <h2 id="sources-title" className="font-semibold text-craie-300">
            {t("pages.map.sourcesTitle")}
          </h2>
          <p className="mt-2">{t("pages.map.sourcesIntro", { date: formaterDate(CHECKED_ON, LOCALE_HTML[locale]) })}</p>
          <ul className="mt-2 grid list-disc gap-x-8 gap-y-1 pl-5 sm:grid-cols-2">
            {sources.map((url) => (
              <li key={url}>
                <a href={url} rel="noopener" className="underline transition-colors hover:text-or-400">
                  {wikiPageName(url)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </CompleterMessages>
  );
}
