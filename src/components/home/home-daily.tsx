import { DailyGames } from "@/components/daily-dle";
import { Dex } from "@/components/mascot";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";

/**
 * The day's games as the page's bright moment: a full band of gold, dark
 * ink on it in both themes, Dex standing large at the left and, beside him,
 * the title, the countdown before the next puzzles in large figures and the
 * two buttons (MLBBdle, the quiz). The countdown and the state of today's
 * MLBBdle are read in the browser (`DailyGames`).
 */
export function HomeDaily({ locale, className }: { locale: Locale; className?: string }) {
  const t = createT(locale);
  return (
    <section aria-labelledby="home-daily" className={className}>
      <div className="grid items-center gap-x-16 gap-y-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Dex pose="victoire" height={340} still className="hidden shrink-0 lg:inline-block" />
        <div className="min-w-0">
          <div className="flex items-end gap-5">
            <Dex pose="victoire" height={150} still className="shrink-0 lg:hidden" />
            <h2 id="home-daily" className="display-caps pb-1 text-[clamp(3rem,1.4rem+5vw,7rem)] leading-[0.84] text-night-950">
              {t("home.daily.title")}
            </h2>
          </div>
          <p className="mt-4 max-w-md text-lg font-medium text-night-950/80">{t("home.daily.lead")}</p>
          <DailyGames
            place="home"
            className="mt-8"
            playDle={t("home.daily.playDle")}
            playQuiz={t("home.daily.playQuiz")}
          />
        </div>
      </div>
    </section>
  );
}
