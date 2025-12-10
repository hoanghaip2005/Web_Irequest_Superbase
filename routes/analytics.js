const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/auth');
const { query } = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Analytics Dashboard
router.get('/', authenticateToken, async (req, res) => {
  try {
    const period = req.query.period || '30';

    // Get comprehensive statistics with error handling
    const statsQuery = `
      SELECT 
        COUNT(*) as "totalRequests",
        COUNT(*) FILTER (WHERE s."IsFinal" = true) as "completedRequests",
        COUNT(*) FILTER (WHERE s."IsFinal" = false OR s."IsFinal" IS NULL) as "inProgressRequests",
        COUNT(*) FILTER (WHERE r."CreatedAt" >= NOW() - INTERVAL '7 days') as "newThisWeek",
        COALESCE(AVG(EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600) 
          FILTER (WHERE s."IsFinal" = true), 0) as "avgCompletionHours",
        COUNT(DISTINCT r."UsersId") as "uniqueUsers",
        COUNT(DISTINCT r."AssignedUserId") FILTER (WHERE r."AssignedUserId" IS NOT NULL) as "activeAgents"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      WHERE r."CreatedAt" >= NOW() - INTERVAL '${period} days'
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0] || {
      totalRequests: 0,
      completedRequests: 0,
      inProgressRequests: 0,
      newThisWeek: 0,
      avgCompletionHours: 0,
      uniqueUsers: 0,
      activeAgents: 0,
    };

    // Format average completion time
    const avgHours = parseFloat(stats.avgCompletionHours) || 0;
    stats.avgCompletionTime =
      avgHours > 24
        ? `${Math.round(avgHours / 24)} ngày`
        : `${Math.round(avgHours)} giờ`;

    // Get top employees by performance with error handling
    const topEmployeesQuery = `
      SELECT 
        u."Id",
        u."UserName",
        u."Avatar",
        u."Email",
        COUNT(r."RequestID") as "totalHandled",
        COUNT(r."RequestID") FILTER (WHERE s."IsFinal" = true) as "completedCount",
        COALESCE(AVG(rr."Rating"), 0) as "avgRating",
        COALESCE(AVG(EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600) 
          FILTER (WHERE s."IsFinal" = true), 0) as "avgResponseTime"
      FROM "Users" u
      INNER JOIN "Requests" r ON r."AssignedUserId" = u."Id"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "RequestRatings" rr ON rr."RequestID" = r."RequestID"
      WHERE r."CreatedAt" >= NOW() - INTERVAL '${period} days'
      GROUP BY u."Id", u."UserName", u."Avatar", u."Email"
      HAVING COUNT(r."RequestID") > 0
      ORDER BY "completedCount" DESC, "avgRating" DESC
      LIMIT 10
    `;

    const topEmployeesResult = await query(topEmployeesQuery);
    const topEmployees = topEmployeesResult.rows.map((emp) => ({
      ...emp,
      avgRating: Math.round(emp.avgRating * 10) / 10,
      avgResponseTime: emp.avgResponseTime
        ? Math.round(emp.avgResponseTime)
        : 0,
    }));

    // Get department statistics with error handling
    const departmentStatsQuery = `
      SELECT 
        d."Name" as "departmentName",
        COUNT(r."RequestID") as "totalRequests",
        COUNT(r."RequestID") FILTER (WHERE s."IsFinal" = true) as "completed",
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600)::numeric, 2), 0) as "avgHours"
      FROM "Departments" d
      LEFT JOIN "Users" u ON u."DepartmentID" = d."DepartmentID"
      LEFT JOIN "Requests" r ON r."AssignedUserId" = u."Id"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      WHERE (r."CreatedAt" >= NOW() - INTERVAL '${period} days' OR r."CreatedAt" IS NULL)
      GROUP BY d."DepartmentID", d."Name"
      HAVING COUNT(r."RequestID") > 0
      ORDER BY "totalRequests" DESC
    `;

    const deptStatsResult = await query(departmentStatsQuery);
    const departmentStats = deptStatsResult.rows || [];

    res.render('analytics/index', {
      title: 'Thống kê & Phân tích',
      page: 'analytics',
      period,
      stats,
      topEmployees,
      departmentStats,
      user: req.user,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('errors/500', { error: error.message });
  }
});

// API: Get chart data for analytics
router.get('/api/chart-data', authenticateToken, async (req, res) => {
  try {
    const { type, period } = req.query;

    let days = 7;
    if (period === 'month') days = 30;
    if (period === 'quarter') days = 90;
    if (period === 'year') days = 365;

    if (type === 'trend') {
      const trendQuery = `
        WITH date_series AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '${days} days',
            CURRENT_DATE,
            '1 day'::interval
          )::date AS date
        )
        SELECT 
          ds.date,
          COALESCE(created.count, 0) as created,
          COALESCE(completed.count, 0) as completed
        FROM date_series ds
        LEFT JOIN (
          SELECT DATE(r."CreatedAt") as date, COUNT(*) as count
          FROM "Requests" r
          WHERE r."CreatedAt" >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE(r."CreatedAt")
        ) created ON ds.date = created.date
        LEFT JOIN (
          SELECT DATE(r."UpdatedAt") as date, COUNT(*) as count
          FROM "Requests" r
          LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
          WHERE s."IsFinal" = true
          AND r."UpdatedAt" >= CURRENT_DATE - INTERVAL '${days} days'
          GROUP BY DATE(r."UpdatedAt")
        ) completed ON ds.date = completed.date
        ORDER BY ds.date
      `;

      const result = await query(trendQuery);
      return res.json({ success: true, data: result.rows });
    }

    if (type === 'status') {
      const statusQuery = `
        SELECT 
          COALESCE(s."StatusName", 'Chưa phân loại') as status,
          COUNT(*) as count
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        WHERE r."CreatedAt" >= NOW() - INTERVAL '${days} days'
        GROUP BY s."StatusName"
        ORDER BY count DESC
      `;

      const result = await query(statusQuery);
      return res.json({ success: true, data: result.rows });
    }

    if (type === 'priority') {
      const priorityQuery = `
        SELECT 
          COALESCE(p."PriorityName", 'Chưa xác định') as priority,
          COUNT(*) as count
        FROM "Requests" r
        LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
        WHERE r."CreatedAt" >= NOW() - INTERVAL '${days} days'
        GROUP BY p."PriorityName"
        ORDER BY 
          CASE p."PriorityName"
            WHEN 'Cao' THEN 1
            WHEN 'Trung bình' THEN 2
            WHEN 'Thấp' THEN 3
            ELSE 4
          END
      `;

      const result = await query(priorityQuery);
      return res.json({ success: true, data: result.rows });
    }

    if (type === 'department') {
      const deptQuery = `
        SELECT 
          d."Name" as department,
          COUNT(r."RequestID") as count
        FROM "Departments" d
        LEFT JOIN "Users" u ON u."DepartmentID" = d."DepartmentID"
        LEFT JOIN "Requests" r ON r."AssignedUserId" = u."Id"
        WHERE r."CreatedAt" >= NOW() - INTERVAL '${days} days' OR r."CreatedAt" IS NULL
        GROUP BY d."DepartmentID", d."Name"
        HAVING COUNT(r."RequestID") > 0
        ORDER BY count DESC
        LIMIT 10
      `;

      const result = await query(deptQuery);
      return res.json({ success: true, data: result.rows });
    }

    res.status(400).json({ success: false, error: 'Invalid chart type' });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export to Excel
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const period = req.query.period || '30';

    // Get all requests data
    const requestsQuery = `
      SELECT 
        r."RequestID",
        r."Title",
        r."Description",
        r."CreatedAt",
        r."UpdatedAt",
        s."StatusName",
        p."PriorityName",
        creator."UserName" as "CreatedBy",
        assignee."UserName" as "AssignedTo",
        d."Name" as "Department",
        EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600 as "hoursToComplete"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      LEFT JOIN "Departments" d ON assignee."DepartmentID" = d."DepartmentID"
      WHERE r."CreatedAt" >= NOW() - INTERVAL '${period} days'
      ORDER BY r."CreatedAt" DESC
    `;

    const result = await query(requestsQuery);
    const requests = result.rows;

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Analytics Report');

    // Add header
    worksheet.columns = [
      { header: 'ID', key: 'RequestID', width: 10 },
      { header: 'Tiêu đề', key: 'Title', width: 40 },
      { header: 'Trạng thái', key: 'StatusName', width: 15 },
      { header: 'Ưu tiên', key: 'PriorityName', width: 12 },
      { header: 'Người tạo', key: 'CreatedBy', width: 20 },
      { header: 'Người xử lý', key: 'AssignedTo', width: 20 },
      { header: 'Phòng ban', key: 'Department', width: 20 },
      { header: 'Ngày tạo', key: 'CreatedAt', width: 18 },
      { header: 'Thời gian xử lý (giờ)', key: 'hoursToComplete', width: 18 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0052CC' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    requests.forEach((req) => {
      worksheet.addRow({
        ...req,
        CreatedAt: new Date(req.CreatedAt).toLocaleString('vi-VN'),
        hoursToComplete: req.hoursToComplete
          ? Math.round(req.hoursToComplete * 10) / 10
          : '',
      });
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=analytics-report-${Date.now()}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Không thể xuất báo cáo Excel' });
  }
});

// Export to PDF
router.get('/export/pdf', authenticateToken, async (req, res) => {
  try {
    const period = req.query.period || '30';

    // Get statistics for PDF
    const statsQuery = `
      SELECT 
        COUNT(*) as "totalRequests",
        COUNT(*) FILTER (WHERE s."IsFinal" = true) as "completedRequests",
        COUNT(*) FILTER (WHERE s."IsFinal" = false OR s."IsFinal" IS NULL) as "inProgressRequests",
        AVG(EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600) 
          FILTER (WHERE s."IsFinal" = true) as "avgCompletionHours"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      WHERE r."CreatedAt" >= NOW() - INTERVAL '${period} days'
    `;

    const statsResult = await query(statsQuery);
    const stats = statsResult.rows[0];

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=analytics-report-${Date.now()}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(20).text('BÁO CÁO PHÂN TÍCH YÊU CẦU', { align: 'center' });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(`Kỳ báo cáo: ${period} ngày gần nhất`, { align: 'center' });
    doc.moveDown(2);

    // Add statistics
    doc.fontSize(16).text('Tổng quan', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Tổng số yêu cầu: ${stats.totalRequests || 0}`);
    doc.text(`Yêu cầu hoàn thành: ${stats.completedRequests || 0}`);
    doc.text(`Yêu cầu đang xử lý: ${stats.inProgressRequests || 0}`);

    const avgHours = parseFloat(stats.avgCompletionHours) || 0;
    const avgTime =
      avgHours > 24
        ? `${Math.round(avgHours / 24)} ngày`
        : `${Math.round(avgHours)} giờ`;
    doc.text(`Thời gian xử lý trung bình: ${avgTime}`);

    doc.moveDown(2);
    doc.fontSize(10).text(`Ngày tạo: ${new Date().toLocaleString('vi-VN')}`, {
      align: 'center',
    });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Không thể xuất báo cáo PDF' });
  }
});

module.exports = router;
