-- Migration: Fix ChatGroups Schema Inconsistencies
-- Description: This script standardizes the ChatGroups table to use UUID-based primary key
-- Run this if you encounter errors creating groups

-- Check if we need to migrate from old schema (GroupId, GroupName, CreatedBy) 
-- to new schema (Id, Name, CreatedById)

DO $$
DECLARE
    has_old_schema BOOLEAN := FALSE;
    has_new_schema BOOLEAN := FALSE;
BEGIN
    -- Check for old schema columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ChatGroups' AND column_name = 'GroupId'
    ) INTO has_old_schema;
    
    -- Check for new schema columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ChatGroups' AND column_name = 'Id'
    ) INTO has_new_schema;
    
    RAISE NOTICE 'Old schema exists: %', has_old_schema;
    RAISE NOTICE 'New schema exists: %', has_new_schema;
    
    -- If we have old schema but not new, we need to migrate
    IF has_old_schema AND NOT has_new_schema THEN
        RAISE NOTICE 'Migrating from old schema to new UUID-based schema...';
        
        -- Step 1: Drop foreign key constraints on dependent tables
        ALTER TABLE "GroupMembers" DROP CONSTRAINT IF EXISTS fk_group;
        ALTER TABLE "GroupMembers" DROP CONSTRAINT IF EXISTS fk_group_members_group;
        ALTER TABLE "GroupMessages" DROP CONSTRAINT IF EXISTS fk_group_msg;
        ALTER TABLE "GroupMessages" DROP CONSTRAINT IF EXISTS fk_group_messages_group;
        
        -- Step 2: Add new UUID column to ChatGroups
        ALTER TABLE "ChatGroups" ADD COLUMN IF NOT EXISTS "Id" UUID DEFAULT gen_random_uuid();
        
        -- Step 3: Update all rows to have UUID
        UPDATE "ChatGroups" SET "Id" = gen_random_uuid() WHERE "Id" IS NULL;
        
        -- Step 4: Add new columns with standard names
        ALTER TABLE "ChatGroups" ADD COLUMN IF NOT EXISTS "Name" VARCHAR(255);
        ALTER TABLE "ChatGroups" ADD COLUMN IF NOT EXISTS "CreatedById" VARCHAR(255);
        
        -- Step 5: Copy data from old columns to new columns
        UPDATE "ChatGroups" SET "Name" = "GroupName" WHERE "Name" IS NULL;
        UPDATE "ChatGroups" SET "CreatedById" = "CreatedBy"::VARCHAR WHERE "CreatedById" IS NULL;
        
        -- Step 6: Update GroupMembers to use UUID
        ALTER TABLE "GroupMembers" ADD COLUMN IF NOT EXISTS "NewGroupId" UUID;
        UPDATE "GroupMembers" gm 
        SET "NewGroupId" = cg."Id" 
        FROM "ChatGroups" cg 
        WHERE cg."GroupId" = gm."GroupId"::INTEGER;
        
        -- Step 7: Drop old GroupId column and rename new one
        ALTER TABLE "GroupMembers" DROP COLUMN IF EXISTS "GroupId";
        ALTER TABLE "GroupMembers" RENAME COLUMN "NewGroupId" TO "GroupId";
        
        -- Step 8: Update GroupMessages to use UUID  
        ALTER TABLE "GroupMessages" ADD COLUMN IF NOT EXISTS "NewGroupId" UUID;
        UPDATE "GroupMessages" gm 
        SET "NewGroupId" = cg."Id" 
        FROM "ChatGroups" cg 
        WHERE cg."GroupId" = gm."GroupId"::INTEGER;
        
        -- Step 9: Drop old GroupId column and rename new one
        ALTER TABLE "GroupMessages" DROP COLUMN IF EXISTS "GroupId";
        ALTER TABLE "GroupMessages" RENAME COLUMN "NewGroupId" TO "GroupId";
        
        -- Step 10: Make UserId VARCHAR in child tables if needed
        ALTER TABLE "GroupMembers" ALTER COLUMN "UserId" TYPE VARCHAR(255);
        ALTER TABLE "GroupMessages" ALTER COLUMN "SenderId" TYPE VARCHAR(255);
        
        -- Step 11: Drop old primary key and create new one
        ALTER TABLE "ChatGroups" DROP CONSTRAINT IF EXISTS "ChatGroups_pkey";
        ALTER TABLE "ChatGroups" ADD PRIMARY KEY ("Id");
        
        -- Step 12: Recreate foreign keys with correct references
        ALTER TABLE "GroupMembers" 
            ADD CONSTRAINT fk_group_members_group
            FOREIGN KEY ("GroupId")
            REFERENCES "ChatGroups"("Id")
            ON DELETE CASCADE;
            
        ALTER TABLE "GroupMembers" 
            ADD CONSTRAINT fk_group_members_user
            FOREIGN KEY ("UserId")
            REFERENCES "Users"("Id")
            ON DELETE CASCADE;
            
        ALTER TABLE "GroupMessages" 
            ADD CONSTRAINT fk_group_messages_group
            FOREIGN KEY ("GroupId")
            REFERENCES "ChatGroups"("Id")
            ON DELETE CASCADE;
            
        ALTER TABLE "GroupMessages" 
            ADD CONSTRAINT fk_group_messages_sender
            FOREIGN KEY ("SenderId")
            REFERENCES "Users"("Id")
            ON DELETE CASCADE;
        
        -- Step 13: Drop old columns from ChatGroups
        ALTER TABLE "ChatGroups" DROP COLUMN IF EXISTS "GroupId";
        ALTER TABLE "ChatGroups" DROP COLUMN IF EXISTS "GroupName";
        ALTER TABLE "ChatGroups" DROP COLUMN IF EXISTS "CreatedBy";
        
        -- Step 14: Make new columns NOT NULL
        ALTER TABLE "ChatGroups" ALTER COLUMN "Id" SET NOT NULL;
        ALTER TABLE "ChatGroups" ALTER COLUMN "Name" SET NOT NULL;
        ALTER TABLE "GroupMembers" ALTER COLUMN "GroupId" SET NOT NULL;
        ALTER TABLE "GroupMessages" ALTER COLUMN "GroupId" SET NOT NULL;
        
        RAISE NOTICE 'Migration completed successfully!';
    ELSIF has_new_schema THEN
        RAISE NOTICE 'Database already using new UUID-based schema. No migration needed.';
    ELSE
        RAISE NOTICE 'No ChatGroups table found. Creating new table with UUID schema...';
        
        -- Create ChatGroups table with UUID schema
        CREATE TABLE IF NOT EXISTS "ChatGroups" (
            "Id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            "Name" VARCHAR(255) NOT NULL,
            "Description" TEXT,
            "CreatedById" VARCHAR(255),
            "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "UpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_chatgroups_creator
                FOREIGN KEY ("CreatedById")
                REFERENCES "Users"("Id")
                ON DELETE SET NULL
        );
        
        RAISE NOTICE 'ChatGroups table created with UUID schema.';
    END IF;
END $$;

-- Ensure GroupMembers and GroupMessages tables exist with correct schema
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON "GroupMembers"("GroupId");
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON "GroupMembers"("UserId");
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON "GroupMessages"("GroupId");
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON "GroupMessages"("SenderId");
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON "GroupMessages"("CreatedAt" DESC);

-- Add helpful comments
COMMENT ON TABLE "ChatGroups" IS 'Group chat rooms with UUID-based IDs';
COMMENT ON TABLE "GroupMembers" IS 'Members of group chats';
COMMENT ON TABLE "GroupMessages" IS 'Messages in group chats';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed! ChatGroups schema is now standardized.';
    RAISE NOTICE '📋 Schema summary:';
    RAISE NOTICE '  - ChatGroups uses UUID for Id';
    RAISE NOTICE '  - GroupMembers and GroupMessages reference ChatGroups.Id';
    RAISE NOTICE '  - All foreign keys are properly configured';
END $$;
