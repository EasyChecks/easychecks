-- Migration: repurpose `password` column to store custom (changed) passwords
-- Previously, `password` was populated at user creation but never used for login.
-- Going forward, `password` replaces `custom_password` for tracking changed passwords.
-- Existing values in `password` are reset to NULL so login falls back to nationalId.

ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
UPDATE users SET password = NULL;
