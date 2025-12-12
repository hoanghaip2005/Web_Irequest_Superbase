-- =============================================
-- NOTIFICATIONS TABLE INDEXES FOR FILTERING
-- Migration: 011_add_notifications_indexes.sql
-- =============================================

-- Index cho UserId (có thể đã tồn tại)
CREATE INDEX IF NOT EXISTS idx_notifications_userid 
ON "Notifications" ("UserId");

-- Index cho Type filter
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON "Notifications" ("Type");

-- Index cho IsRead filter
CREATE INDEX IF NOT EXISTS idx_notifications_isread 
ON "Notifications" ("IsRead");

-- Index cho CreatedAt (sort và date range filter)
CREATE INDEX IF NOT EXISTS idx_notifications_createdat 
ON "Notifications" ("CreatedAt" DESC);

-- Composite index cho filter thường dùng: UserId + IsRead + CreatedAt
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_date 
ON "Notifications" ("UserId", "IsRead", "CreatedAt" DESC);

-- Composite index cho filter: UserId + Type + CreatedAt
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_date 
ON "Notifications" ("UserId", "Type", "CreatedAt" DESC);

-- Composite index toàn diện: UserId + Type + IsRead + CreatedAt
-- Tối ưu cho query phức tạp với nhiều filter
CREATE INDEX IF NOT EXISTS idx_notifications_comprehensive 
ON "Notifications" ("UserId", "Type", "IsRead", "CreatedAt" DESC);

-- =============================================
-- VERIFY INDEXES
-- =============================================

-- Check all indexes on Notifications table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'Notifications'
ORDER BY indexname;

-- =============================================
-- PERFORMANCE NOTES
-- =============================================

-- 1. Single column indexes:
--    - Fast lookup cho single filter
--    - UserId: Required cho WHERE UserId = ?
--    - Type: Khi filter theo loại thông báo
--    - IsRead: Khi filter unread/read
--    - CreatedAt: Sorting và date range

-- 2. Composite indexes:
--    - Tối ưu cho multiple filters
--    - Thứ tự columns quan trọng: UserId (most selective) → Type/IsRead → CreatedAt
--    - PostgreSQL có thể dùng partial index

-- 3. Query patterns:
--    WHERE UserId = ? ORDER BY CreatedAt DESC
--    WHERE UserId = ? AND Type = ? ORDER BY CreatedAt DESC
--    WHERE UserId = ? AND IsRead = false ORDER BY CreatedAt DESC
--    WHERE UserId = ? AND Type = ? AND IsRead = false ORDER BY CreatedAt DESC

-- =============================================
-- USAGE EXAMPLES
-- =============================================

-- Query 1: Get unread notifications (uses idx_notifications_user_read_date)
EXPLAIN ANALYZE
SELECT * FROM "Notifications"
WHERE "UserId" = '1' AND "IsRead" = false
ORDER BY "CreatedAt" DESC
LIMIT 15;

-- Query 2: Get notifications by type (uses idx_notifications_user_type_date)
EXPLAIN ANALYZE
SELECT * FROM "Notifications"
WHERE "UserId" = '1' AND "Type" = 'comment'
ORDER BY "CreatedAt" DESC
LIMIT 15;

-- Query 3: Complex filter (uses idx_notifications_comprehensive)
EXPLAIN ANALYZE
SELECT * FROM "Notifications"
WHERE "UserId" = '1' 
  AND "Type" = 'request' 
  AND "IsRead" = false
ORDER BY "CreatedAt" DESC
LIMIT 15;

-- =============================================
-- MAINTENANCE
-- =============================================

-- Reindex if needed (sau khi insert/update nhiều)
REINDEX TABLE "Notifications";

-- Analyze table statistics
ANALYZE "Notifications";

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'Notifications'
ORDER BY idx_scan DESC;

-- =============================================
-- CLEANUP (if needed to recreate)
-- =============================================

/*
DROP INDEX IF EXISTS idx_notifications_userid;
DROP INDEX IF EXISTS idx_notifications_type;
DROP INDEX IF EXISTS idx_notifications_isread;
DROP INDEX IF EXISTS idx_notifications_createdat;
DROP INDEX IF EXISTS idx_notifications_user_read_date;
DROP INDEX IF EXISTS idx_notifications_user_type_date;
DROP INDEX IF EXISTS idx_notifications_comprehensive;
*/
