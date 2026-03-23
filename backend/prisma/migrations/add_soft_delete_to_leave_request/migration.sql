-- AddColumn deleted_at to leave_requests
ALTER TABLE "leave_requests" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Create index for soft delete queries
CREATE INDEX "leave_requests_deleted_at_idx" ON "leave_requests"("deleted_at");
CREATE INDEX "leave_requests_user_id_status_deleted_at_idx" ON "leave_requests"("user_id", "status", "deleted_at");
