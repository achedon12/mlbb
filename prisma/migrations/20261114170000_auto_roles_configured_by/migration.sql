-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "autoRoleFailReason" VARCHAR(16),
ADD COLUMN     "autoRolesConfiguredBy" VARCHAR(20);

