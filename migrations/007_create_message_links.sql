-- Migration: Create MessageLinks table
-- Description: Store URLs/links extracted from chat messages

CREATE TABLE IF NOT EXISTS "MessageLinks" (
    "LinkId" SERIAL PRIMARY KEY,
    "MessageId" INTEGER NOT NULL,
    "URL" TEXT NOT NULL,
    "Title" VARCHAR(500),
    "Description" TEXT,
    "ImageURL" TEXT,
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_message
        FOREIGN KEY ("MessageId")
        REFERENCES "ChatMessages"("MessageID")
        ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_message_links_message_id ON "MessageLinks"("MessageId");
CREATE INDEX IF NOT EXISTS idx_message_links_created_at ON "MessageLinks"("CreatedAt" DESC);

-- Add comments
COMMENT ON TABLE "MessageLinks" IS 'Stores links/URLs shared in chat messages';
COMMENT ON COLUMN "MessageLinks"."LinkId" IS 'Primary key';
COMMENT ON COLUMN "MessageLinks"."MessageId" IS 'Reference to ChatMessages';
COMMENT ON COLUMN "MessageLinks"."URL" IS 'The actual URL/link';
COMMENT ON COLUMN "MessageLinks"."Title" IS 'Link preview title (optional)';
COMMENT ON COLUMN "MessageLinks"."Description" IS 'Link preview description (optional)';
COMMENT ON COLUMN "MessageLinks"."ImageURL" IS 'Link preview image (optional)';
