-- Split emergent_name into emergent_first_name and emergent_last_name
-- Add new columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergent_first_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emergent_last_name" TEXT;

-- Migrate data: split emergent_name by space
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'emergent_name'
  ) THEN
    UPDATE "users"
    SET
      "emergent_first_name" = CASE
        WHEN position(' ' IN "emergent_name") > 0 THEN substring("emergent_name" FROM 1 FOR position(' ' IN "emergent_name") - 1)
        ELSE "emergent_name"
      END,
      "emergent_last_name" = CASE
        WHEN position(' ' IN "emergent_name") > 0 THEN substring("emergent_name" FROM position(' ' IN "emergent_name") + 1)
        ELSE ''
      END
    WHERE "emergent_name" IS NOT NULL;
  END IF;
END $$;

-- Set NOT NULL constraints after data migration
ALTER TABLE "users" ALTER COLUMN "emergent_first_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "emergent_last_name" SET NOT NULL;

-- Drop old column
ALTER TABLE "users" DROP COLUMN IF EXISTS "emergent_name";
