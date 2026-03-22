-- Migration: 001_datasources
-- Description: Create datasources table for external data sources (Google Sheets, CSV uploads, etc.)

CREATE TABLE IF NOT EXISTS datasources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('google_sheets', 'csv', 'json', 'api')),
    
    -- Configuration stored as JSONB for flexibility
    -- For Google Sheets: {"sheet_id": "...", "range": "A1:Z100", "credentials": "..."}
    -- For CSV: {"file_path": "...", "delimiter": ","}
    -- For API: {"endpoint": "...", "auth": {...}}
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Column mapping: maps datasource columns to notification fields
    -- Example: {"email": "email_column", "phone": "phone_column", "name": "name_column"}
    column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID, -- Reference to user/api_key that created it
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_datasources_type ON datasources(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_datasources_created_at ON datasources(created_at DESC);
CREATE INDEX idx_datasources_deleted_at ON datasources(deleted_at) WHERE deleted_at IS NOT NULL;

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
COMMENT ON TABLE datasources IS 'External data sources for bulk notification sending';
COMMENT ON COLUMN datasources.config IS 'Datasource-specific configuration stored as JSON';
COMMENT ON COLUMN datasources.column_mapping IS 'Maps datasource columns to notification fields';
