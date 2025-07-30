-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create encrypted token columns
ALTER TABLE "Integration" 
ADD COLUMN "accessTokenEncrypted" TEXT,
ADD COLUMN "refreshTokenEncrypted" TEXT,
ADD COLUMN "botTokenEncrypted" TEXT;

-- Migrate existing tokens to encrypted columns (for existing data)
-- Note: This assumes DATABASE_ENCRYPT_KEY is set in environment
-- UPDATE "Integration" 
-- SET "accessTokenEncrypted" = pgp_sym_encrypt("accessToken", current_setting('app.encrypt_key', true))
-- WHERE "accessToken" IS NOT NULL;

-- UPDATE "Integration" 
-- SET "refreshTokenEncrypted" = pgp_sym_encrypt("refreshToken", current_setting('app.encrypt_key', true))
-- WHERE "refreshToken" IS NOT NULL;

-- UPDATE "Integration" 
-- SET "botTokenEncrypted" = pgp_sym_encrypt("botToken", current_setting('app.encrypt_key', true))
-- WHERE "botToken" IS NOT NULL;