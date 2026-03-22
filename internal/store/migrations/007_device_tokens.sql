-- Migration: 007_device_tokens
-- Description: Create device_tokens table for push notification device registration

CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference (application's user ID)
    user_id VARCHAR(255) NOT NULL,
    
    -- Device token from FCM
    token VARCHAR(500) NOT NULL UNIQUE,
    
    -- Device information
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    device_id VARCHAR(255), -- Device-specific identifier
    device_name VARCHAR(255), -- Human-readable device name
    app_version VARCHAR(50),
    os_version VARCHAR(50),
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Token validation
    last_validated_at TIMESTAMPTZ,
    validation_failures INTEGER NOT NULL DEFAULT 0,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    notification_count INTEGER NOT NULL DEFAULT 0,
    
    -- Notification preferences (optional)
    preferences JSONB DEFAULT '{}'::jsonb, -- {"enabled": true, "categories": ["alerts", "messages"]}
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_device_tokens_token ON device_tokens(token) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_device_tokens_platform ON device_tokens(platform) WHERE deleted_at IS NULL;
CREATE INDEX idx_device_tokens_device_id ON device_tokens(device_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_device_tokens_is_active ON device_tokens(is_active);
CREATE INDEX idx_device_tokens_created_at ON device_tokens(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_device_tokens_updated_at BEFORE UPDATE ON device_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE device_tokens IS 'Device tokens for push notifications via FCM';
COMMENT ON COLUMN device_tokens.user_id IS 'Application user ID (not internal UUID)';
COMMENT ON COLUMN device_tokens.token IS 'FCM device token for push notifications';
COMMENT ON COLUMN device_tokens.validation_failures IS 'Counter for failed deliveries (for automatic cleanup)';
