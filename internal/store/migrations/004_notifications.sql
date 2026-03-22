-- Migration: 004_notifications
-- Description: Create notifications table for individual notification records

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Batch reference (if part of a batch)
    batch_id UUID REFERENCES batches(id),
    
    -- Channel
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    
    -- Priority
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (
        priority IN ('low', 'normal', 'high', 'urgent')
    ),
    
    -- Recipient information
    recipient JSONB NOT NULL, -- {"email": "...", "phone": "...", "user_id": "...", "device_token": "..."}
    
    -- Content
    subject VARCHAR(500),
    body TEXT NOT NULL,
    html_body TEXT, -- For email
    
    -- Template reference (if created from template)
    template_id UUID REFERENCES templates(id),
    
    -- Variables used for template substitution
    variables JSONB DEFAULT '{}'::jsonb,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'queued', 'processing', 'sent', 'delivered', 'failed', 'cancelled')
    ),
    
    -- Provider information
    provider VARCHAR(100), -- e.g., 'ses', 'smtp', 'notifylk', 'twilio', 'fcm'
    provider_message_id VARCHAR(255), -- External provider's message ID
    provider_response JSONB, -- Full provider response
    
    -- Delivery tracking
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Retry tracking
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(100),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Custom metadata from API
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_notifications_status ON notifications(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_batch_id ON notifications(batch_id);
CREATE INDEX idx_notifications_priority ON notifications(priority) WHERE status IN ('pending', 'queued');
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_next_retry ON notifications(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_notifications_provider_message_id ON notifications(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- GIN index for recipient JSONB searches
CREATE INDEX idx_notifications_recipient ON notifications USING GIN(recipient);

-- Trigger for updated_at
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE notifications IS 'Individual notification records with full lifecycle tracking';
COMMENT ON COLUMN notifications.recipient IS 'Recipient details stored as JSON (email, phone, user_id, etc.)';
COMMENT ON COLUMN notifications.status IS 'Notification lifecycle: pending → queued → processing → sent → delivered';
COMMENT ON COLUMN notifications.provider_message_id IS 'External provider message ID for tracking';
