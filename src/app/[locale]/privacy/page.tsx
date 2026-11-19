import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { Prose } from "@/components/prose";
import type { Locale } from "@/i18n/config";
import { createT } from "@/i18n/translations";
import { metaPage } from "@/i18n/seo";
import Link from "@/components/link";
import { inlineProse } from "@/components/prose";
import { ConsentSettingsButton } from "@/components/consent-banner";
import { botPublished } from "@/lib/bot/public";
import { CONSENT_KEY } from "@/lib/consent";
import { legal } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.privacy.title"),
    description: t("pages.privacy.metaDescription"),
    path: "/privacy",
  });
}

/**
 * The privacy notice (GDPR articles 13 and 14), kept accurate to the code:
 * every cookie and storage key named here is one the site sets
 * (`lib/session.ts`, `lib/bot/session.ts`, `proxy.ts`, `lib/consent.ts`,
 * Matomo's own), and every retention period is what the code does. Changing
 * one means changing the other.
 *
 * The cookies section has a fixed anchor, `#cookies`, whatever the language:
 * the consent banner links to it.
 */
const COOKIES: { name: string; key: string; by: "site" | "matomo"; consent: "no" | "yes" | "after" }[] = [
  { name: "langue", key: "langue", by: "site", consent: "no" },
  { name: "mlbb_jeu", key: "game", by: "site", consent: "no" },
  { name: "mlbbdex_discord", key: "discord", by: "site", consent: "no" },
  { name: "mlbbdex_discord_oauth", key: "discordOauth", by: "site", consent: "no" },
  { name: "_pk_id.*", key: "pkId", by: "matomo", consent: "yes" },
  { name: "_pk_ses.*", key: "pkSes", by: "matomo", consent: "yes" },
  { name: "_pk_ref.*", key: "pkRef", by: "matomo", consent: "yes" },
  { name: "_pk_testcookie*", key: "pkTest", by: "matomo", consent: "yes" },
  { name: "mtm_cookie_consent", key: "mtmConsent", by: "matomo", consent: "after" },
];

const STORAGE: { keys: string[]; key: string }[] = [
  { keys: [CONSENT_KEY], key: "consent" },
  { keys: ["mlbb_favoris"], key: "favourites" },
  { keys: ["mlbb_push"], key: "push" },
  { keys: ["mlbbdex:collection", "mlbbdex:collection-sync"], key: "collection" },
  { keys: ["mlbb_discord_popup", "mlbb_discord_popup_session"], key: "popup" },
  { keys: ["mlbbdle_*", "mlbb_quiz_*"], key: "games" },
  { keys: ["mlbb_tier_liste", "mlbb_tier_precedente"], key: "tierList" },
  { keys: ["mlbb_timer_match", "mlbb_timer_settings"], key: "timer" },
  { keys: ["mlbb_chatiment"], key: "retribution" },
];

const RETENTION = ["audience", "sessions", "community", "builds", "collection", "dataReports", "push", "bot", "profileCard", "logs", "backups", "rateLimits"];
const RECIPIENTS = ["host", "matomo", "discord", "moonton", "push", "votes"];

export default async function PrivacyPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const vars = {
    contact: legal.contact,
    host: legal.host,
    hostSite: legal.hostSite,
    analyticsHost: legal.analyticsHost,
    analyticsHostSite: legal.analyticsHostSite,
  };
  const g = (key: string) => inlineProse(t(`prose.gdpr.${key}`), vars, key);

  return (
    <>
      <PageHeader title={t("pages.privacy.title")} lead={t("pages.privacy.lead")} />
      <Prose
        locale={locale}
        messageKey="privacy"
        variables={{ contact: legal.contact, publisher: legal.publisher }}
        extraToc={[
          { title: t("prose.gdpr.cookies.title"), anchor: "cookies" },
          { title: t("prose.gdpr.storage.title"), anchor: "browser-storage" },
          { title: t("prose.gdpr.audience.title"), anchor: "audience-measurement" },
          { title: t("prose.gdpr.game.title"), anchor: "game-account" },
          { title: t("prose.push.title"), anchor: "notifications-push" },
          { title: t("prose.community.title"), anchor: "community" },
          { title: t("prose.collection.title"), anchor: "skin-collection" },
          { title: t("prose.dataReports.title"), anchor: "error-reports" },
          ...(botPublished() ? [{ title: t("prose.bot.title"), anchor: "discord-bot" }] : []),
          { title: t("prose.gdpr.thirdParty.title"), anchor: "third-party" },
          { title: t("prose.gdpr.recipients.title"), anchor: "recipients" },
          { title: t("prose.gdpr.transfers.title"), anchor: "transfers" },
          { title: t("prose.gdpr.retention.title"), anchor: "retention" },
          { title: t("prose.gdpr.rights.title"), anchor: "rights" },
        ]}
      >
        <h2 id="cookies" className="scroll-mt-24">{t("prose.gdpr.cookies.title")}</h2>
        <p>{t("prose.gdpr.cookies.intro")}</p>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("prose.gdpr.cookies.head.name")}</th>
              <th scope="col">{t("prose.gdpr.cookies.head.purpose")}</th>
              <th scope="col">{t("prose.gdpr.cookies.head.duration")}</th>
              <th scope="col">{t("prose.gdpr.cookies.head.by")}</th>
              <th scope="col">{t("prose.gdpr.cookies.head.consent")}</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((c) => (
              <tr key={c.name}>
                <th scope="row">
                  <code>{c.name}</code>
                </th>
                <td>{t(`prose.gdpr.cookies.${c.key}.purpose`)}</td>
                <td>{t(`prose.gdpr.cookies.${c.key}.duration`)}</td>
                <td>{t(c.by === "site" ? "prose.gdpr.cookies.site" : "prose.gdpr.cookies.matomo")}</td>
                <td>
                  {t(
                    c.consent === "no"
                      ? "prose.gdpr.cookies.no"
                      : c.consent === "yes"
                        ? "prose.gdpr.cookies.consentYes"
                        : "prose.gdpr.cookies.consentAfter",
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{t("prose.gdpr.cookies.without")}</p>
        <p>{g("cookies.choice")}</p>
        <p>
          <ConsentSettingsButton className="bevel-sm border border-gold-500/60 bg-night-800 px-4 py-2 text-sm font-semibold text-chalk-100 transition-colors hover:bg-night-700" />
        </p>

        <h2 id="browser-storage">{t("prose.gdpr.storage.title")}</h2>
        <p>{g("storage.intro")}</p>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("prose.gdpr.storage.head.key")}</th>
              <th scope="col">{t("prose.gdpr.storage.head.content")}</th>
            </tr>
          </thead>
          <tbody>
            {STORAGE.map((s) => (
              <tr key={s.key}>
                <th scope="row">
                  {s.keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && <br />}
                      <code>{k}</code>
                    </span>
                  ))}
                </th>
                <td>{t(`prose.gdpr.storage.${s.key}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{t("prose.gdpr.storage.cache")}</p>

        <h2 id="audience-measurement">{t("prose.gdpr.audience.title")}</h2>
        <p>{g("audience.tool")}</p>
        <p>{g("audience.data")}</p>
        <p>{g("audience.cookieless")}</p>
        <p>{g("audience.retention")}</p>
        <p>{g("audience.api")}</p>
        <p>{g("audience.object")}</p>

        <h2 id="game-account">{t("prose.gdpr.game.title")}</h2>
        <p>{g("game.text")}</p>

        {/*
          Patch notifications: kept by the server, only on request. Always
          described: the page is generated at build time, which does not
          know whether the VAPID keys will be set.
        */}
        <h2 id="notifications-push">{t("prose.push.title")}</h2>
        <p>{t("prose.push.intro")}</p>
        <ul>
          <li>{t("prose.push.endpoint")}</li>
          <li>{t("prose.push.language")}</li>
          <li>{t("prose.push.favourites")}</li>
        </ul>
        <p>{t("prose.push.usage")}</p>
        <p>{t("prose.push.unsubscribe")}</p>
        {/* Community (forum, votes, reports, teammate cards): kept in the database. */}
        <h2 id="community">{t("prose.community.title")}</h2>
        <p>{t("prose.community.intro")}</p>
        <ul>
          <li>{t("prose.community.account")}</li>
          <li>{inlineProse(t("prose.community.discord"))}</li>
          <li>{t("prose.community.posts")}</li>
          <li>{t("prose.community.card")}</li>
        </ul>
        <p>{t("prose.community.pseudonymous")}</p>
        <p>{t("prose.community.moderation")}</p>
        <p>{t("prose.community.deletion", { contact: legal.contact })}</p>
        {/* Skin collection: in the browser, and on the account when signed in. */}
        <h2 id="skin-collection">{t("prose.collection.title")}</h2>
        <p>{t("prose.collection.intro")}</p>
        <ul>
          <li>{t("prose.collection.data")}</li>
        </ul>
        <p>{t("prose.collection.usage")}</p>
        <p>{t("prose.collection.deletion", { contact: legal.contact })}</p>
        {/* Error reports on the data pages: anonymous, kept in the database. */}
        <h2 id="error-reports">{t("prose.dataReports.title")}</h2>
        <p>{t("prose.dataReports.text")}</p>
        <p>{t("prose.dataReports.usage")}</p>
        {/* Discord bot: described when it is deployed (its id is known at build time). */}
        {botPublished() && (
          <>
            <h2 id="discord-bot">{t("prose.bot.title")}</h2>
            <p>{t("prose.bot.intro")}</p>
            <ul>
              <li>{inlineProse(t("prose.bot.cookie"))}</li>
              <li>{t("prose.bot.servers")}</li>
              <li>{t("prose.bot.profile")}</li>
              <li>{t("prose.bot.results")}</li>
            </ul>
            <p>{t("prose.bot.members")}</p>
            <p>
              <Link href="/bot/privacy">{t("prose.bot.details")}</Link>
            </p>
          </>
        )}

        <h2 id="third-party">{t("prose.gdpr.thirdParty.title")}</h2>
        <p>{g("thirdParty.text")}</p>

        <h2 id="recipients">{t("prose.gdpr.recipients.title")}</h2>
        <p>{t("prose.gdpr.recipients.intro")}</p>
        <ul>
          {RECIPIENTS.map((r) => (
            <li key={r}>{g(`recipients.${r}`)}</li>
          ))}
        </ul>

        <h2 id="transfers">{t("prose.gdpr.transfers.title")}</h2>
        <p>{g("transfers.text")}</p>

        <h2 id="retention">{t("prose.gdpr.retention.title")}</h2>
        <ul>
          {RETENTION.map((r) => (
            <li key={r}>{g(`retention.${r}`)}</li>
          ))}
        </ul>

        <h2 id="rights">{t("prose.gdpr.rights.title")}</h2>
        <p>{t("prose.gdpr.rights.list")}</p>
        <p>{t("prose.gdpr.rights.browser")}</p>
        <p>{g("rights.contact")}</p>
        <p>{g("rights.cnil")}</p>
        <p className="text-sm text-chalk-500">{t("prose.gdpr.rights.updated")}</p>
      </Prose>
    </>
  );
}
