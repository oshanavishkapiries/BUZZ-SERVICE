-- Migration: 003_batches
-- Description: Create batches table for bulk notification operations

CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Batch type
    type VARCHAR(50) NOT NULL CHECK (type IN ('manual', 'datasource', 'api')),
    
    -- Channel for this batch
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    
    -- Template reference
    template_id UUID REFERENCES templates(id),
    
    -- Datasource reference (if type is 'datasource')
    datasource_id UUID REFERENCES datasources(id),
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
    ),
    
    -- Counters
    total_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    
    -- Batch configuration
    -- Example: {"rate_limit": 100, "retry_failed": true, "priority": "high"}
    config JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    
    -- Soft delete support
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_batches_status ON batches(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_channel ON batches(channel) WHERE deleted_at IS NULL;
CREATE INDEX idx_batches_template_id ON batches(template_id);
CREATE INDEX idx_batches_datasource_id ON batches(datasource_id);
CREATE INDEX idx_batches_scheduled_at ON batches(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_batches_created_at ON batches(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE batches IS 'Bulk notification batches for sending multiple notifications';
COMMENT ON COLUMN batches.type IS 'How the batch was created: manual, datasource, or api';
COMMENT ON COLUMN batches.config IS 'Batch-specific settings like rate limiting and priority';
