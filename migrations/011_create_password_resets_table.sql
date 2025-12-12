-- Create password_resets table for storing password reset tokens
CREATE TABLE IF NOT EXISTS "PasswordResets" (
    "Id" SERIAL PRIMARY KEY,
    "Email" VARCHAR(255) NOT NULL,
    "Token" VARCHAR(255) NOT NULL UNIQUE,
    "ExpiresAt" TIMESTAMP NOT NULL,
    "Used" BOOLEAN DEFAULT FALSE,
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON "PasswordResets" ("Token");
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON "PasswordResets" ("Email");
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON "PasswordResets" ("ExpiresAt");

-- Add comment
COMMENT ON TABLE "PasswordResets" IS 'Stores password reset tokens for forgot password functionality';
