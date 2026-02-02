-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('OFFICE', 'BRANCH', 'EVENT', 'SITE', 'MEETING', 'OTHER');

-- AlterTable
ALTER TABLE "late_requests" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_user_id" INTEGER,
ADD COLUMN     "updated_by_user_id" INTEGER;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_user_id" INTEGER,
ADD COLUMN     "updated_by_user_id" INTEGER;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "address" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "location_type" "LocationType" NOT NULL DEFAULT 'OTHER',
ALTER COLUMN "radius" SET DEFAULT 100;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_requests" ADD CONSTRAINT "late_requests_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_requests" ADD CONSTRAINT "late_requests_deleted_by_user_id_fkey" FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
