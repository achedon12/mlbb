-- CreateTable
CREATE TABLE "RoleMenu" (
    "id" SERIAL NOT NULL,
    "guildId" VARCHAR(20) NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "mode" VARCHAR(8) NOT NULL DEFAULT 'single',
    "options" JSONB NOT NULL,
    "configuredBy" VARCHAR(20) NOT NULL,
    "messageId" VARCHAR(20),
    "messageChannelId" VARCHAR(20),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleMenu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleMenu_guildId_idx" ON "RoleMenu"("guildId");

-- AddForeignKey
ALTER TABLE "RoleMenu" ADD CONSTRAINT "RoleMenu_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

