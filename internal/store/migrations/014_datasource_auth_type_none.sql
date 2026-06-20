-- Allow 'none' as a valid auth_type for datasources that need no authentication.
-- The original constraint only listed bearer/basic/api_key, leaving the empty-string
-- case (sent by the frontend when "None" is selected) with no valid DB value.

ALTER TABLE datasources DROP CONSTRAINT IF EXISTS datasources_auth_type_check;

ALTER TABLE datasources
    ADD CONSTRAINT datasources_auth_type_check
    CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key'));

ALTER TABLE datasources ALTER COLUMN auth_type SET DEFAULT 'none';

-- Normalise any existing rows that were saved with an empty string before this fix.
UPDATE datasources SET auth_type = 'none' WHERE auth_type = '';
