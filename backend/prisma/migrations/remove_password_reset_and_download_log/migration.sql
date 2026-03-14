-- Remove legacy tables no longer used in application code
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS download_logs CASCADE;

-- Attendance: move soft-delete to is_deleted and remove legacy columns
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE attendance
  DROP COLUMN IF EXISTS deleted_at CASCADE,
  DROP COLUMN IF EXISTS deleted_by_user_id CASCADE,
  DROP COLUMN IF EXISTS created_at CASCADE;

-- Shift: remove legacy audit columns and add is_deleted soft-delete marker
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE shifts
  DROP COLUMN IF EXISTS created_at CASCADE,
  DROP COLUMN IF EXISTS updated_at CASCADE,
  DROP COLUMN IF EXISTS created_by_user_id CASCADE,
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE,
  DROP COLUMN IF EXISTS deleted_at CASCADE,
  DROP COLUMN IF EXISTS deleted_by_user_id CASCADE;

-- Helpful indexes for common filtering paths
CREATE INDEX IF NOT EXISTS idx_attendance_user_checkin_not_deleted
  ON attendance (user_id, check_in)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_shifts_user_active_not_deleted
  ON shifts (user_id, is_active)
  WHERE is_deleted = false;
