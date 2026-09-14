import { ArrowRight, FlaskConical } from "lucide-react";
import Link from "@/components/link";
import { EntryCard, VersionDate } from "@/components/advance-changes";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { advanceVersions, upcomingForHero } from "@/lib/advance-server";
import { heroesBySlug } from "@/lib/data";
import { patchCurrent } from "@/lib/freshness";

/**
 * Changes of one hero being tested on the Advance Server, for its page.
 * Renders nothing unless a test build newer than the live patch touches the
 * hero: notes from an older build describe changes that have shipped, been
 * reworked or been dropped since.
 */
export function NextPatch({ slug, locale }: { slug: string; locale: Locale }) {
  const upcoming = upcomingForHero(advanceVersions(locale), slug, patchCurrent.version);
  if (upcoming.length === 0) return null;
  const t = createT(locale);
  const name = heroesBySlug.get(slug)?.name ?? slug;

  return (
    <section aria-labelledby="next-patch" className="scroll-mt-24">
      <h2 id="next-patch" className="flex items-center gap-2 font-heading text-2xl font-bold text-chalk-100">
        <FlaskConical size={22} aria-hidden className="shrink-0 text-gold-400" />
        {t("pages.advanceServer.next.title")}
      </h2>
      <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
      <p className="mt-4 text-sm leading-relaxed text-chalk-300">{t("pages.advanceServer.next.intro", { name })}</p>

      <div className="mt-6 space-y-8">
        {upcoming.map((u) => (
          <div key={u.version}>
            <h3 className="font-heading text-lg font-bold text-chalk-100">
              {t("pages.advanceServer.heading", { v: u.version })}
            </h3>
            <p className="mt-1 text-xs text-chalk-500">
              <VersionDate version={u} locale={locale} t={t} />
            </p>
            {u.announcements.map((a) => (
              <p key={a.title} className="mt-3 text-sm text-chalk-300">
                {t(a.kind === "new" ? "pages.advanceServer.next.announcedNew" : "pages.advanceServer.next.announcedRevamp", {
                  name,
                  v: u.version,
                })}
              </p>
            ))}
            {u.changes.length > 0 && (
              <div className="mt-3 space-y-3">
                {u.changes.map((c, i) => (
                  <EntryCard key={i} entry={c} t={t} headingLevel={4} />
                ))}
              </div>
            )}
            <Link
              href={`/patch-notes/advance-server/${u.version}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 hover:text-gold-500"
            >
              {t("pages.advanceServer.next.readVersion", { v: u.version })}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
