import { HeroTile } from "@/components/hero-tile";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { toHtml } from "@/lib/content";
import { heroesBySlug } from "@/lib/data";
import { EDITORIAL_LOCALE, readAuthor, type AuthorProfile as Profile } from "@/lib/editorial";
import { cleanGuideHtml } from "@/lib/html";
import { longDate } from "@/lib/freshness";
import { cn } from "@/lib/utils";

/**
 * « Qui fait MLBBDex », on `/about`: the author's own profile, from
 * `content/fr/editorial/auteur.md`. Nothing is shown until the author has
 * filled and published it: no placeholder name, no invented biography.
 */
export function AuthorProfile({ locale, className }: { locale: Locale; className?: string }) {
  const profile = readAuthor();
  if (!profile) return null;
  return <AuthorProfileView profile={profile} locale={locale} className={className} />;
}

export function AuthorProfileView({ profile, locale, className }: { profile: Profile; locale: Locale; className?: string }) {
  const t = createT(locale);
  const heroes = profile.heroes.flatMap((slug) => {
    const h = heroesBySlug.get(slug);
    return h ? [h] : [];
  });
  const facts = [
    profile.role && { label: t("editorial.author.role"), value: profile.role },
    profile.rank && { label: t("editorial.author.rank"), value: profile.rank },
  ].filter((f): f is { label: string; value: string } => !!f);
  const contactLabel = profile.contact?.startsWith("mailto:") ? profile.contact.slice("mailto:".length) : profile.contact;

  return (
    <section id="auteur" aria-labelledby="author-title" data-author-profile className={cn("page-wrap scroll-mt-24 pt-10 sm:pt-14", className)}>
      <h2 id="author-title" className="type-section text-chalk-100">
        {t("editorial.author.title")}
      </h2>
      <div aria-hidden className="eclat mt-3 h-[3px] w-24" />

      <div className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <p className="display-caps break-words text-[clamp(2.4rem,1.6rem+3vw,4rem)] text-gold-400">{profile.name}</p>
          {facts.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-heading text-lg">
              {facts.map((f) => (
                <div key={f.label} className="flex gap-2">
                  <dt className="font-bold uppercase text-chalk-400">{f.label}</dt>
                  <dd className="font-semibold text-chalk-100">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <h3 className="type-subtitle mt-8 text-chalk-100">{t("editorial.author.why")}</h3>
          <div
            lang={EDITORIAL_LOCALE}
            className="prose-mlbb mt-3 max-w-2xl"
            dangerouslySetInnerHTML={{ __html: cleanGuideHtml(toHtml(profile.body), locale) }}
          />
          {locale !== EDITORIAL_LOCALE && <p className="mt-4 text-xs text-chalk-500">{t("editorial.original")}</p>}
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-chalk-400">
            {profile.contact && (
              <span>
                {t("editorial.author.contact")}{" "}
                <a
                  href={profile.contact}
                  className="text-gold-400 hover:underline"
                  {...(profile.contact.startsWith("https:") ? { rel: "noopener noreferrer", target: "_blank" } : {})}
                >
                  {contactLabel}
                </a>
              </span>
            )}
            {profile.updated && (
              <time dateTime={profile.updated}>{t("editorial.author.updated", { date: longDate(locale, profile.updated) })}</time>
            )}
          </p>
        </div>

        {heroes.length > 0 && (
          <div className="min-w-0">
            <h3 className="type-subtitle text-chalk-100">{t("editorial.author.heroes")}</h3>
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {heroes.slice(0, 6).map((h) => (
                <li key={h.slug}>
                  <HeroTile
                    href={`/heroes/${h.slug}`}
                    name={h.name}
                    portrait={h.images.portrait ?? h.images.icon}
                    sizes="(min-width: 1024px) 12vw, 30vw"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div aria-hidden className="eclat-rule mt-12" />
    </section>
  );
}
