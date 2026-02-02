/*
  Warnings:

  - You are about to drop the column `role` on the `locations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "number_of_days" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rejection_reason" TEXT;

-- AlterTable
ALTER TABLE "locations" DROP COLUMN "role",
ADD COLUMN     "delete_reason" TEXT;

-- CreateTable
CREATE TABLE "late_requests" (
    "late_request_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "attendance_id" INTEGER,
    "request_date" DATE NOT NULL,
    "scheduled_time" TEXT NOT NULL,
    "actual_time" TEXT NOT NULL,
    "late_minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "attachment_url" TEXT,
    "approved_by_user_id" INTEGER,
    "admin_comment" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_requests_pkey" PRIMARY KEY ("late_request_id")
);

-- AddForeignKey
ALTER TABLE "late_requests" ADD CONSTRAINT "late_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_requests" ADD CONSTRAINT "late_requests_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
