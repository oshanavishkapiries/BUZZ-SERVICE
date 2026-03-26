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
-- These keys are for development and testing only. Never use in production.

-- Test Key: buzz_test_key_123
-- SHA256 Hash: be1821aec251a0c3191119b5d182f931442ba3dc2be5372234d35ebe9b550224
-- Full Development Access with monitoring
INSERT INTO api_keys (
    id, name, description, key_hash, key_prefix, environment, scopes,
    rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
    is_active, created_at, updated_at
)
SELECT gen_random_uuid(), 'Test API Key - Development', 'API key for development and testing with full access',
    'be1821aec251a0c3191119b5d182f931442ba3dc2be5372234d35ebe9b550224', 'buzz_tes', 'test',
    ARRAY[
        'notification:send',
        'notification:read',
        'notification:update',
        'notification:delete',
        'template:read',
        'template:write',
        'batch:write',
        'batch:read',
        'batch:update',
        'datasource:read',
        'datasource:write',
        'monitoring:read',
        'queue:inspect',
        'device:register',
        'device:list',
        'device:delete',
        'inbox:read',
        'inbox:update'
    ],
    1000, 10000, 100000, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE key_prefix = 'buzz_tes');

-- Production API Key: buzz_live_prod_key
-- SHA256 Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
-- Limited Production Access
INSERT INTO api_keys (
    id, name, description, key_hash, key_prefix, environment, scopes,
    rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
    is_active, created_at, updated_at
)
SELECT gen_random_uuid(), 'Production API Key - Full Access', 'Full access API key for production environment',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'buzz_liv', 'production',
    ARRAY['*'],
    100, 1000, 10000, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE key_prefix = 'buzz_liv');

-- Read-Only Monitoring Key: buzz_monitor_read
-- SHA256 Hash: 5e884898da28047151d0e56f8dc629302f592f40d33e40b79f1abe66b87d4ad4
-- Monitoring and Statistics Only
INSERT INTO api_keys (
    id, name, description, key_hash, key_prefix, environment, scopes,
    rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
    is_active, created_at, updated_at
)
SELECT gen_random_uuid(), 'Monitoring API Key - Read Only', 'Read-only access for monitoring and statistics',
    '5e884898da28047151d0e56f8dc629302f592f40d33e40b79f1abe66b87d4ad4', 'buzz_mon', 'production',
    ARRAY[
        'notification:read',
        'batch:read',
        'monitoring:read',
        'queue:inspect',
        'device:list'
    ],
    500, 5000, 50000, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE key_prefix = 'buzz_mon');

-- Sender-Only Key: buzz_sender_limited
-- SHA256 Hash: 6512bd43d9caa6e02c990b0a82652dca2b16e0e8f96e0d7ef3e17de8e6a9e5b
-- Limited to Sending Notifications Only
INSERT INTO api_keys (
    id, name, description, key_hash, key_prefix, environment, scopes,
    rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day,
    is_active, created_at, updated_at
)
SELECT gen_random_uuid(), 'Sender API Key - Limited', 'Limited access for sending notifications only',
    '6512bd43d9caa6e02c990b0a82652dca2b16e0e8f96e0d7ef3e17de8e6a9e5b', 'buzz_snd', 'production',
    ARRAY[
        'notification:send',
        'notification:read',
        'template:read',
        'device:register'
    ],
    2000, 20000, 200000, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE key_prefix = 'buzz_snd');

-- Comments
COMMENT ON TABLE templates IS 'Seed templates contain common notification patterns for development and testing';
COMMENT ON TABLE api_keys IS 'Seed API keys are for testing and development only - regenerate and rotate keys for production use';

-- API Key Scopes Reference:
-- notification:send   - Send individual notifications
-- notification:read   - Retrieve notification details and history
-- notification:update - Update notification status/metadata
-- notification:delete - Delete notifications (hard delete)
-- template:read       - Read notification templates
-- template:write      - Create/update notification templates
-- batch:write         - Create and manage batch operations
-- batch:read          - Read batch details and progress
-- batch:update        - Update batch status
-- datasource:read     - Read data source configurations
-- datasource:write    - Create/update data sources
-- monitoring:read     - Access queue statistics and monitoring
-- queue:inspect       - Inspect queue contents and status
-- device:register     - Register device tokens for push notifications
-- device:list         - List devices for a user
-- device:delete       - Remove device tokens
-- inbox:read          - Read user inbox entries
-- inbox:update        - Mark messages as read/archived
-- *                   - Full access to all operations

