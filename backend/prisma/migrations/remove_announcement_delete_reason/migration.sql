-- AlterTable: Remove delete_reason column from announcements
ALTER TABLE "announcements" DROP COLUMN IF EXISTS "delete_reason";
