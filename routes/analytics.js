const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Analytics Dashboard
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as "totalRequests",
        COUNT(*) FILTER (WHERE "Status" = 'Completed') as "completedRequests",
        COUNT(*) FILTER (WHERE "Status" = 'In Progress') as "inProgressRequests",
        AVG(EXTRACT(EPOCH FROM ("CompletedAt" - "CreatedAt"))/3600) as "avgCompletionHours"
      FROM "Requests"
      WHERE "CreatedAt" >= NOW() - INTERVAL '30 days'
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    // Format average completion time
    const avgHours = parseFloat(stats.avgCompletionHours) || 0;
    stats.avgCompletionTime =
      avgHours > 24
        ? `${Math.round(avgHours / 24)} ngày`
        : `${Math.round(avgHours)} giờ`;

    // Get top employees
    const topEmployeesQuery = `
      SELECT 
        u."Id",
        u."UserName",
        u."Avatar",
        COUNT(r."Id") as "completedCount",
        COALESCE(AVG(rr."Rating"), 0) as "rating"
      FROM "Users" u
      LEFT JOIN "Requests" r ON r."AssignedTo" = u."Id" AND r."Status" = 'Completed'
      LEFT JOIN "RequestRatings" rr ON rr."RequestId" = r."Id"
      WHERE r."CreatedAt" >= NOW() - INTERVAL '30 days'
      GROUP BY u."Id", u."UserName", u."Avatar"
      ORDER BY "completedCount" DESC
      LIMIT 10
    `;

    const topEmployeesResult = await query(topEmployeesQuery);
    const topEmployees = topEmployeesResult.rows.map((emp) => ({
      ...emp,
      rating: Math.round(emp.rating * 10) / 10,
    }));

    res.render('analytics/index', {
      title: 'Thống kê & Phân tích',
      page: 'analytics',
      stats,
      topEmployees,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('errors/500', { error: error.message });
  }
});

// API: Get chart data
router.get('/api/chart-data', authenticateToken, async (req, res) => {
  try {
    const { type, period } = req.query;

    let dateFilter = "NOW() - INTERVAL '7 days'";
    if (period === 'month') dateFilter = "NOW() - INTERVAL '30 days'";
    if (period === 'quarter') dateFilter = "NOW() - INTERVAL '90 days'";
    if (period === 'year') dateFilter = "NOW() - INTERVAL '1 year'";

    if (type === 'trend') {
      const trendQuery = `
        SELECT 
          DATE("CreatedAt") as date,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE "Status" = 'Completed') as completed
        FROM "Requests"
        WHERE "CreatedAt" >= ${dateFilter}
        GROUP BY DATE("CreatedAt")
        ORDER BY date
      `;

      const result = await query(trendQuery);
      return res.json({ success: true, data: result.rows });
    }

    if (type === 'status') {
      const statusQuery = `
        SELECT 
          "Status" as status,
          COUNT(*) as count
        FROM "Requests"
        WHERE "CreatedAt" >= ${dateFilter}
        GROUP BY "Status"
      `;

      const result = await query(statusQuery);
      return res.json({ success: true, data: result.rows });
    }

    res.json({ success: false, message: 'Invalid chart type' });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
