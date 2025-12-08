const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Activity Log
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, user, action, startDate, endDate } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    // Build filters
    let filters = [];
    let params = [];
    let paramCount = 0;

    // For now, we'll use RequestHistories as activity log
    const activityQuery = `
      SELECT 
        rh."HistoryID",
        rh."RequestID",
        rh."StartTime",
        rh."EndTime",
        rh."UserID",
        rh."Status",
        rh."Note",
        r."Title" as "RequestTitle",
        u."Email" as "UserEmail"
      FROM "RequestHistories" rh
      LEFT JOIN "Requests" r ON rh."RequestID" = r."RequestID"
      LEFT JOIN "Users" u ON rh."UserID" = u."Id"
      WHERE 1=1
      ${search ? `AND (r."Title" ILIKE '%${search}%' OR rh."Note" ILIKE '%${search}%')` : ''}
      ${user ? `AND rh."UserID" = '${user}'` : ''}
      ${startDate ? `AND rh."StartTime" >= '${startDate}'` : ''}
      ${endDate ? `AND rh."StartTime" <= '${endDate}'` : ''}
      ORDER BY rh."StartTime" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const activityResult = await query(activityQuery);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM "RequestHistories" rh
      LEFT JOIN "Requests" r ON rh."RequestID" = r."RequestID"
      WHERE 1=1
      ${search ? `AND (r."Title" ILIKE '%${search}%' OR rh."Note" ILIKE '%${search}%')` : ''}
      ${user ? `AND rh."UserID" = '${user}'` : ''}
      ${startDate ? `AND rh."StartTime" >= '${startDate}'` : ''}
      ${endDate ? `AND rh."StartTime" <= '${endDate}'` : ''}
    `;

    const countResult = await query(countQuery);
    const totalRecords = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalRecords / limit);

    // Get users for filter
    const usersResult = await query(
      `SELECT "Id", "Email" FROM "Users" ORDER BY "Email" LIMIT 100`
    );

    res.render('activity-log/index', {
      title: 'Lịch sử hoạt động',
      page: 'activity-log',
      activities: activityResult.rows,
      users: usersResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
      },
      filters: { search, user, action, startDate, endDate },
    });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      error: error.message,
    });
  }
});

module.exports = router;
