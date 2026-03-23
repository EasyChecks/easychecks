-- Rename timestamp columns from *_at to *_on across domain tables.
-- Keep session security fields expires_at and refresh_token_expires_at unchanged.

-- users
ALTER TABLE users RENAME COLUMN created_at TO created_on;
ALTER TABLE users RENAME COLUMN updated_at TO updated_on;

-- branches
ALTER TABLE branches RENAME COLUMN created_at TO created_on;
ALTER TABLE branches RENAME COLUMN updated_at TO updated_on;
ALTER TABLE branches RENAME COLUMN deleted_at TO deleted_on;

-- leave_requests
ALTER TABLE leave_requests RENAME COLUMN created_at TO created_on;
ALTER TABLE leave_requests RENAME COLUMN updated_at TO updated_on;
ALTER TABLE leave_requests RENAME COLUMN approved_at TO approved_on;
ALTER TABLE leave_requests RENAME COLUMN deleted_at TO deleted_on;

-- audit_logs
ALTER TABLE audit_logs RENAME COLUMN created_at TO created_on;

-- notifications
ALTER TABLE notifications RENAME COLUMN created_at TO created_on;

-- locations
ALTER TABLE locations RENAME COLUMN created_at TO created_on;
ALTER TABLE locations RENAME COLUMN updated_at TO updated_on;
ALTER TABLE locations RENAME COLUMN deleted_at TO deleted_on;

-- event_participants
ALTER TABLE event_participants RENAME COLUMN created_at TO created_on;

-- events
ALTER TABLE events RENAME COLUMN created_at TO created_on;
ALTER TABLE events RENAME COLUMN updated_at TO updated_on;
ALTER TABLE events RENAME COLUMN deleted_at TO deleted_on;

-- late_requests
ALTER TABLE late_requests RENAME COLUMN created_at TO created_on;
ALTER TABLE late_requests RENAME COLUMN updated_at TO updated_on;
ALTER TABLE late_requests RENAME COLUMN approved_at TO approved_on;
ALTER TABLE late_requests RENAME COLUMN deleted_at TO deleted_on;

-- sessions (keep expires_at and refresh_token_expires_at)
ALTER TABLE sessions RENAME COLUMN created_at TO created_on;

-- approval_actions
ALTER TABLE approval_actions RENAME COLUMN action_at TO action_on;
ALTER TABLE approval_actions RENAME COLUMN created_at TO created_on;

-- announcements
ALTER TABLE announcements RENAME COLUMN created_at TO created_on;
ALTER TABLE announcements RENAME COLUMN updated_at TO updated_on;
ALTER TABLE announcements RENAME COLUMN sent_at TO sent_on;
ALTER TABLE announcements RENAME COLUMN deleted_at TO deleted_on;

-- announcement_recipients
ALTER TABLE announcement_recipients RENAME COLUMN created_at TO created_on;
ALTER TABLE announcement_recipients RENAME COLUMN sent_at TO sent_on;
