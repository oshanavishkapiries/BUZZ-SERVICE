-- Migration: 013_user_system_roles
-- Description: Add role column to users table, default to 'user', and set existing admin's role to 'owner'

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'user';

-- Set admin role to owner
UPDATE users SET role = 'owner' WHERE email = 'admin@buzz.local';
