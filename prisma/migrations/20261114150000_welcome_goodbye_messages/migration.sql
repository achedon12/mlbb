-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "goodbyeChannelId" VARCHAR(20),
ADD COLUMN     "goodbyeFailing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "goodbyeMessage" VARCHAR(500),
ADD COLUMN     "welcomeChannelId" VARCHAR(20),
ADD COLUMN     "welcomeFailing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "welcomeMessage" VARCHAR(500);

