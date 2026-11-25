import { DailyGames } from "@/components/daily-dle";
import { Dex } from "@/components/mascot";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * The day's games, MLBBdle and the quiz, as one block: Dex presenting them,
 * the title and what they are, then a card per game with its state today
 * and a "Play" button, and the time left before both renew. The cards read
 * what MLBBdle keeps in the browser (`DailyGames`); the rest is the server's.
 */
export function HomeDaily({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  return (
    <section aria-labelledby="home-daily" className={className}>
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div className="flex items-end gap-4 sm:gap-6">
          <Dex pose="idee" height={112} className="shrink-0" />
          <div className="min-w-0">
            <h2 id="home-daily" className="type-section text-chalk-100">
              {t("home.daily.title")}
            </h2>
            <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
            <p className="mt-3 max-w-md text-sm text-chalk-300 sm:text-base">{t("home.daily.lead")}</p>
          </div>
        </div>
        <DailyGames place="home" />
      </div>
    </section>
  );
}
