-- Migration: 011_multiclient_migration
-- Description: Add application_id to existing tables, migrate existing data, and update unique constraints

-- 1. provider_configs
ALTER TABLE provider_configs ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE provider_configs SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE provider_configs ALTER COLUMN application_id SET NOT NULL;
ALTER TABLE provider_configs DROP CONSTRAINT IF EXISTS provider_configs_name_key;
ALTER TABLE provider_configs ADD CONSTRAINT provider_configs_app_name_key UNIQUE (application_id, name);

DROP INDEX IF EXISTS idx_provider_configs_one_default;
CREATE UNIQUE INDEX idx_provider_configs_one_default_per_app
    ON provider_configs (application_id, channel)
    WHERE is_default = true AND is_active = true;

-- 2. templates
ALTER TABLE templates ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE templates SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE templates ALTER COLUMN application_id SET NOT NULL;

DROP INDEX IF EXISTS idx_templates_name;
CREATE INDEX idx_templates_app_name ON templates(application_id, name) WHERE deleted_at IS NULL;

-- 3. datasources
ALTER TABLE datasources ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE datasources SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE datasources ALTER COLUMN application_id SET NOT NULL;
ALTER TABLE datasources DROP CONSTRAINT IF EXISTS datasources_name_key;
ALTER TABLE datasources ADD CONSTRAINT datasources_app_name_key UNIQUE (application_id, name);

-- 4. api_keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE api_keys SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE api_keys ALTER COLUMN application_id SET NOT NULL;

-- 5. batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE batches SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE batches ALTER COLUMN application_id SET NOT NULL;

-- 6. notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE notifications SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE notifications ALTER COLUMN application_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_app_id ON notifications(application_id);

-- 7. inbox
ALTER TABLE inbox ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE inbox SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE inbox ALTER COLUMN application_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbox_app_id ON inbox(application_id);

-- 8. device_tokens
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE CASCADE;
UPDATE device_tokens SET application_id = '22222222-2222-2222-2222-222222222222' WHERE application_id IS NULL;
ALTER TABLE device_tokens ALTER COLUMN application_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_device_tokens_app_id ON device_tokens(application_id);
