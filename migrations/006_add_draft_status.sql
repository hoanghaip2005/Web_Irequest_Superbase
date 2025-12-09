-- Migration: Add Draft Status
-- Description: Add a "Nháp" (Draft) status for saving draft requests
-- Date: 2025-12-09

-- Check if "Nháp" status already exists, if not, insert it
INSERT INTO "Status" ("StatusName", "Description", "IsFinal")
SELECT 'Nháp', 'Yêu cầu đang ở dạng nháp, chưa được gửi chính thức', false
WHERE NOT EXISTS (
    SELECT 1 FROM "Status" WHERE "StatusName" = 'Nháp'
);

-- Add comment
COMMENT ON TABLE "Status" IS 'Status table with Draft status for saving incomplete requests';
