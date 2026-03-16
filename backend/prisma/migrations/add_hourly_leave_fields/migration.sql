-- Add hourly leave support fields
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS is_hourly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT,
  ADD COLUMN IF NOT EXISTS leave_hours DOUBLE PRECISION;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'leave_requests'
      AND column_name = 'deleted_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_leave_requests_hourly_approved ON leave_requests (user_id, status, start_date) WHERE deleted_at IS NULL AND is_hourly = false';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_leave_requests_hourly_approved ON leave_requests (user_id, status, start_date) WHERE is_hourly = false';
  END IF;
END $$;
