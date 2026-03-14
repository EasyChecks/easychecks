-- Add hourly leave support fields
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS is_hourly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT,
  ADD COLUMN IF NOT EXISTS leave_hours DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_leave_requests_hourly_approved
  ON leave_requests (user_id, status, start_date)
  WHERE deleted_at IS NULL AND is_hourly = false;
