import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginPanel, UserBar } from "@/components/bot/dashboard-parts";
import { ModerationActions, UnbanButton } from "@/components/community/moderation-actions";
import { ago, Unavailable } from "@/components/community/parts";
import Link from "@/components/link";
import { PageHeader } from "@/components/ui";
import { LOCALE_INTL, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { createT, messagesPage } from "@/i18n/translations";
import { botConfig, isSuperAdmin } from "@/lib/bot/config";
import { currentDiscordUser } from "@/lib/bot/session";
import { plainText } from "@/lib/community/markdown";
import { bannedMembers, moderationQueue, recentLog } from "@/lib/community/store";
import { requestTime } from "@/lib/community/server";
import { databaseConfigured } from "@/lib/db";

/**
 * Moderation queue of the community: open reports, one entry per target,
 * the most reported first, with the decisions at hand; the accounts banned;
 * the log of what moderators did. Moderators are the bot's super admins
 * (Discord login, BOT_SUPER_ADMIN_IDS), checked on every request; anyone
 * else gets the same 404 as a missing page.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ login?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  return { title: createT(locale)("pages.community.moderation.title"), robots: { index: false, follow: false } };
}

const sectionTitle = "font-heading text-xl font-bold text-chalk-100";

export default async function ModerationPage({ params, searchParams }: Params) {
  const { locale } = await params;
  const query = await searchParams;
  const t = createT(locale);
  const config = botConfig();
  if (!config || !databaseConfigured()) notFound();
  const user = await currentDiscordUser(config);
  const header = <PageHeader title={t("pages.community.moderation.title")} lead={t("pages.community.moderation.lead")} crumbs={[{ name: t("pages.community.title"), href: "/community" }, { name: t("pages.community.moderation.title") }]} />;

  if (!user) {
    return (
      <>
        {header}
        <div className="page-wrap py-10">
          <LoginPanel t={t} locale={locale} next="moderation" failed={query.login === "failed"} />
        </div>
      </>
    );
  }
  if (!isSuperAdmin(config, user.id)) notFound();

  const now = await requestTime();
  const data = await Promise.all([moderationQueue(50, now), bannedMembers(now), recentLog(40)]).catch(() => null);

  return (
    <>
      {header}
      <ExtendMessages messages={messagesPage(locale, ["pages.communityUI"])}>
        <div className="page-wrap space-y-12 py-10">
          <UserBar t={t} locale={locale} user={user} />
          {!data ? (
            <Unavailable t={t} />
          ) : (
            <>
              <section aria-labelledby="queue-title">
                <h2 id="queue-title" className={sectionTitle}>
                  {t("pages.community.moderation.queue", { n: data[0].length })}
                </h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                {data[0].length === 0 ? (
                  <p className="mt-5 text-sm text-chalk-400">{t("pages.community.moderation.queueEmpty")}</p>
                ) : (
                  <ul className="mt-5 space-y-4">
                    {data[0].map((e) => (
                      <li key={`${e.kind}:${e.id}`} className="bevel space-y-3 border border-night-800 bg-night-900/60 p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm text-chalk-300">
                            <span className="font-semibold text-chalk-100">{t(`pages.community.moderation.kinds.${e.kind}`)}</span>
                            {" · "}
                            {e.authorName}
                            {e.authorBanned && <span className="ml-2 text-xs text-blood-400">{t("pages.community.moderation.banned")}</span>}
                            {e.hidden && <span className="ml-2 text-xs text-gold-400">{t("pages.community.moderation.hidden")}</span>}
                            {e.deleted && <span className="ml-2 text-xs text-chalk-500">{t("pages.community.moderation.deleted")}</span>}
                            <span className="ml-2 text-xs text-chalk-500">{t("pages.community.moderation.reportCount", { n: e.count })}</span>
                          </p>
                          {!e.deleted && (
                            <Link href={e.path} className="text-xs text-azure-400 underline underline-offset-4">
                              {t("pages.community.moderation.open")}
                            </Link>
                          )}
                        </div>
                        {e.title && <p className="font-semibold text-chalk-100">{e.title}</p>}
                        {!e.deleted && <p className="whitespace-pre-line break-words text-sm text-chalk-300">{plainText(e.body, 600) || "-"}</p>}
                        {e.snapshot && (e.deleted || e.snapshot !== (e.kind === "thread" ? `${e.title}\n\n${e.body}` : e.body)) && (
                          <div className="border-l-2 border-gold-500/50 pl-3">
                            <p className="text-xs font-semibold text-gold-400">{t("pages.community.moderation.asReported")}</p>
                            <p className="mt-1 whitespace-pre-line break-words text-sm text-chalk-300">{[...e.snapshot].slice(0, 1500).join("")}</p>
                          </div>
                        )}
                        <ul className="space-y-1 text-xs text-chalk-400">
                          {e.reports.map((r, i) => (
                            <li key={i}>
                              <span className="font-semibold text-chalk-300">{t(`pages.communityUI.report.reasons.${r.reason}`)}</span>
                              {" · "}
                              {ago(locale, r.createdAt, now)}
                              {r.note && <span className="break-words"> · « {r.note} »</span>}
                            </li>
                          ))}
                        </ul>
                        <ModerationActions
                          kind={e.kind}
                          id={e.id}
                          hidden={e.hidden}
                          locked={e.threadLocked}
                          pinned={e.threadPinned}
                          authorBanned={e.authorBanned}
                          reported
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="banned-title">
                <h2 id="banned-title" className={sectionTitle}>
                  {t("pages.community.moderation.bannedTitle", { n: data[1].length })}
                </h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                {data[1].length === 0 ? (
                  <p className="mt-5 text-sm text-chalk-400">{t("pages.community.moderation.bannedEmpty")}</p>
                ) : (
                  <ul className="mt-5 divide-y divide-night-800 border-y border-night-800">
                    {data[1].map((m) => (
                      <li key={m.accountId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <span className="min-w-0 text-chalk-300">
                          <span className="font-semibold text-chalk-100">{m.name}</span>
                          {" · "}
                          {m.banUntil
                            ? t("pages.community.moderation.until", { date: m.banUntil.toLocaleDateString(LOCALE_INTL[locale]) })
                            : t("pages.community.moderation.forever")}
                          {m.banReason && <span className="break-words"> · {m.banReason}</span>}
                        </span>
                        <UnbanButton accountId={m.accountId} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="log-title">
                <h2 id="log-title" className={sectionTitle}>
                  {t("pages.community.moderation.logTitle")}
                </h2>
                <div aria-hidden className="gold-rule mt-2 h-0.5 w-16" />
                {data[2].length === 0 ? (
                  <p className="mt-5 text-sm text-chalk-400">{t("pages.community.moderation.logEmpty")}</p>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-chalk-500">
                        <tr>
                          <th scope="col" className="py-2 pr-4 font-semibold">{t("pages.community.moderation.when")}</th>
                          <th scope="col" className="py-2 pr-4 font-semibold">{t("pages.community.moderation.who")}</th>
                          <th scope="col" className="py-2 pr-4 font-semibold">{t("pages.community.moderation.what")}</th>
                          <th scope="col" className="py-2 font-semibold">{t("pages.community.moderation.note")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-night-800 text-chalk-300">
                        {data[2].map((l) => (
                          <tr key={l.id}>
                            <td className="py-2 pr-4 whitespace-nowrap text-chalk-500">{ago(locale, l.createdAt, now)}</td>
                            <td className="py-2 pr-4">{l.moderatorName}</td>
                            <td className="py-2 pr-4">
                              {t(`pages.community.moderation.actions.${l.action}`)}
                              {l.kind && l.targetId ? ` · ${t(`pages.community.moderation.kinds.${l.kind}`)} #${l.targetId}` : ""}
                            </td>
                            <td className="break-words py-2 text-chalk-400">{l.note ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </ExtendMessages>
    </>
  );
}
