-- Migration: 005_inbox
-- Description: Create inbox table for in-app notifications

CREATE TABLE IF NOT EXISTS inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference (application's user ID)
    user_id VARCHAR(255) NOT NULL,
    
    -- Notification reference
    notification_id UUID REFERENCES notifications(id),
    
    -- Content (denormalized for faster inbox queries)
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    
    -- Type/Category
    type VARCHAR(100), -- e.g., 'alert', 'info', 'warning', 'promotion'
    
    -- Action/Link
    action_url VARCHAR(1000),
    action_text VARCHAR(100),
    
    -- Icon/Image
    icon_url VARCHAR(1000),
    image_url VARCHAR(1000),
    
    -- Status
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    read_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Optional expiration
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_inbox_user_id ON inbox(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inbox_user_unread ON inbox(user_id, created_at DESC) WHERE is_read = false AND deleted_at IS NULL;
CREATE INDEX idx_inbox_user_archived ON inbox(user_id, created_at DESC) WHERE is_archived = true AND deleted_at IS NULL;
CREATE INDEX idx_inbox_notification_id ON inbox(notification_id);
CREATE INDEX idx_inbox_expires_at ON inbox(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_inbox_created_at ON inbox(created_at DESC);
CREATE INDEX idx_inbox_type ON inbox(type) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_inbox_updated_at BEFORE UPDATE ON inbox
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE inbox IS 'In-app notification inbox for users with read/unread tracking';
COMMENT ON COLUMN inbox.user_id IS 'Application user ID (not internal UUID)';
COMMENT ON COLUMN inbox.expires_at IS 'Optional expiration date for time-sensitive notifications';
