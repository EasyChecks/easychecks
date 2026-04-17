DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'LeaveQuotaScope'
  ) THEN
    CREATE TYPE "LeaveQuotaScope" AS ENUM ('GLOBAL', 'BRANCH', 'DEPARTMENT', 'USER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS leave_quota_overrides (
  override_id SERIAL PRIMARY KEY,
  scope "LeaveQuotaScope" NOT NULL,
  leave_type "LeaveType" NOT NULL,
  target_key TEXT NOT NULL,
  branch_code TEXT,
  department TEXT,
  user_id INTEGER,
  max_paid_days_per_year INTEGER,
  max_days_per_year INTEGER,
  max_days_total INTEGER,
  paid BOOLEAN,
  require_document BOOLEAN,
  document_after_days INTEGER,
  created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_quota_overrides_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leave_quota_overrides_scope
  ON leave_quota_overrides (scope);
CREATE INDEX IF NOT EXISTS idx_leave_quota_overrides_scope_branch
  ON leave_quota_overrides (scope, branch_code);
CREATE INDEX IF NOT EXISTS idx_leave_quota_overrides_scope_department
  ON leave_quota_overrides (scope, department);
CREATE INDEX IF NOT EXISTS idx_leave_quota_overrides_scope_user
  ON leave_quota_overrides (scope, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_quota_overrides_unique
  ON leave_quota_overrides (scope, leave_type, target_key);
