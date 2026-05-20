-- Migration: 010_users_and_applications
-- Description: Create users, applications, and application_members tables for authentication and multiclient setup

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, name)
);

-- Create application_members table
CREATE TABLE IF NOT EXISTS application_members (
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (application_id, user_id)
);

-- Indexes for performance and constraints
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_applications_owner ON applications(owner_id);
CREATE INDEX idx_application_members_user ON application_members(user_id);

-- Trigger for updated_at on users and applications
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed a default user and a default application
-- The password is 'admin123' hashed with bcrypt ($2a$10$0YbxAXlt2itiS4Oajq6s6.HTlS8DJEV.ULdF1cshAlGJRJVeOoCnO)
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'admin@buzz.local',
    '$2a$10$0YbxAXlt2itiS4Oajq6s6.HTlS8DJEV.ULdF1cshAlGJRJVeOoCnO',
    'Admin User'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO applications (id, name, description, owner_id)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Default Application',
    'Initial default workspace for all migrated resources.',
    '11111111-1111-1111-1111-111111111111'
) ON CONFLICT (owner_id, name) DO NOTHING;

-- Make the admin user a member/owner of the default application
INSERT INTO application_members (application_id, user_id, role)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'owner'
) ON CONFLICT (application_id, user_id) DO NOTHING;
