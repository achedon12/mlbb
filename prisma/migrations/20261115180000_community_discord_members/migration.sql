-- Community members signing in with Discord (docs/community.md): the kind of
-- login, and the link from a Discord member to the game account it acts as.
-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN     "linkedAt" TIMESTAMP(3),
ADD COLUMN     "linkedTo" VARCHAR(24),
ADD COLUMN     "provider" VARCHAR(8) NOT NULL DEFAULT 'game';

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_linkedTo_key" ON "CommunityMember"("linkedTo");
