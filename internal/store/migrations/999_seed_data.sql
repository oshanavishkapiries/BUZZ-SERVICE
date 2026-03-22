-- Migration: 999_seed_data
-- Description: Seed data for testing and development

-- Seed Templates
-- Using INSERT ... ON CONFLICT DO NOTHING to handle already existing data
INSERT INTO templates (id, name, description, channels, subject, body, variables, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Welcome Email', 'Welcome email sent to new users',
    ARRAY['email'], 'Welcome to {{app_name}}!',
    'Hi {{name}}, Welcome to {{app_name}}! We''re excited to have you on board. To get started, please verify your email address by clicking the link below: {{verification_link}}. If you have any questions, feel free to reach out to our support team. Best regards, The {{app_name}} Team',
    ARRAY['name', 'app_name', 'verification_link'], true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE name = 'Welcome Email');

INSERT INTO templates (id, name, description, channels, subject, body, variables, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Password Reset', 'Password reset email with temporary code',
    ARRAY['email'], 'Reset Your Password',
    'Hi {{name}}, We received a request to reset your password. Use the code below to reset your password: Reset Code: {{reset_code}}. This code will expire in {{expiry_minutes}} minutes. If you didn''t request this, please ignore this email. Best regards, The {{app_name}} Team',
    ARRAY['name', 'reset_code', 'expiry_minutes', 'app_name'], true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE name = 'Password Reset');

INSERT INTO templates (id, name, description, channels, subject, body, variables, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'OTP Verification', 'One-time password for verification',
    ARRAY['sms', 'email'], 'Your Verification Code',
    'Your verification code is: {{otp_code}}. This code will expire in {{expiry_minutes}} minutes. If you didn''t request this code, please contact support immediately.',
    ARRAY['otp_code', 'expiry_minutes'], true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE name = 'OTP Verification');

INSERT INTO templates (id, name, description, channels, subject, body, variables, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Order Confirmation', 'Order confirmation with details',
    ARRAY['email', 'in_app'], 'Order Confirmation - {{order_id}}',
    'Hi {{customer_name}}, Thank you for your order! Your order has been confirmed. Order ID: {{order_id}}, Order Total: {{order_total}}, Estimated Delivery: {{delivery_date}}. You can track your order status at any time by visiting your account dashboard. Thank you for shopping with us! Best regards, The {{app_name}} Team',
    ARRAY['customer_name', 'order_id', 'order_total', 'delivery_date', 'app_name'], true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE name = 'Order Confirmation');

INSERT INTO templates (id, name, description, channels, subject, body, variables, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Push Notification Alert', 'Generic push notification for alerts',
    ARRAY['push', 'in_app'], '{{title}}', '{{message}}',
    ARRAY['title', 'message'], true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE name = 'Push Notification Alert');

INSERT INTO templates (id, name, description, channels, subject, body, variables, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Promotional SMS', 'Promotional SMS for marketing campaigns',
    ARRAY['sms'], NULL, '{{promotion_text}}. Use code: {{promo_code}} at checkout. Valid until: {{expiry_date}}. Reply STOP to unsubscribe.',
    ARRAY['promotion_text', 'promo_code', 'expiry_date'], true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE name = 'Promotional SMS');

-- Seed API Keys (for testing purposes)
-- Key: bz_test_1234567890abcdef (hashed with bcrypt)
-- Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy (for 'secret')
-- Using ON CONFLICT DO NOTHING to handle already existing data
INSERT INTO api_keys (
    id, name, description, key_hash, key_prefix, environment, scopes,
    rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
    is_active, created_at, updated_at
)
SELECT gen_random_uuid(), 'Test API Key - Development', 'API key for development and testing',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'bz_test_', 'test',
    ARRAY['notifications:write', 'notifications:read', 'templates:read', 'batches:write', 'batches:read'],
    1000, 10000, 100000, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE key_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

INSERT INTO api_keys (
    id, name, description, key_hash, key_prefix, environment, scopes,
    rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
    is_active, created_at, updated_at
)
SELECT gen_random_uuid(), 'Production API Key - Full Access', 'Full access API key for production',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'bz_live_', 'production',
    ARRAY['notifications:write', 'notifications:read', 'templates:write', 'templates:read', 'batches:write', 'batches:read', 'datasources:write', 'datasources:read'],
    100, 1000, 10000, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE key_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- Comments
COMMENT ON TABLE templates IS 'Seed templates contain common notification patterns';
COMMENT ON TABLE api_keys IS 'Seed API keys are for testing only - regenerate for production';
