-- Migration: 002_templates
-- Description: Create templates table for reusable notification templates

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template can support multiple channels
    channels TEXT[] NOT NULL CHECK (array_length(channels, 1) > 0),
    
    -- Subject/Title (for email, push)
    subject VARCHAR(500),
    
    -- Body/Content with variable placeholders like {{name}}, {{code}}, etc.
    body TEXT NOT NULL,
    
    -- Optional HTML version for email
    html_body TEXT,
    
    -- Variables that can be used in this template
    -- Example: ["name", "code", "amount", "date"]
    variables TEXT[] NOT NULL DEFAULT '{}',
    
    -- Default values for variables (optional)
    -- Example: {"name": "User", "greeting": "Hello"}
    default_values JSONB DEFAULT '{}'::jsonb,
    
    -- Template-specific configuration
    -- For email: {"from_name": "...", "reply_to": "..."}
    -- For SMS: {"sender_id": "..."}
    -- For push: {"icon": "...", "sound": "..."}
    config JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- Active/inactive status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_templates_channels ON templates USING GIN(channels) WHERE deleted_at IS NULL;
CREATE INDEX idx_templates_is_active ON templates(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_templates_created_at ON templates(created_at DESC);
CREATE INDEX idx_templates_name ON templates(name) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE templates IS 'Reusable notification templates with variable substitution';
COMMENT ON COLUMN templates.channels IS 'Supported channels: email, sms, push, in_app';
COMMENT ON COLUMN templates.variables IS 'List of available variables for substitution';
COMMENT ON COLUMN templates.body IS 'Template body with {{variable}} placeholders';
