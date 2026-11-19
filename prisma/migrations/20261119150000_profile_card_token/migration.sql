-- The player's game token, sealed (AES-256-GCM), so the bot's /profile can
-- read fresh figures. Null once expired or never given; deleted with the card.
-- AlterTable
ALTER TABLE "ProfileCard" ADD COLUMN "token" TEXT;
