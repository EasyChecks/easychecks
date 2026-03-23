-- Make location_id nullable to support custom venue events
-- (events where admin types a venue name + picks position on map, not linked to a check-in Location)
ALTER TABLE events ALTER COLUMN location_id DROP NOT NULL;

-- Add custom venue fields
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_name VARCHAR(500),
  ADD COLUMN IF NOT EXISTS venue_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS venue_longitude DOUBLE PRECISION;
