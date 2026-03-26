-- Migration: 001_datasources
-- Description: Create datasources table for API-based external data sources (Phase 9)

CREATE TABLE IF NOT EXISTS datasources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datasource identification
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    
    -- API configuration
    base_url VARCHAR(2048) NOT NULL,
    
    -- Authentication
    auth_type VARCHAR(50) NOT NULL DEFAULT 'bearer' CHECK (auth_type IN ('bearer', 'basic', 'api_key')),
    auth_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Endpoints configuration
    -- Structure: {"endpoint_name": {"method": "GET", "path": "/users", "auth": {...}, "response_format": {...}}}
    endpoints JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Active flag
    active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_datasources_name ON datasources(name);
CREATE INDEX idx_datasources_active ON datasources(active);
CREATE INDEX idx_datasources_created_at ON datasources(created_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_datasources_updated_at BEFORE UPDATE ON datasources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE datasources IS 'API-based external data sources for recipient fetching (Phase 9)';
COMMENT ON COLUMN datasources.auth_config IS 'Auth credentials: bearer token, basic auth, or API key';
COMMENT ON COLUMN datasources.endpoints IS 'Endpoint configurations with method, path, auth, response format';
