const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Trang thông báo chính
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const type = req.query.type || '';
    const status = req.query.status || '';
    const dateRange = req.query.dateRange || '';

    let whereConditions = ['"UserId" = $1'];
    let queryParams = [req.user.Id];
    let paramIndex = 2;

    // Filter by type
    if (type) {
      whereConditions.push(`"Type" = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    // Filter by read status
    if (status === 'unread') {
      whereConditions.push('"IsRead" = false');
    } else if (status === 'read') {
      whereConditions.push('"IsRead" = true');
    }

    // Filter by date range
    if (dateRange) {
      const now = new Date();
      let startDate;

      switch (dateRange) {
        case 'today':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;
        case 'yesterday':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1
          );
          const endDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          whereConditions.push(
            `"CreatedAt" >= $${paramIndex} AND "CreatedAt" < $${paramIndex + 1}`
          );
          queryParams.push(startDate.toISOString(), endDate.toISOString());
          paramIndex += 2;
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          whereConditions.push(`"CreatedAt" >= $${paramIndex}`);
          queryParams.push(startDate.toISOString());
          paramIndex++;
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          whereConditions.push(`"CreatedAt" >= $${paramIndex}`);
          queryParams.push(startDate.toISOString());
          paramIndex++;
          break;
      }

      if (dateRange === 'today') {
        whereConditions.push(`"CreatedAt" >= $${paramIndex}`);
        queryParams.push(startDate.toISOString());
        paramIndex++;
      }
    }

    const whereClause = whereConditions.join(' AND ');
    const offset = (page - 1) * limit;

    // Get notifications
    const notificationQuery = `
            SELECT n.*, r."Title" as "RequestTitle"
            FROM "Notifications" n
            LEFT JOIN "Requests" r ON n."RequestId" = r."RequestID"
            WHERE ${whereClause}
            ORDER BY n."CreatedAt" DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

    const notifications = await query(notificationQuery, [
      ...queryParams,
      limit,
      offset,
    ]);

    // Get total count
    const countQuery = `
            SELECT COUNT(*) as total
            FROM "Notifications"
            WHERE ${whereClause}
        `;
    const countResult = await query(countQuery, queryParams);
    const totalCount = countResult.rows[0].total;

    // Get statistics
    const statsQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN "IsRead" = false THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN "IsRead" = true THEN 1 ELSE 0 END) as read
            FROM "Notifications"
            WHERE "UserId" = $1
        `;
    const statsResult = await query(statsQuery, [req.user.Id]);
    const stats = statsResult.rows[0];

    const totalPages = Math.ceil(totalCount / limit);

    res.render('notifications/index', {
      title: 'Thông báo',
      page: 'notifications',
      notifications: notifications.rows || [],
      stats: stats || { total: 0, unread: 0, important: 0, readToday: 0 },
      filters: { type, status, dateRange },
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: totalCount,
        startRecord: (page - 1) * limit + 1,
        endRecord: Math.min(page * limit, totalCount),
        showPagination: totalPages > 1,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
        previousPage: page - 1,
        nextPage: page + 1,
        pages: Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
          return {
            number: pageNum,
            active: pageNum === page,
          };
        }),
      },
    });
  } catch (error) {
    console.error('Notifications error:', error);
    res.render('notifications/index', {
      title: 'Thông báo',
      page: 'notifications',
      error: 'Không thể tải danh sách thông báo',
      notifications: [],
      stats: { total: 0, unread: 0, important: 0, readToday: 0 },
      filters: {},
      pagination: { currentPage: 1, totalPages: 0, totalRecords: 0 },
    });
  }
});

// API endpoints for notification management

// IMPORTANT: Specific routes MUST come before parameterized routes
// Otherwise /:id will match everything including /mark-all-read

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'UPDATE "Notifications" SET "IsRead" = true WHERE "UserId" = $1 AND "IsRead" = false',
      [req.user.Id]
    );

    res.json({
      success: true,
      message: `Đã đánh dấu ${result.rowCount} thông báo là đã đọc`,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể cập nhật trạng thái thông báo',
    });
  }
});

// Clear read notifications
router.delete('/clear-read', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM "Notifications" WHERE "UserId" = $1 AND "IsRead" = true',
      [req.user.Id]
    );

    res.json({
      success: true,
      message: `Đã xóa ${result.rowCount} thông báo đã đọc`,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Clear read notifications error:', error);
    res.status(500).json({ success: false, error: 'Không thể xóa thông báo' });
  }
});

// Mark single notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    await query(
      'UPDATE "Notifications" SET "IsRead" = true WHERE "Id" = $1 AND "UserId" = $2',
      [notificationId, req.user.Id]
    );

    res.json({ success: true, message: 'Đã đánh dấu là đã đọc' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể cập nhật trạng thái thông báo',
    });
  }
});

// Delete single notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    await query(
      'DELETE FROM "Notifications" WHERE "Id" = $1 AND "UserId" = $2',
      [notificationId, req.user.Id]
    );

    res.json({ success: true, message: 'Đã xóa thông báo' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: 'Không thể xóa thông báo' });
  }
});

// Get unread count for navigation badge
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM "Notifications" WHERE "UserId" = $1 AND "IsRead" = false',
      [req.user.Id]
    );

    res.json({ count: result.rows[0].count });
  } catch (error) {
    console.error('Unread count error:', error);
    res.json({ count: 0 });
  }
});

// Server-Sent Events for real-time notifications
router.get('/stream', authenticateToken, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection confirmation
  res.write('data: {"type": "connected"}\n\n');

  // Set up periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write('data: {"type": "heartbeat"}\n\n');
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// ==========================================
// API ENDPOINTS FOR NOTIFICATIONS
// ==========================================

/**
 * API: Get notifications list
 * When accessed via /api/notifications/ (from app.js mount)
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    console.log('📬 API: Fetching notifications for user:', req.user.Id);

    // Get recent 20 notifications
    const notificationsResult = await query(
      `
      SELECT 
        "Id",
        "UserId",
        "Type",
        "Title",
        "Content",
        "Link",
        "IsRead",
        "CreatedAt"
      FROM "Notifications"
      WHERE "UserId" = $1
      ORDER BY "CreatedAt" DESC
      LIMIT 20
    `,
      [req.user.Id]
    );

    // Count unread notifications
    const unreadResult = await query(
      `
      SELECT COUNT(*)::int as count
      FROM "Notifications"
      WHERE "UserId" = $1 AND "IsRead" = false
    `,
      [req.user.Id]
    );

    const unreadCount = unreadResult.rows[0]?.count || 0;

    console.log(
      `✅ Found ${notificationsResult.rows.length} notifications, ${unreadCount} unread`
    );

    res.json({
      success: true,
      notifications: notificationsResult.rows,
      unreadCount: unreadCount,
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải thông báo',
      error: error.message,
    });
  }
});

/**
 * Mark single notification as read
 * Route: POST /api/notifications/:id/read
 */
router.post('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;
    console.log(`📝 API: Marking notification ${notificationId} as read`);

    // Update notification
    const result = await query(
      `
      UPDATE "Notifications"
      SET "IsRead" = true, "UpdatedAt" = NOW()
      WHERE "Id" = $1 AND "UserId" = $2
      RETURNING "Id"
    `,
      [notificationId, req.user.Id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo',
      });
    }

    console.log(`✅ Notification ${notificationId} marked as read`);

    res.json({
      success: true,
      message: 'Đã đánh dấu là đã đọc',
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Có lỗi xảy ra',
      error: error.message,
    });
  }
});

module.exports = router;
