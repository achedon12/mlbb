import { DailyGames } from "@/components/daily-dle";
import { Dex } from "@/components/mascot";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * The day's games as one scene: Dex, the site's mascot, standing large
 * beside the title, and across from them MLBBdle and the quiz as two lines
 * of call to action (name, one line, button), then the time left before
 * both renew in large figures. The lines read what MLBBdle keeps in the
 * browser (`DailyGames`); the rest is the server's.
 */
export function HomeDaily({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  return (
    <section aria-labelledby="home-daily" className={className}>
      <div className="grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex items-end gap-6 sm:gap-8">
          <Dex pose="idee" height={190} still className="shrink-0" />
          <div className="min-w-0 pb-2">
            <h2 id="home-daily" className="display-caps text-[clamp(2.6rem,1.6rem+3vw,4.5rem)] leading-[0.88] text-chalk-100">
              {t("home.daily.title")}
            </h2>
            <p className="mt-4 max-w-xs text-chalk-300">{t("home.daily.lead")}</p>
          </div>
        </div>
        <DailyGames place="home" />
      </div>
    </section>
  );
}
