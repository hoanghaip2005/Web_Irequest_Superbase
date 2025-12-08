const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Reports Dashboard
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, department, status } = req.query;

    // Build filters
    let filters = [];
    let params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      params.push(startDate);
      filters.push(`r."CreatedAt" >= $${paramCount}`);
    }

    if (endDate) {
      paramCount++;
      params.push(endDate);
      filters.push(`r."CreatedAt" <= $${paramCount}`);
    }

    if (department) {
      paramCount++;
      params.push(department);
      filters.push(`u."DepartmentID" = $${paramCount}`);
    }

    if (status) {
      paramCount++;
      params.push(status);
      filters.push(`r."StatusID" = $${paramCount}`);
    }

    const whereClause =
      filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

    // Get requests report
    const reportsQuery = `
      SELECT 
        r."RequestID",
        r."Title",
        r."Description",
        r."CreatedAt",
        r."ClosedAt",
        u."Email" as "CreatorEmail",
        d."Name" as "DepartmentName",
        s."StatusName",
        p."PriorityName",
        EXTRACT(EPOCH FROM (COALESCE(r."ClosedAt", NOW()) - r."CreatedAt"))/3600 as "hoursElapsed"
      FROM "Requests" r
      LEFT JOIN "Users" u ON r."UsersId" = u."Id"
      LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      ${whereClause}
      ORDER BY r."CreatedAt" DESC
      LIMIT 100
    `;

    const reportsResult = await query(reportsQuery, params);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as "totalRequests",
        COUNT(*) FILTER (WHERE s."StatusName" = 'Completed') as "completed",
        COUNT(*) FILTER (WHERE s."StatusName" IN ('Pending', 'Open')) as "pending",
        AVG(EXTRACT(EPOCH FROM (r."ClosedAt" - r."CreatedAt"))/3600) FILTER (WHERE r."ClosedAt" IS NOT NULL) as "avgHours"
      FROM "Requests" r
      LEFT JOIN "Users" u ON r."UsersId" = u."Id"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      ${whereClause}
    `;

    const summaryResult = await query(summaryQuery, params);

    // Get departments for filter
    const departmentsResult = await query(
      `SELECT "DepartmentID", "Name" FROM "Departments" WHERE "IsActive" = true ORDER BY "Name"`
    );

    // Get statuses for filter
    const statusesResult = await query(
      `SELECT "StatusID", "StatusName" FROM "Status" ORDER BY "StatusName"`
    );

    res.render('reports/index', {
      title: 'Báo cáo',
      page: 'reports',
      reports: reportsResult.rows,
      summary: summaryResult.rows[0],
      departments: departmentsResult.rows,
      statuses: statusesResult.rows,
      filters: { startDate, endDate, department, status },
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      error: error.message,
    });
  }
});

// Export report
router.get('/export', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement CSV/Excel export
    res.json({ success: false, message: 'Chức năng đang phát triển' });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
