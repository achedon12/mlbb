import { Lock, Pin, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Composer } from "@/components/community/composer";
import { ModerationActions } from "@/components/community/moderation-actions";
import { ago, HeroTags, heroOptions, isoDate, Unavailable } from "@/components/community/parts";
import { PostShell } from "@/components/community/post-shell";
import Link from "@/components/link";
import { Pager } from "@/components/pager";
import { PageHeader } from "@/components/ui";
import { LOCALE_HTML, type Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { currentPlayer } from "@/lib/community-builds-server";
import {
  canDelete,
  canEdit,
  isCategory,
  readPageNumber,
  REPLIES_PER_PAGE,
  threadIdOf,
  threadPath,
  threadSegment,
} from "@/lib/community/constants";
import { plainText, renderMarkdown } from "@/lib/community/markdown";
import { currentModerator, requestTime } from "@/lib/community/server";
import { getThread, listReplies, votedBy, type Thread } from "@/lib/community/store";
import { databaseConfigured } from "@/lib/db";
import { serializeJsonLd } from "@/lib/html";
import { paging } from "@/lib/pager";
import { site } from "@/lib/site";

/**
 * One thread: the opening post, its replies thirty a page, the reply form.
 * Server-rendered and indexable, with its `DiscussionForumPosting`
 * structured data (the replies of the page as comments). A hidden thread
 * is only shown to moderators; a deleted one is gone.
 */
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ locale: Locale; category: string; thread: string }>;
  searchParams: Promise<{ page?: string }>;
};

/** The thread, null when it does not exist (or no longer), undefined when the database fails. */
async function load(segment: string): Promise<Thread | null | undefined> {
  const id = threadIdOf(segment);
  if (!id || !databaseConfigured()) return id ? undefined : null;
  const thread = await getThread(id).catch(() => undefined);
  return thread && thread.deletedAt ? null : thread;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { locale, thread: segment } = await params;
  const thread = await load(segment);
  if (!thread) return { robots: { index: false, follow: true } };
  const t = createT(locale);
  const page = readPageNumber((await searchParams).page);
  const meta = metaPage(locale, {
    title: t("pages.community.seo.threadTitle", { title: thread.title }),
    description: plainText(thread.body, 155),
    path: threadPath(thread),
    type: "article",
    published: thread.createdAt.toISOString(),
    author: thread.authorName,
  });
  if (thread.hiddenAt) return { ...meta, robots: { index: false, follow: false } };
  return page > 1 ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export default async function ThreadPage({ params, searchParams }: Params) {
  const { locale, category, thread: segment } = await params;
  const t = createT(locale);
  const thread = await load(segment);
  if (thread === null || !isCategory(category)) notFound();
  if (thread === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Unavailable t={t} />
      </div>
    );
  }
  const [player, moderator] = await Promise.all([currentPlayer().catch(() => ({ status: "unavailable" as const })), currentModerator()]);
  if (thread.hiddenAt && !moderator) notFound();
  if (thread.category !== category || threadSegment(thread) !== segment) permanentRedirect(`/${locale}${threadPath(thread)}`);

  const page = readPageNumber((await searchParams).page);
  const { posts, total } = await listReplies(thread.id, page);
  if (page > 1 && posts.length === 0) notFound();
  const view = paging(total, page, REPLIES_PER_PAGE);
  const viewer = player.status === "ok" ? player.id : null;
  const [threadVotes, postVotes] = await Promise.all([
    votedBy(viewer, "thread", [thread.id]),
    votedBy(viewer, "post", posts.map((p) => p.id)),
  ]);
  const now = await requestTime();
  const heroes = heroOptions();
  const path = threadPath(thread);
  const categoryName = t(`pages.community.categories.${thread.category}.name`);
  const ownThread = viewer === thread.authorId;
  const url = `${site.url}/${locale}${path}`;
  const shown = posts.filter((p) => !p.deletedAt && !p.hiddenAt);

  const data = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: thread.title,
    text: plainText(thread.body, 5000),
    url,
    mainEntityOfPage: url,
    datePublished: thread.createdAt.toISOString(),
    ...(thread.editedAt ? { dateModified: thread.editedAt.toISOString() } : {}),
    author: { "@type": "Person", name: thread.authorName },
    inLanguage: LOCALE_HTML[locale],
    isPartOf: { "@type": "WebPage", name: categoryName, url: `${site.url}/${locale}/community/${thread.category}` },
    ...(thread.heroes.length ? { about: thread.heroes.map((s) => ({ "@type": "Thing", name: heroes.find((h) => h.slug === s)?.name ?? s, url: `${site.url}/${locale}/heroes/${s}` })) } : {}),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: thread.score },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: thread.replyCount },
    ],
    comment: shown.map((p) => ({
      "@type": "Comment",
      text: plainText(p.body, 2000),
      datePublished: p.createdAt.toISOString(),
      author: { "@type": "Person", name: p.authorName },
      url: `${url}${page > 1 ? `?page=${page}` : ""}#post-${p.id}`,
      interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: p.score },
    })),
  };

  const byline = (name: string, created: Date, edited: Date | null) => (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-chalk-500">
      <span className="font-semibold text-chalk-300">{name}</span>
      <span aria-hidden>·</span>
      <time dateTime={isoDate(created)} title={created.toLocaleString(LOCALE_HTML[locale], { timeZone: "UTC" })}>
        {ago(locale, created, now)}
      </time>
      {edited && (
        <>
          <span aria-hidden>·</span>
          <span>{t("pages.community.edited")}</span>
        </>
      )}
    </p>
  );

  return (
    <>
      {!thread.hiddenAt && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />}
      <PageHeader
        title={thread.title}
        lead={t("pages.community.threadLead", { name: thread.authorName, category: categoryName })}
        crumbs={[
          { name: t("pages.community.title"), href: "/community" },
          { name: categoryName, href: `/community/${thread.category}` },
          { name: thread.title },
        ]}
        meta={[
          thread.pinned && (
            <span className="inline-flex items-center gap-1">
              <Pin size={12} aria-hidden />
              {t("pages.community.pinned")}
            </span>
          ),
          thread.locked && (
            <span className="inline-flex items-center gap-1">
              <Lock size={12} aria-hidden />
              {t("pages.community.locked")}
            </span>
          ),
          t("pages.community.replies", { n: thread.replyCount }),
        ]}
      />
      <ExtendMessages messages={messagesPage(locale, ["pages.communityUI"])}>
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 *:max-w-3xl">
          {moderator && (
            <section aria-label={t("pages.community.moderationBar")} className="bevel space-y-2 border border-gold-500/40 bg-gold-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-gold-400">
                <ShieldAlert size={16} aria-hidden />
                {thread.hiddenAt ? t("pages.community.hiddenForModerators") : t("pages.community.moderationBar")}
              </p>
              <ModerationActions kind="thread" id={thread.id} hidden={Boolean(thread.hiddenAt)} locked={thread.locked} pinned={thread.pinned} authorBanned={false} reported={false} />
            </section>
          )}

          <article aria-labelledby="thread-body" className="space-y-4">
            <h2 id="thread-body" className="sr-only">
              {t("pages.community.openingPost")}
            </h2>
            {byline(thread.authorName, thread.createdAt, thread.editedAt)}
            <HeroTags slugs={thread.heroes} />
            <PostShell
              kind="thread"
              id={thread.id}
              html={renderMarkdown(thread.body)}
              score={thread.score}
              voted={threadVotes.has(thread.id)}
              own={ownThread}
              signedIn={viewer !== null}
              edit={ownThread && canEdit(thread.createdAt, now) ? { body: thread.body, title: thread.title, heroes: thread.heroes } : null}
              deletable={canDelete(thread.createdAt, now)}
              afterDelete={`/community/${thread.category}`}
              heroes={heroes}
            />
          </article>

          <section aria-labelledby="replies-title" className="space-y-4">
            <h2 id="replies-title" className="font-heading text-lg font-bold text-chalk-100">
              {t("pages.community.replies", { n: thread.replyCount })}
            </h2>
            {posts.length === 0 ? (
              <p className="text-sm text-chalk-500">{t("pages.community.noReplies")}</p>
            ) : (
              <ol className="divide-y divide-night-800 border-y border-night-800">
                {posts.map((p) => {
                  const own = viewer === p.authorId;
                  const gone = p.deletedAt || (p.hiddenAt && !moderator);
                  return (
                    <li key={p.id} id={`post-${p.id}`} className="scroll-mt-24 py-4">
                      {gone ? (
                        <p className="text-sm italic text-chalk-500">{p.deletedAt ? t("pages.community.replyDeleted") : t("pages.community.replyHidden")}</p>
                      ) : (
                        <article className="space-y-2">
                          {byline(p.authorName, p.createdAt, p.editedAt)}
                          {p.hiddenAt && <p className="text-xs font-semibold text-gold-400">{t("pages.community.hiddenForModerators")}</p>}
                          <PostShell
                            kind="post"
                            id={p.id}
                            html={renderMarkdown(p.body)}
                            score={p.score}
                            voted={postVotes.has(p.id)}
                            own={own}
                            signedIn={viewer !== null}
                            edit={own && !thread.locked && canEdit(p.createdAt, now) ? { body: p.body } : null}
                            deletable={canDelete(p.createdAt, now)}
                            afterDelete={null}
                          />
                          {moderator && (
                            <details className="text-sm">
                              <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-gold-400">
                                {t("pages.community.moderate")}
                              </summary>
                              <div className="mt-2">
                                <ModerationActions kind="post" id={p.id} hidden={Boolean(p.hiddenAt)} authorBanned={false} reported={false} />
                              </div>
                            </details>
                          )}
                        </article>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            <Pager paging={view} href={(n) => (n > 1 ? `${path}?page=${n}` : path)} t={t} labelledBy="replies-title" />
          </section>

          <section aria-labelledby="reply-title" className="border-t border-night-800 pt-6">
            <h2 id="reply-title" className="font-heading text-lg font-bold text-chalk-100">
              {t("pages.community.replyTitle")}
            </h2>
            <div className="mt-4">
              {thread.locked ? (
                <p className="flex items-center gap-2 text-sm text-chalk-400">
                  <Lock size={15} aria-hidden />
                  {t("pages.community.lockedNotice")}
                </p>
              ) : player.status === "ok" ? (
                <>
                  <p className="mb-3 text-xs text-chalk-500">{t("pages.community.postingAs", { name: player.name })}</p>
                  <Composer mode={{ type: "reply", threadId: thread.id, threadPath: path }} />
                </>
              ) : (
                <p className="text-sm text-chalk-300">
                  <Link href="/login" className="text-gold-400 underline underline-offset-4 hover:text-gold-500">
                    {t("pages.community.signIn")}
                  </Link>{" "}
                  {t("pages.community.signInToReply")}
                </p>
              )}
            </div>
          </section>

          <p>
            <Link href={`/community/${thread.category}`} className="inline-flex min-h-11 items-center text-sm text-chalk-300 underline underline-offset-4 hover:text-gold-400">
              {t("pages.community.backToCategory", { name: categoryName })}
            </Link>
          </p>
        </div>
      </ExtendMessages>
    </>
  );
}
