import Image from "next/image";
import { Breadcrumb } from "@/components/breadcrumb";
import { metaLocales } from "@/i18n/seo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck, Check, CloudUpload, Flame, ShieldCheck } from "lucide-react";
import Link from "@/components/link";
import { DiscordMark } from "@/components/bot/discord-mark";
import { currentDiscordLogin, discordLoginEnabled } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
import { Dex } from "@/components/mascot";
import { heroArt } from "@/components/stage";
import { tokenCurrent } from "@/lib/session";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage } from "@/i18n/translations";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return { title: t("pages.login.metaTitle"), description: t("pages.login.metaDescription"), alternates: metaLocales(locale, "/login"), robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Sign-in, staged as a welcome: Dex greets the visitor on an official
 * artwork, with what an account opens; beside it the two steps of the
 * game's own verification (identifier, then the code sent in game), and
 * the Discord login as the one-tap alternative. Above the form, on every
 * screen, why sign in at all: streaks, favourites and reminders that follow
 * the visitor to every device, and a profile with badges. A visitor sent by
 * a prompt (`?from=prompt`) reads that their progress will be kept.
 */
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { locale } = await params;
  const { from } = await searchParams;
  const t = createT(locale);
  if (await tokenCurrent()) redirect(`/${locale}/account`);
  const art = heroArt("miya");
  const syncing = databaseConfigured();
  const discordEnabled = syncing && discordLoginEnabled();
  const discord = discordEnabled ? await currentDiscordLogin().catch(() => null) : null;
  const fromPrompt = from === "prompt";

  return (
    <div className="page-wrap py-6 sm:py-10">
      <Breadcrumb crumbs={[{ name: t("pages.login.title") }]} className="mb-5 [&_ol]:px-2 [&_ol]:py-1 [&_ol]:text-xs" />
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
        {/* The welcome: art, Dex and what an account opens. */}
        <section aria-labelledby="login-welcome" className="art-tile bevel-lg relative isolate flex min-h-[19rem] flex-col justify-end bg-night-800 p-5 sm:p-8 lg:min-h-[36rem]">
          {art && (
            <div aria-hidden className="absolute inset-0 -z-10">
              <Image src={art} alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="affiche-art object-cover object-[60%_18%]" />
              <div className="absolute inset-0 bg-linear-to-t from-night-950 via-night-950/75 to-night-950/5" />
            </div>
          )}
          <div className="stage-dex dex-host flex items-end gap-3 sm:gap-5">
            <span aria-hidden className="shrink-0">
              <span className="hidden sm:block">
                <Dex pose="salut" height={210} priority />
              </span>
              <span className="block sm:hidden">
                <Dex pose="salut" height={120} still priority />
              </span>
            </span>
            <div className="dex-bubble mb-4 min-w-0 flex-1">
              <p id="login-welcome" className="display-caps text-[1.9rem] text-gold-400 sm:text-[2.4rem]">
                {t("pages.login.welcome")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-chalk-200">{t("pages.login.welcomeText")}</p>
            </div>
          </div>
          <ul className="mt-5 hidden gap-2 sm:grid">
            {(syncing ? (["sync", "profile", "community", "collection"] as const) : (["profile", "community", "collection"] as const)).map((k) => (
              <li key={k} className="flex items-center gap-2.5 text-sm text-chalk-200">
                <span aria-hidden className="bevel-sm grid size-6 shrink-0 place-items-center bg-gold-400 text-night-950">
                  <Check size={14} strokeWidth={3} />
                </span>
                {t(`pages.login.perks.${k}`)}
              </li>
            ))}
          </ul>
        </section>

        {/* The two steps. */}
        <div className="stage-enter flex flex-col justify-center">
          <h1 className="affiche-name display-caps text-[clamp(3rem,2rem+4vw,5.5rem)] text-chalk-100">{t("pages.login.title")}</h1>
          <div aria-hidden className="eclat mt-4 h-[3px] w-24" />
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-chalk-300 sm:text-base">{t("pages.login.intro")}</p>

          {/* Why sign in: what the visitor keeps, on every screen size. */}
          {syncing && (
            <section aria-labelledby="login-why" className="mt-6 max-w-lg border-l-2 border-gold-400 pl-4">
              <h2 id="login-why" className="font-heading text-lg font-bold uppercase text-gold-400">
                {fromPrompt ? t("pages.login.pitch.fromPrompt") : t("pages.login.pitch.title")}
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-chalk-200">
                {([
                  ["sync", CloudUpload],
                  ["streaks", Flame],
                  ["badges", BadgeCheck],
                ] as const).map(([k, Icon]) => (
                  <li key={k} className="flex items-start gap-2">
                    <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-gold-400" />
                    {t(`pages.login.pitch.${k}`)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-chalk-500">{t("pages.login.pitch.local")}</p>
            </section>
          )}

          {discord && (
            <p className="bevel mt-6 max-w-lg bg-night-900 p-4 text-sm text-chalk-300">
              {t("pages.login.discordSignedIn", { name: discord.name })}{" "}
              <Link href="/account/progress" className="font-semibold text-gold-400 hover:underline">
                {t("pages.login.discordProgress")}
              </Link>
            </p>
          )}

          <div className="bevel-lg mt-6 max-w-lg bg-night-900 p-5 sm:p-7">
            <ExtendMessages messages={messagesPage(locale, ["loginForm"])}>
              <LoginForm />
            </ExtendMessages>
          </div>

          {discordEnabled && !discord && (
            <div className="mt-4 max-w-lg">
              <p className="text-xs uppercase tracking-wide text-chalk-500">{t("pages.login.or")}</p>
              <a
                href={`/api/discord/login?${new URLSearchParams({ locale, next: "progress" })}`}
                className="bevel-sm mt-2 inline-flex min-h-11 items-center gap-2 bg-blurple-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blurple-600"
              >
                <DiscordMark />
                {t("pages.login.discord")}
              </a>
              <p className="mt-2 text-xs text-chalk-500">{t("pages.login.discordText")}</p>
            </div>
          )}

          <p className="mt-6 flex max-w-lg gap-2 text-xs leading-relaxed text-chalk-500">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-azure-400" aria-hidden />
            {t("pages.login.security")}
          </p>
        </div>
      </div>
    </div>
  );
}
