-- CreateTable
CREATE TABLE "CommunityMember" (
    "accountId" VARCHAR(24) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannedAt" TIMESTAMP(3),
    "banUntil" TIMESTAMP(3),
    "banReason" VARCHAR(300),
    "bannedBy" VARCHAR(20),
    "cardHiddenAt" TIMESTAMP(3),

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "ForumThread" (
    "id" SERIAL NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "heroes" VARCHAR(40)[] DEFAULT ARRAY[]::VARCHAR(40)[],
    "authorId" VARCHAR(24) NOT NULL,
    "authorName" VARCHAR(40) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "hiddenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "lastPostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPost" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" VARCHAR(24) NOT NULL,
    "authorName" VARCHAR(40) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumVote" (
    "kind" VARCHAR(8) NOT NULL,
    "targetId" INTEGER NOT NULL,
    "voterId" VARCHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumVote_pkey" PRIMARY KEY ("kind","targetId","voterId")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" SERIAL NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reporterId" VARCHAR(24) NOT NULL,
    "authorId" VARCHAR(24) NOT NULL,
    "reason" VARCHAR(16) NOT NULL,
    "note" VARCHAR(300),
    "snapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" VARCHAR(20),

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" SERIAL NOT NULL,
    "moderatorId" VARCHAR(20) NOT NULL,
    "moderatorName" VARCHAR(64) NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "kind" VARCHAR(8),
    "targetId" INTEGER,
    "accountId" VARCHAR(24),
    "note" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeammateCard" (
    "id" SERIAL NOT NULL,
    "accountId" VARCHAR(24) NOT NULL,
    "authorName" VARCHAR(40) NOT NULL,
    "region" VARCHAR(12) NOT NULL,
    "rank" VARCHAR(20) NOT NULL,
    "lanes" VARCHAR(8)[] DEFAULT ARRAY[]::VARCHAR(8)[],
    "heroes" VARCHAR(40)[] DEFAULT ARRAY[]::VARCHAR(40)[],
    "languages" VARCHAR(4)[] DEFAULT ARRAY[]::VARCHAR(4)[],
    "playTimes" VARCHAR(12)[] DEFAULT ARRAY[]::VARCHAR(12)[],
    "note" VARCHAR(200),
    "gameId" VARCHAR(24),
    "discord" VARCHAR(40),
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeammateCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityMember_bannedAt_idx" ON "CommunityMember"("bannedAt");

-- CreateIndex
CREATE INDEX "ForumThread_category_pinned_lastPostAt_idx" ON "ForumThread"("category", "pinned", "lastPostAt");

-- CreateIndex
CREATE INDEX "ForumThread_category_pinned_score_idx" ON "ForumThread"("category", "pinned", "score");

-- CreateIndex
CREATE INDEX "ForumThread_lastPostAt_idx" ON "ForumThread"("lastPostAt");

-- CreateIndex
CREATE INDEX "ForumThread_authorId_createdAt_idx" ON "ForumThread"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_threadId_createdAt_idx" ON "ForumPost"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ForumPost_authorId_createdAt_idx" ON "ForumPost"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_resolvedAt_createdAt_idx" ON "CommunityReport"("resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_resolvedAt_kind_targetId_idx" ON "CommunityReport"("resolvedAt", "kind", "targetId");

-- CreateIndex
CREATE INDEX "CommunityReport_reporterId_resolvedAt_idx" ON "CommunityReport"("reporterId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReport_kind_targetId_reporterId_key" ON "CommunityReport"("kind", "targetId", "reporterId");

-- CreateIndex
CREATE INDEX "ModerationLog_createdAt_idx" ON "ModerationLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeammateCard_accountId_key" ON "TeammateCard"("accountId");

-- CreateIndex
CREATE INDEX "TeammateCard_expiresAt_idx" ON "TeammateCard"("expiresAt");

-- AddForeignKey
ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Forum search (Postgres full text, the language-neutral "simple" configuration:
-- the forum mixes five languages). Not expressible in the Prisma schema: the
-- queries in src/lib/community/store.ts use these exact expressions.
CREATE INDEX "ForumThread_search_idx" ON "ForumThread" USING GIN (to_tsvector('simple', "title" || ' ' || "body"));
CREATE INDEX "ForumPost_search_idx" ON "ForumPost" USING GIN (to_tsvector('simple', "body"));
