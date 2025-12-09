-- Add IsActive column to Requests table for soft delete functionality
-- This allows marking requests as deleted without losing historical data

-- Add IsActive column with default value TRUE for existing records
ALTER TABLE "Requests" 
ADD COLUMN "IsActive" BOOLEAN NOT NULL DEFAULT TRUE;

-- Add index for performance when filtering active requests
CREATE INDEX "IX_Requests_IsActive" ON "Requests" ("IsActive");

-- Add comment to document the column purpose
COMMENT ON COLUMN "Requests"."IsActive" IS 'Indicates if the request is active (not soft-deleted). FALSE means the request has been deleted by user.';
