-- Migration: 003_batches
-- Description: Create batches table for bulk notification operations (Phase 9)

CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Datasource reference
    datasource_id UUID NOT NULL REFERENCES datasources(id),
    datasource_name VARCHAR(255) NOT NULL,
    
    -- Endpoint configuration
    endpoint_name VARCHAR(255) NOT NULL,
    endpoint_params JSONB DEFAULT '{}'::jsonb,
    
    -- Template reference
    template_name VARCHAR(255) NOT NULL,
    template_data JSONB DEFAULT '{}'::jsonb,
    
    -- Channel for this batch
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    
    -- Priority level
    priority VARCHAR(50) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Idempotency key for request deduplication
    idempotency_key VARCHAR(255) UNIQUE,
    
    -- Status tracking (Phase 9 lifecycle)
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'fetching', 'queued', 'delivering', 'completed', 'failed', 'cancelled')
    ),
    
    -- Progress counters
    total INTEGER NOT NULL DEFAULT 0,
    sent INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_datasource_id ON batches(datasource_id);
CREATE INDEX idx_batches_idempotency_key ON batches(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_batches_created_at ON batches(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE batches IS 'Bulk notification batches for sending multiple notifications (Phase 9)';
COMMENT ON COLUMN batches.idempotency_key IS 'Request-level deduplication key';
COMMENT ON COLUMN batches.endpoint_params IS 'Parameters for datasource endpoint query';
COMMENT ON COLUMN batches.template_data IS 'Data to merge with recipient data for templating';
COMMENT ON COLUMN batches.status IS 'Batch lifecycle: pending -> fetching -> queued -> delivering -> completed';
