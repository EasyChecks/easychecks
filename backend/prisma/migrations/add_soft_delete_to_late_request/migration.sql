-- AddColumn deleted_at to late_requests
ALTER TABLE "late_requests" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Create index for soft delete queries
CREATE INDEX "late_requests_deleted_at_idx" ON "late_requests"("deleted_at");
CREATE INDEX "late_requests_user_id_deleted_at_idx" ON "late_requests"("user_id", "deleted_at");
