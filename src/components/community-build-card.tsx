import Image from "next/image";
import Link from "@/components/link";
import { VoteButton } from "@/components/community-build-actions";
import { HeroPortrait } from "@/components/hero-portrait";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { emblemImage, emblemName, itemImage, simCatalog, spellImage, spellName, talentImage, talentName } from "@/lib/build-catalog";
import { simulate, type StatKey } from "@/lib/build-simulator";
import type { PublicBuild } from "@/lib/community-builds";
import { longDate } from "@/lib/freshness";

/**
 * A community build in a list: choices, a stats summary computed on the
 * server, votes, and the way to the simulator. Server component: the only
 * script it brings is the vote button.
 *
 * Title, notes and author name are user text: rendered as React text nodes,
 * never as HTML. The card is a bevelled night surface, no frame; with the
 * hero shown, its portrait runs down the left side and zooms a little on hover.
 */

const SUMMARY: StatKey[] = ["hp", "physicalAttack", "magicPower", "physicalDefense", "magicDefense", "cooldownReduction"];

function Icon({ src, label, round = false }: { src: string | null; label: string; round?: boolean }) {
  return (
    <span title={label} className={`relative block size-10 shrink-0 overflow-hidden bg-night-800 ${round ? "rounded-full" : "bevel-sm"}`}>
      {src ? (
        <Image src={src} alt={label} width={40} height={40} className="size-full object-contain" />
      ) : (
        <span className="grid size-full place-items-center text-xs text-chalk-500">
          {label.charAt(0)}
          <span className="sr-only">{label}</span>
        </span>
      )}
    </span>
  );
}

export function CommunityBuildCard({
  build,
  t,
  locale,
  hero,
  itemNames,
  signedIn,
  showHero = false,
}: {
  build: PublicBuild;
  t: T;
  locale: Locale;
  /** `portrait`: the tall portrait, drawn down the card's side when the hero is shown. */
  hero: { name: string; icon: string | null; portrait?: string | null };
  itemNames: Record<string, string>;
  signedIn: boolean;
  showHero?: boolean;
}) {
  const result = simulate(build.build, simCatalog);
  const whole = new Intl.NumberFormat(LOCALE_INTL[locale], { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(LOCALE_INTL[locale], { style: "percent", maximumFractionDigits: 1 });
  const b = build.build;
  const talents = b.talents.filter((k): k is string => k !== null);

  const portrait = showHero ? (hero.portrait ?? hero.icon) : null;

  return (
    <article className="bevel group/card flex bg-night-900">
      {portrait && (
        <Link
          href={`/builds/${build.hero}`}
          aria-label={hero.name}
          className="relative hidden w-28 shrink-0 overflow-hidden bg-night-800 min-[420px]:block"
        >
          <Image
            src={portrait}
            alt=""
            fill
            sizes="7rem"
            className="object-cover object-top transition-transform duration-300 group-hover/card:scale-[1.04]"
          />
          <span aria-hidden className="absolute inset-0 bg-linear-to-r from-transparent from-50% to-night-900" />
        </Link>
      )}
      <div className="min-w-0 flex-1 space-y-3 p-4">
        <header className="flex items-start gap-3">
          {showHero && (
            <span className="min-[420px]:hidden">
              <HeroPortrait source={hero.icon} name={hero.name} size="icon" decorative />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {showHero && <p className="font-heading text-sm font-bold uppercase text-gold-400">{hero.name}</p>}
            <h3 className="display-caps text-[1.7rem] text-chalk-100">
              <Link href={`/builds/${build.hero}/${build.id}`} className="break-words transition-colors hover:text-gold-300">
                {build.title}
              </Link>
            </h3>
            <p className="mt-1 text-xs text-chalk-500">
              {showHero ? <span className="sr-only">{`${hero.name} - `}</span> : null}
              {t("pages.communityBuilds.byLine", { name: build.authorName, date: longDate(locale, build.createdAt) })}
            </p>
          </div>
        </header>

        <ul className="flex flex-wrap gap-1.5" aria-label={t("pages.communityBuilds.items")}>
          {b.items.map((slug, i) => (
            <li key={`${slug}-${i}`}>
              <Icon src={itemImage(slug)} label={itemNames[slug] ?? slug} />
            </li>
          ))}
        </ul>

        <p className="flex flex-wrap items-center gap-1.5 text-xs text-chalk-400">
          {b.emblem && <Icon src={emblemImage(b.emblem)} label={emblemName(t, b.emblem)} round />}
          {talents.map((k) => (
            <Icon key={k} src={talentImage(k)} label={talentName(t, k)} round />
          ))}
          {b.spell && <Icon src={spellImage(b.spell)} label={spellName(t, b.spell)} round />}
          <span className="ml-1">{t("pages.communityBuilds.level", { level: b.level })}</span>
        </p>

        {result && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs min-[420px]:grid-cols-3">
            {SUMMARY.map((key) => {
              const v = result.stats[key].value;
              return (
                <div key={key} className="flex justify-between gap-2 border-b border-night-800 py-1">
                  <dt className="text-chalk-500">{t(`pages.buildSimulatorUI.stats.${key}`)}</dt>
                  <dd className="font-heading text-sm font-bold tabular-nums text-chalk-100">
                    {v === null ? "-" : key === "cooldownReduction" ? percent.format(v / 100) : whole.format(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}

        {build.notes && <p className="line-clamp-3 whitespace-pre-line text-sm text-chalk-300">{build.notes}</p>}

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <VoteButton id={build.id} votes={build.votes} voted={build.voted} own={build.own} signedIn={signedIn} />
          <Link
            href={`/tools/build?${build.code}`}
            className="inline-flex min-h-11 items-center text-sm text-gold-400 underline underline-offset-4 hover:text-gold-500"
          >
            {t("pages.communityBuilds.openSimulator")}
          </Link>
          <Link
            href={`/builds/${build.hero}/${build.id}`}
            className="inline-flex min-h-11 items-center text-sm text-chalk-300 underline underline-offset-4 hover:text-gold-400"
          >
            {t("pages.communityBuilds.details")}
          </Link>
        </footer>
      </div>
    </article>
  );
}
