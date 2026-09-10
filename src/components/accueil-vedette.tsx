import Image from "next/image";
import Link from "@/components/lien";
import { ArrowRight } from "lucide-react";
import type { Heros } from "@/lib/types";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";

/**
 * Heros mis en avant, en pleine largeur.
 *
 * L'accueil doit dire en une image de quoi le site parle. Le heros change
 * chaque jour, sans aleatoire : un tirage au sort donnerait un visuel
 * different a chaque rechargement, ce qui empeche de reconnaitre la page.
 */
export function AccueilVedette({
  heros,
  illustration,
  palier,
  victoire,
  langue,
}: {
  heros: Heros;
  illustration: string;
  palier: string | null;
  victoire: number | null;
  langue: Langue;
}) {
  const t = creerT(langue);
  return (
    <section className="relative overflow-hidden border-b border-nuit-700/70">
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
        <div className="absolute inset-0 bg-linear-to-r from-nuit-950 via-nuit-950/85 to-nuit-950/30" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-nuit-950 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <p className="font-titre text-sm font-semibold uppercase tracking-[0.2em] text-or-400">
          {t("vedette.herosDuJour")}
        </p>

        <h2 className="mt-3 font-titre text-5xl font-bold leading-none text-craie-100 sm:text-6xl">
          {heros.nom}
        </h2>
        {heros.titre && <p className="mt-2 text-xl text-or-400">{heros.titre}</p>}

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          {[
            [t("vedette.role"), heros.roles.map((r) => t(`roles.${r}`)).join(", ")],
            [t("vedette.position"), heros.lanes.map((l) => t(`lanes.${l}`)).join(", ")],
            palier ? [t("vedette.tierList"), t("vedette.palier", { p: palier })] : null,
            victoire !== null ? [t("vedette.victoires"), `${victoire.toFixed(1)} %`] : null,
            heros.skins.length ? [t("vedette.skins"), String(heros.skins.length)] : null,
          ]
            .filter((e): e is [string, string] => e !== null && Boolean(e[1]))
            .map(([label, valeur]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-craie-500">{label}</dt>
                <dd className="mt-0.5 font-medium text-craie-100">{valeur}</dd>
              </div>
            ))}
        </dl>

        <Link
          href={`/heroes/${heros.slug}`}
          className="biseau-sm mt-8 inline-flex items-center gap-2 bg-or-500 px-6 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
        >
          {t("vedette.voirFiche")}
          <ArrowRight size={18} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
