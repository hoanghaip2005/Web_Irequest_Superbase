-- Migration: Create Group Chat Tables (Compatible with existing ChatGroups)
-- Description: Create GroupMembers and GroupMessages tables that work with existing ChatGroups

-- Create GroupMembers table (using existing ChatGroups with Id as uuid)
CREATE TABLE IF NOT EXISTS "GroupMembers" (
    "MemberId" SERIAL PRIMARY KEY,
    "GroupId" UUID NOT NULL,
    "UserId" VARCHAR(255) NOT NULL,
    "Role" VARCHAR(50) DEFAULT 'member',
    "JoinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_group_members_group
        FOREIGN KEY ("GroupId")
        REFERENCES "ChatGroups"("Id")
        ON DELETE CASCADE,
    CONSTRAINT fk_group_members_user
        FOREIGN KEY ("UserId")
        REFERENCES "Users"("Id")
        ON DELETE CASCADE,
    CONSTRAINT unique_group_user UNIQUE("GroupId", "UserId")
);

-- Create GroupMessages table (using existing ChatGroups with Id as uuid)
CREATE TABLE IF NOT EXISTS "GroupMessages" (
    "MessageId" SERIAL PRIMARY KEY,
    "GroupId" UUID NOT NULL,
    "SenderId" VARCHAR(255) NOT NULL,
    "Message" TEXT,
    "FileURL" TEXT,
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "IsRead" BOOLEAN DEFAULT false,
    CONSTRAINT fk_group_messages_group
        FOREIGN KEY ("GroupId")
        REFERENCES "ChatGroups"("Id")
        ON DELETE CASCADE,
    CONSTRAINT fk_group_messages_sender
        FOREIGN KEY ("SenderId")
        REFERENCES "Users"("Id")
        ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON "GroupMembers"("GroupId");
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON "GroupMembers"("UserId");

CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON "GroupMessages"("GroupId");
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON "GroupMessages"("SenderId");
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON "GroupMessages"("CreatedAt" DESC);

-- Add comments
COMMENT ON TABLE "GroupMembers" IS 'Stores group chat members';
COMMENT ON TABLE "GroupMessages" IS 'Stores messages in group chats';
