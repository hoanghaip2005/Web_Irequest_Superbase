-- Migration: Create Group Chat Tables
-- Description: Create tables for group chat functionality

-- Step 1: Create ChatGroups table (no dependencies)
CREATE TABLE IF NOT EXISTS "ChatGroups" (
    "GroupId" SERIAL PRIMARY KEY,
    "GroupName" VARCHAR(255) NOT NULL,
    "Description" TEXT,
    "CreatedBy" INTEGER,
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Add foreign key to ChatGroups after table exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_created_by' 
        AND table_name = 'ChatGroups'
    ) THEN
        ALTER TABLE "ChatGroups"
        ADD CONSTRAINT fk_created_by
            FOREIGN KEY ("CreatedBy")
            REFERENCES "Users"("Id")
            ON DELETE SET NULL;
    END IF;
END $$;

-- Step 3: Create GroupMembers table (depends on ChatGroups and Users)
CREATE TABLE IF NOT EXISTS "GroupMembers" (
    "MemberId" SERIAL PRIMARY KEY,
    "GroupId" INTEGER NOT NULL,
    "UserId" INTEGER NOT NULL,
    "Role" VARCHAR(50) DEFAULT 'member',
    "JoinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Add foreign keys to GroupMembers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_group' 
        AND table_name = 'GroupMembers'
    ) THEN
        ALTER TABLE "GroupMembers"
        ADD CONSTRAINT fk_group
            FOREIGN KEY ("GroupId")
            REFERENCES "ChatGroups"("GroupId")
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_user' 
        AND table_name = 'GroupMembers'
    ) THEN
        ALTER TABLE "GroupMembers"
        ADD CONSTRAINT fk_user
            FOREIGN KEY ("UserId")
            REFERENCES "Users"("Id")
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'GroupMembers_GroupId_UserId_key' 
        AND table_name = 'GroupMembers'
    ) THEN
        ALTER TABLE "GroupMembers"
        ADD CONSTRAINT "GroupMembers_GroupId_UserId_key" UNIQUE("GroupId", "UserId");
    END IF;
END $$;

-- Step 5: Create GroupMessages table (depends on ChatGroups and Users)
CREATE TABLE IF NOT EXISTS "GroupMessages" (
    "MessageId" SERIAL PRIMARY KEY,
    "GroupId" INTEGER NOT NULL,
    "SenderId" INTEGER NOT NULL,
    "Message" TEXT,
    "FileURL" TEXT,
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "IsRead" BOOLEAN DEFAULT false
);

-- Step 6: Add foreign keys to GroupMessages
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_group_msg' 
        AND table_name = 'GroupMessages'
    ) THEN
        ALTER TABLE "GroupMessages"
        ADD CONSTRAINT fk_group_msg
            FOREIGN KEY ("GroupId")
            REFERENCES "ChatGroups"("GroupId")
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_sender' 
        AND table_name = 'GroupMessages'
    ) THEN
        ALTER TABLE "GroupMessages"
        ADD CONSTRAINT fk_sender
            FOREIGN KEY ("SenderId")
            REFERENCES "Users"("Id")
            ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_by ON "ChatGroups"("CreatedBy");
CREATE INDEX IF NOT EXISTS idx_chat_groups_created_at ON "ChatGroups"("CreatedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON "GroupMembers"("GroupId");
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON "GroupMembers"("UserId");

CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON "GroupMessages"("GroupId");
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON "GroupMessages"("SenderId");
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON "GroupMessages"("CreatedAt" DESC);

-- Add comments
COMMENT ON TABLE "ChatGroups" IS 'Stores group chat information';
COMMENT ON TABLE "GroupMembers" IS 'Stores group chat members';
COMMENT ON TABLE "GroupMessages" IS 'Stores messages in group chats';
