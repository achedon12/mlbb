import {
  BookOpen,
  Cake,
  Crown,
  Flag,
  Hourglass,
  MapPin,
  PawPrint,
  Quote,
  Sparkles,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { HeroStory as Story } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * L'histoire d'un heros, mise en page pour la lecture : une accroche en
 * exergue, le recit en pleine largeur avec une lettrine, une fiche d'identite
 * illustree et les anecdotes en cartes.
 */

type FieldText = "title" | "species" | "gender" | "age" | "origin" | "birthday";

const FIELDS: { key: FieldText; label: string; icon: LucideIcon }[] = [
  { key: "title", label: "title", icon: Crown },
  { key: "species", label: "species", icon: PawPrint },
  { key: "gender", label: "gender", icon: Users },
  { key: "age", label: "age", icon: Hourglass },
  { key: "origin", label: "origin", icon: MapPin },
  { key: "birthday", label: "birthday", icon: Cake },
];

function GroupChips({
  title,
  values,
  icon: Icon,
}: {
  title: string;
  values: string[];
  icon: LucideIcon;
}) {
  if (!values.length) return null;
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-chalk-500">
        <Icon size={13} aria-hidden />
        {title}
      </dt>
      <dd className="mt-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="bevel-sm border border-night-700/70 bg-night-800/60 px-2 py-1 text-xs text-chalk-200"
          >
            {v}
          </span>
        ))}
      </dd>
    </div>
  );
}

export function HeroStory({ story, name, locale }: { story: Story; name: string; locale: Locale }) {
  const t = createT(locale);
  const { tagline, lore, profile, trivia } = story;
  const [first, ...run] = lore;

  return (
    <div className="space-y-12">
      {/* Accroche en exergue. */}
      {tagline && (
        <figure className="relative overflow-hidden">
          <Quote
            aria-hidden
            size={80}
            className="pointer-events-none absolute -left-3 -top-4 text-night-800"
            strokeWidth={1.5}
          />
          <blockquote className="relative pl-6 font-heading text-xl italic leading-relaxed text-chalk-100 sm:text-2xl">
            {tagline}
          </blockquote>
        </figure>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        {/* Le recit, en colonne de lecture. */}
        <div className="min-w-0">
          {lore.length > 0 ? (
            <section>
              <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-[0.15em] text-gold-400">
                <BookOpen size={16} aria-hidden />
                {t("story.story")}
              </h2>
              <div className="mt-5 max-w-[68ch] space-y-4 text-[0.95rem] leading-[1.8] text-chalk-300">
                {first && (
                  <p className="first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-heading first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.8] first-letter:text-gold-400">
                    {first}
                  </p>
                )}
                {run.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          ) : (
            !tagline && (
              <p className="leading-relaxed text-chalk-500">
                {t("story.noStory", { nom: name })}
              </p>
            )
          )}
        </div>

        {/* La fiche d'identite. */}
        {profile && (
          <aside className="bevel border border-night-700/60 bg-night-950/50 p-5 lg:sticky lg:top-24">
            <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-chalk-100">
              {profile.fullName ?? name}
            </h2>
            <div aria-hidden className="gold-rule mt-3 h-0.5 w-12" />
            <dl className="mt-5 space-y-4 text-sm">
              {FIELDS.map(({ key, label, icon: Icon }) =>
                profile[key] ? (
                  <div key={key} className="flex gap-3">
                    <span className="mt-0.5 text-chalk-500">
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-wide text-chalk-500">{t(`story.${label}`)}</dt>
                      <dd className="mt-0.5 text-chalk-100">{profile[key]}</dd>
                    </div>
                  </div>
                ) : null,
              )}
            </dl>
            {(profile.affiliations.length > 0 ||
              profile.relations.length > 0 ||
              profile.powers.length > 0) && (
              <dl className="mt-5 space-y-4 border-t border-night-800 pt-5 text-sm">
                <GroupChips title={t("story.powers")} values={profile.powers} icon={Wand2} />
                <GroupChips title={t("story.affiliations")} values={profile.affiliations} icon={Flag} />
                <GroupChips title={t("story.relations")} values={profile.relations} icon={Users} />
              </dl>
            )}
          </aside>
        )}
      </div>

      {/* Anecdotes. */}
      {trivia.length > 0 && (
        <section className="border-t border-night-800 pt-10">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-[0.15em] text-azure-400">
            <Sparkles size={16} aria-hidden />
            {t("story.didYouKnow")}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {trivia.map((a, i) => (
              <li
                key={i}
                className="bevel-sm border border-night-700/50 bg-night-900/40 p-4 text-sm leading-relaxed text-chalk-300"
              >
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
