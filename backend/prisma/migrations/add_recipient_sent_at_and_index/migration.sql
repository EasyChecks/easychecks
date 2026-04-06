-- Add sent_at column to announcement_recipients
ALTER TABLE "announcement_recipients" ADD COLUMN "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add index on announcement_id for faster JOIN queries
CREATE INDEX "announcement_recipients_announcement_id_idx" ON "announcement_recipients"("announcement_id");
