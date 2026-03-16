-- Remove non-auth timestamp columns from domain tables.
-- Keep users/sessions auth timestamps and audit_logs.created_on for traceability.

ALTER TABLE branches DROP COLUMN IF EXISTS created_on;
ALTER TABLE branches DROP COLUMN IF EXISTS updated_on;
ALTER TABLE branches DROP COLUMN IF EXISTS deleted_on;
ALTER TABLE branches DROP COLUMN IF EXISTS created_at;
ALTER TABLE branches DROP COLUMN IF EXISTS updated_at;
ALTER TABLE branches DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE leave_requests DROP COLUMN IF EXISTS created_on;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS updated_on;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS approved_on;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS deleted_on;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS created_at;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS updated_at;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS approved_at;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE notifications DROP COLUMN IF EXISTS created_on;
ALTER TABLE notifications DROP COLUMN IF EXISTS created_at;

ALTER TABLE locations DROP COLUMN IF EXISTS created_on;
ALTER TABLE locations DROP COLUMN IF EXISTS updated_on;
ALTER TABLE locations DROP COLUMN IF EXISTS deleted_on;
ALTER TABLE locations DROP COLUMN IF EXISTS created_at;
ALTER TABLE locations DROP COLUMN IF EXISTS updated_at;
ALTER TABLE locations DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE event_participants DROP COLUMN IF EXISTS created_on;
ALTER TABLE event_participants DROP COLUMN IF EXISTS created_at;

ALTER TABLE events DROP COLUMN IF EXISTS created_on;
ALTER TABLE events DROP COLUMN IF EXISTS updated_on;
ALTER TABLE events DROP COLUMN IF EXISTS deleted_on;
ALTER TABLE events DROP COLUMN IF EXISTS created_at;
ALTER TABLE events DROP COLUMN IF EXISTS updated_at;
ALTER TABLE events DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE late_requests DROP COLUMN IF EXISTS created_on;
ALTER TABLE late_requests DROP COLUMN IF EXISTS updated_on;
ALTER TABLE late_requests DROP COLUMN IF EXISTS approved_on;
ALTER TABLE late_requests DROP COLUMN IF EXISTS deleted_on;
ALTER TABLE late_requests DROP COLUMN IF EXISTS created_at;
ALTER TABLE late_requests DROP COLUMN IF EXISTS updated_at;
ALTER TABLE late_requests DROP COLUMN IF EXISTS approved_at;
ALTER TABLE late_requests DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE approval_actions DROP COLUMN IF EXISTS action_on;
ALTER TABLE approval_actions DROP COLUMN IF EXISTS created_on;
ALTER TABLE approval_actions DROP COLUMN IF EXISTS action_at;
ALTER TABLE approval_actions DROP COLUMN IF EXISTS created_at;

ALTER TABLE announcements DROP COLUMN IF EXISTS created_on;
ALTER TABLE announcements DROP COLUMN IF EXISTS updated_on;
ALTER TABLE announcements DROP COLUMN IF EXISTS sent_on;
ALTER TABLE announcements DROP COLUMN IF EXISTS deleted_on;
ALTER TABLE announcements DROP COLUMN IF EXISTS created_at;
ALTER TABLE announcements DROP COLUMN IF EXISTS updated_at;
ALTER TABLE announcements DROP COLUMN IF EXISTS sent_at;
ALTER TABLE announcements DROP COLUMN IF EXISTS deleted_at;

ALTER TABLE announcement_recipients DROP COLUMN IF EXISTS sent_on;
ALTER TABLE announcement_recipients DROP COLUMN IF EXISTS created_on;
ALTER TABLE announcement_recipients DROP COLUMN IF EXISTS sent_at;
ALTER TABLE announcement_recipients DROP COLUMN IF EXISTS created_at;
