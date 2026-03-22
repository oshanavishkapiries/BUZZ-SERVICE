-- Migration: 006_api_keys
-- Description: Create api_keys table for API authentication

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Key details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- The actual API key (hashed)
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    
    -- Prefix for easy identification (first 8 chars, unhashed)
    -- Example: "bz_live_" or "bz_test_"
    key_prefix VARCHAR(20) NOT NULL,
    
    -- Environment
    environment VARCHAR(20) NOT NULL DEFAULT 'production' CHECK (
        environment IN ('production', 'staging', 'development', 'test')
    ),
    
    -- Permissions/Scopes
    -- Example: ["notifications:write", "notifications:read", "batches:write", "templates:read"]
    scopes TEXT[] NOT NULL DEFAULT '{}',
    
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 100,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    rate_limit_per_day INTEGER DEFAULT 10000,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER NOT NULL DEFAULT 0,
    
    -- IP whitelist (optional)
    allowed_ips TEXT[], -- Example: ["192.168.1.1", "10.0.0.0/24"]
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_environment ON api_keys(environment) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_api_keys_created_at ON api_keys(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE api_keys IS 'API keys for authentication with rate limiting and scoping';
COMMENT ON COLUMN api_keys.key_hash IS 'Hashed API key (bcrypt or similar)';
COMMENT ON COLUMN api_keys.key_prefix IS 'Unhashed prefix for identification (e.g., bz_live_abcd1234)';
COMMENT ON COLUMN api_keys.scopes IS 'Permissions granted to this API key';
COMMENT ON COLUMN api_keys.allowed_ips IS 'Optional IP whitelist for additional security';
