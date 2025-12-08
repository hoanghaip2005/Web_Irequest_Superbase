-- Migration: Enhance Comments table for enterprise features
-- Created: 2025-12-08
-- Purpose: Add internal notes, mentions, attachments support

-- First, let's check current structure and enhance it
-- Adding new columns to existing Comments table

-- Add IsInternal flag for internal notes vs public comments
ALTER TABLE "Comments" 
ADD COLUMN IF NOT EXISTS "IsInternal" BOOLEAN DEFAULT FALSE;

-- Add ParentCommentId for threading/replies
ALTER TABLE "Comments" 
ADD COLUMN IF NOT EXISTS "ParentCommentId" INTEGER NULL;

-- Add IsEdited flag
ALTER TABLE "Comments" 
ADD COLUMN IF NOT EXISTS "IsEdited" BOOLEAN DEFAULT FALSE;

-- Add EditedAt timestamp
ALTER TABLE "Comments" 
ADD COLUMN IF NOT EXISTS "EditedAt" TIMESTAMP NULL;

-- Add MentionedUserIds for @mentions
ALTER TABLE "Comments" 
ADD COLUMN IF NOT EXISTS "MentionedUserIds" TEXT NULL; -- JSON array of user IDs

-- Increase Content length for rich text
ALTER TABLE "Comments" 
ALTER COLUMN "Content" TYPE TEXT;

-- Add foreign key constraints if not exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FK_Comments_Requests'
    ) THEN
        ALTER TABLE "Comments"
        ADD CONSTRAINT "FK_Comments_Requests" 
        FOREIGN KEY ("RequestId") REFERENCES "Requests"("RequestID") 
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FK_Comments_Users'
    ) THEN
        ALTER TABLE "Comments"
        ADD CONSTRAINT "FK_Comments_Users" 
        FOREIGN KEY ("UserId") REFERENCES "Users"("Id") 
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'FK_Comments_ParentComment'
    ) THEN
        ALTER TABLE "Comments"
        ADD CONSTRAINT "FK_Comments_ParentComment" 
        FOREIGN KEY ("ParentCommentId") REFERENCES "Comments"("CommentId") 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "IX_Comments_RequestId" ON "Comments"("RequestId");
CREATE INDEX IF NOT EXISTS "IX_Comments_UserId" ON "Comments"("UserId");
CREATE INDEX IF NOT EXISTS "IX_Comments_CreatedAt" ON "Comments"("CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "IX_Comments_IsInternal" ON "Comments"("IsInternal");

-- Create table for Comment Attachments
CREATE TABLE IF NOT EXISTS "CommentAttachments" (
    "AttachmentId" SERIAL NOT NULL,
    "CommentId" INTEGER NOT NULL,
    "FileName" VARCHAR(255) NOT NULL,
    "FilePath" VARCHAR(500) NOT NULL,
    "FileSize" BIGINT NOT NULL,
    "MimeType" VARCHAR(100) NOT NULL,
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "UploadedBy" VARCHAR(450) NOT NULL,
    CONSTRAINT "PK_CommentAttachments" PRIMARY KEY ("AttachmentId"),
    CONSTRAINT "FK_CommentAttachments_Comments" FOREIGN KEY ("CommentId") 
        REFERENCES "Comments"("CommentId") ON DELETE CASCADE,
    CONSTRAINT "FK_CommentAttachments_Users" FOREIGN KEY ("UploadedBy") 
        REFERENCES "Users"("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_CommentAttachments_CommentId" ON "CommentAttachments"("CommentId");

-- Create table for Comment Reactions (like Jira reactions)
CREATE TABLE IF NOT EXISTS "CommentReactions" (
    "ReactionId" SERIAL NOT NULL,
    "CommentId" INTEGER NOT NULL,
    "UserId" VARCHAR(450) NOT NULL,
    "ReactionType" VARCHAR(20) NOT NULL, -- 'like', 'helpful', 'thumbsup', 'thumbsdown'
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_CommentReactions" PRIMARY KEY ("ReactionId"),
    CONSTRAINT "FK_CommentReactions_Comments" FOREIGN KEY ("CommentId") 
        REFERENCES "Comments"("CommentId") ON DELETE CASCADE,
    CONSTRAINT "FK_CommentReactions_Users" FOREIGN KEY ("UserId") 
        REFERENCES "Users"("Id") ON DELETE CASCADE,
    CONSTRAINT "UQ_CommentReactions" UNIQUE ("CommentId", "UserId", "ReactionType")
);

CREATE INDEX IF NOT EXISTS "IX_CommentReactions_CommentId" ON "CommentReactions"("CommentId");

-- Add comment to track migration
COMMENT ON TABLE "Comments" IS 'Enhanced comments system with internal notes, mentions, and threading support';
COMMENT ON COLUMN "Comments"."IsInternal" IS 'TRUE for internal notes (staff only), FALSE for public comments';
COMMENT ON COLUMN "Comments"."MentionedUserIds" IS 'JSON array of user IDs mentioned in this comment using @mention';
COMMENT ON TABLE "CommentAttachments" IS 'File attachments for comments (images, documents, etc.)';
COMMENT ON TABLE "CommentReactions" IS 'Emoji reactions for comments (like, helpful, etc.)';

-- Create view for comment activity with user details
CREATE OR REPLACE VIEW "vw_CommentActivity" AS
SELECT 
    c."CommentId",
    c."RequestId",
    c."Content",
    c."IsInternal",
    c."IsEdited",
    c."CreatedAt",
    c."UpdatedAt",
    c."EditedAt",
    c."ParentCommentId",
    u."Id" as "UserId",
    u."UserName" as "UserName",
    u."Email" as "UserEmail",
    u."Avatar" as "UserAvatar",
    (SELECT COUNT(*) FROM "CommentAttachments" WHERE "CommentId" = c."CommentId") as "AttachmentCount",
    (SELECT COUNT(*) FROM "CommentReactions" WHERE "CommentId" = c."CommentId") as "ReactionCount"
FROM "Comments" c
INNER JOIN "Users" u ON c."UserId" = u."Id"
ORDER BY c."CreatedAt" DESC;

COMMENT ON VIEW "vw_CommentActivity" IS 'Unified view of comments with user details and counts';
