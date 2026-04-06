-- Add timestamp columns to announcements
ALTER TABLE "announcements" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "announcements" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "announcements" ADD COLUMN "sent_at" TIMESTAMP(3);

-- Backfill: set created_at/updated_at for existing rows to current timestamp (already defaulted above)
