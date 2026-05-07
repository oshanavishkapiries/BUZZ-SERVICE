-- Migration: 008_provider_configs
-- Description: Provider configurations stored in DB (replaces env-var-only approach)

CREATE TABLE IF NOT EXISTS provider_configs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name        VARCHAR(100) NOT NULL UNIQUE,  -- e.g. "sendgrid-prod", "twilio-us"
    channel     VARCHAR(20)  NOT NULL CHECK (channel IN ('email','sms','push','in_app')),
    provider    VARCHAR(50)  NOT NULL,         -- ses, smtp, twilio, notifylk, fcm

    -- Credentials and settings (stored encrypted in production)
    config      JSONB        NOT NULL DEFAULT '{}'::jsonb,

    -- Routing
    is_default  BOOLEAN      NOT NULL DEFAULT false,
    is_active   BOOLEAN      NOT NULL DEFAULT true,

    -- Audit
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Only one default per channel
CREATE UNIQUE INDEX idx_provider_configs_one_default
    ON provider_configs (channel)
    WHERE is_default = true AND is_active = true;

CREATE INDEX idx_provider_configs_channel   ON provider_configs (channel) WHERE is_active = true;
CREATE INDEX idx_provider_configs_is_active ON provider_configs (is_active);

CREATE TRIGGER update_provider_configs_updated_at
    BEFORE UPDATE ON provider_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE  provider_configs IS 'Database-stored provider credentials for email/sms/push delivery';
COMMENT ON COLUMN provider_configs.name     IS 'Unique slug used in send requests to select a specific provider';
COMMENT ON COLUMN provider_configs.provider IS 'Provider type: ses | smtp | twilio | notifylk | fcm';
COMMENT ON COLUMN provider_configs.config   IS 'Provider-specific credentials. See docs for field names per provider type.';
COMMENT ON COLUMN provider_configs.is_default IS 'Used when no provider is explicitly specified in a send request';
