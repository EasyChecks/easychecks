-- Create replacement approval history table before dropping approver columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalActionType') THEN
    CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVED', 'REJECTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS approval_actions (
  approval_action_id SERIAL PRIMARY KEY,
  leave_id INT NULL,
  late_request_id INT NULL,
  actor_user_id INT NOT NULL,
  action "ApprovalActionType" NOT NULL,
  admin_comment TEXT NULL,
  rejection_reason TEXT NULL,
  action_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT approval_actions_leave_id_fkey FOREIGN KEY (leave_id) REFERENCES leave_requests(leave_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT approval_actions_late_request_id_fkey FOREIGN KEY (late_request_id) REFERENCES late_requests(late_request_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT approval_actions_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS approval_actions_leave_id_action_at_idx
  ON approval_actions (leave_id, action_at DESC);

CREATE INDEX IF NOT EXISTS approval_actions_late_request_id_action_at_idx
  ON approval_actions (late_request_id, action_at DESC);

CREATE INDEX IF NOT EXISTS approval_actions_actor_user_id_idx
  ON approval_actions (actor_user_id);

-- Backfill leave approver history
INSERT INTO approval_actions (
  leave_id,
  actor_user_id,
  action,
  admin_comment,
  rejection_reason,
  action_at,
  created_at
)
SELECT
  lr.leave_id,
  lr.approved_by_user_id,
  CASE
    WHEN lr.status = 'REJECTED' THEN 'REJECTED'::"ApprovalActionType"
    ELSE 'APPROVED'::"ApprovalActionType"
  END,
  lr.admin_comment,
  lr.rejection_reason,
  COALESCE(lr.approved_at, lr.updated_at, lr.created_at),
  NOW()
FROM leave_requests lr
WHERE lr.approved_by_user_id IS NOT NULL
  AND lr.status IN ('APPROVED', 'REJECTED')
ON CONFLICT DO NOTHING;

-- Backfill late approver history
INSERT INTO approval_actions (
  late_request_id,
  actor_user_id,
  action,
  admin_comment,
  rejection_reason,
  action_at,
  created_at
)
SELECT
  ltr.late_request_id,
  ltr.approved_by_user_id,
  CASE
    WHEN ltr.status = 'REJECTED' THEN 'REJECTED'::"ApprovalActionType"
    ELSE 'APPROVED'::"ApprovalActionType"
  END,
  ltr.admin_comment,
  ltr.rejection_reason,
  COALESCE(ltr.approved_at, ltr.updated_at, ltr.created_at),
  NOW()
FROM late_requests ltr
WHERE ltr.approved_by_user_id IS NOT NULL
  AND ltr.status IN ('APPROVED', 'REJECTED')
ON CONFLICT DO NOTHING;

-- Remove by-user columns as requested
ALTER TABLE users
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE;

ALTER TABLE branches
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE,
  DROP COLUMN IF EXISTS deleted_by_user_id CASCADE;

ALTER TABLE locations
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE,
  DROP COLUMN IF EXISTS deleted_by_user_id CASCADE;

ALTER TABLE events
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE,
  DROP COLUMN IF EXISTS deleted_by_user_id CASCADE;

ALTER TABLE leave_requests
  DROP COLUMN IF EXISTS approved_by_user_id CASCADE,
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE,
  DROP COLUMN IF EXISTS deleted_by_user_id CASCADE;

ALTER TABLE late_requests
  DROP COLUMN IF EXISTS approved_by_user_id CASCADE,
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE,
  DROP COLUMN IF EXISTS deleted_by_user_id CASCADE;

ALTER TABLE announcements
  DROP COLUMN IF EXISTS updated_by_user_id CASCADE;
