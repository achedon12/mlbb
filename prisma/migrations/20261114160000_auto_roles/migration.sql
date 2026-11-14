-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "autoRoleFailing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRoleIds" VARCHAR(20)[] DEFAULT ARRAY[]::VARCHAR(20)[],
ADD COLUMN     "botAutoRoleIds" VARCHAR(20)[] DEFAULT ARRAY[]::VARCHAR(20)[];

