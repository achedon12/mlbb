import Image from "next/image";
import Link from "@/components/link";
import { ArrowRight } from "lucide-react";
import type { Hero } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * Heros mis en avant, en pleine largeur.
 *
 * L'accueil doit dire en une image de quoi le site parle. Le heros change
 * chaque jour, sans aleatoire : un tirage au sort donnerait un visuel
 * different a chaque rechargement, ce qui empeche de reconnaitre la page.
 */
export function HomeFeatured({
  hero: heroes,
  illustration,
  tier,
  win,
  locale,
}: {
  hero: Hero;
  illustration: string;
  tier: string | null;
  win: number | null;
  locale: Locale;
}) {
  const t = createT(locale);
  return (
    <section className="relative overflow-hidden border-b border-night-700/70">
      <div aria-hidden className="absolute inset-0">
        <Image
          src={illustration}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[60%_25%]"
        />
        {/* Le texte occupe la gauche : le voile y est franc, et s'ouvre a droite. */}
        <div className="absolute inset-0 bg-linear-to-r from-night-950 via-night-950/85 to-night-950/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-night-950 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <p className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-gold-400">
          {t("featured.heroOfTheDay")}
        </p>

        <h2 className="mt-3 font-heading text-5xl font-bold leading-none text-chalk-100 sm:text-6xl">
          {heroes.name}
        </h2>
        {heroes.title && <p className="mt-2 text-xl text-gold-400">{heroes.title}</p>}

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {[
            [t("featured.role"), heroes.roles.map((r) => t(`roles.${r}`)).join(", ")],
            [t("featured.position"), heroes.lanes.map((l) => t(`lanes.${l}`)).join(", ")],
            tier ? [t("featured.tierList"), t("featured.tier", { p: tier })] : null,
            win !== null ? [t("featured.wins"), `${win.toFixed(1)} %`] : null,
            heroes.skins.length ? [t("featured.skins"), String(heroes.skins.length)] : null,
          ]
            .filter((e): e is [string, string] => e !== null && Boolean(e[1]))
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-chalk-500">{label}</dt>
                <dd className="mt-0.5 font-medium text-chalk-100">{value}</dd>
              </div>
            ))}
        </dl>

        <Link
          href={`/heroes/${heroes.slug}`}
          className="bevel-sm mt-8 inline-flex items-center gap-2 bg-gold-500 px-6 py-3 font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {t("featured.seeSheet")}
          <ArrowRight size={18} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
