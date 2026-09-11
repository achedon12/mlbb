import Image from "next/image";
import Link from "@/components/lien";
import { VoteButton } from "@/components/community-build-actions";
import { PortraitHeros } from "@/components/portrait-heros";
import { LOCALE_HTML, type Langue } from "@/i18n/config";
import type { T } from "@/i18n/t";
import { emblemImage, emblemName, itemImage, simCatalog, spellImage, spellName, talentImage, talentName } from "@/lib/build-catalog";
import { simulate, type StatKey } from "@/lib/build-simulator";
import type { PublicBuild } from "@/lib/community-builds";
import { dateLongue } from "@/lib/fraicheur";

/**
 * A community build in a list: choices, a stats summary computed on the
 * server, votes, and the way to the simulator. Server component: the only
 * script it brings is the vote button.
 *
 * Title, notes and author name are user text: rendered as React text nodes,
 * never as HTML. The bevel sits on a background layer so it clips nothing.
 */

const SUMMARY: StatKey[] = ["hp", "physicalAttack", "magicPower", "physicalDefense", "magicDefense", "cooldownReduction"];

function Icon({ src, label, round = false }: { src: string | null; label: string; round?: boolean }) {
  return (
    <span title={label} className={`relative block size-9 shrink-0 overflow-hidden bg-night-800 ${round ? "rounded-full" : ""}`}>
      {src ? (
        <Image src={src} alt={label} fill unoptimized className="object-contain" />
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
  locale: Langue;
  hero: { name: string; icon: string | null };
  itemNames: Record<string, string>;
  signedIn: boolean;
  showHero?: boolean;
}) {
  const result = simulate(build.build, simCatalog);
  const whole = new Intl.NumberFormat(LOCALE_HTML[locale], { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(LOCALE_HTML[locale], { style: "percent", maximumFractionDigits: 1 });
  const b = build.build;
  const talents = b.talents.filter((k): k is string => k !== null);

  return (
    <article className="relative">
      <div aria-hidden className="bevel absolute inset-0 border border-night-700/70 bg-night-900/60" />
      <div className="relative space-y-3 p-4">
        <header className="flex items-start gap-3">
          {showHero && <PortraitHeros source={hero.icon} nom={hero.name} taille="icone" decoratif />}
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-lg font-bold leading-tight text-chalk-100">
              <Link href={`/builds/${build.hero}/${build.id}`} className="break-words transition-colors hover:text-gold-400">
                {build.title}
              </Link>
            </h3>
            <p className="mt-0.5 text-xs text-chalk-500">
              {showHero ? `${hero.name} - ` : ""}
              {t("pages.communityBuilds.byLine", { name: build.authorName, date: dateLongue(locale, build.createdAt) })}
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
                  <dd className="tabular-nums text-chalk-100">
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
