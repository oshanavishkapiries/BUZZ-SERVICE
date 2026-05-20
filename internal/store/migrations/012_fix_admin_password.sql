-- Migration: 012_fix_admin_password
-- Description: Update the default admin user's password hash to the correct bcrypt hash for 'admin123'

UPDATE users
SET password_hash = '$2a$10$0YbxAXlt2itiS4Oajq6s6.HTlS8DJEV.ULdF1cshAlGJRJVeOoCnO'
WHERE email = 'admin@buzz.local' AND password_hash = '$2a$10$WixS41mX28Fq0n0U2U41DuS9iPpxPzK8e4b7/3kLwzIe1j2.U7O8m';
