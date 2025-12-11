const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Reports Dashboard
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, department, status, priority } = req.query;

    // Build filters
    let filters = [];
    let params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      params.push(startDate);
      filters.push(`r."CreatedAt" >= $${paramCount}`);
    } else {
      // Default to last 30 days
      filters.push(`r."CreatedAt" >= NOW() - INTERVAL '30 days'`);
    }

    if (endDate) {
      paramCount++;
      params.push(endDate);
      filters.push(`r."CreatedAt" <= $${paramCount}`);
    }

    if (department) {
      paramCount++;
      params.push(department);
      filters.push(`assignee."DepartmentID" = $${paramCount}`);
    }

    if (status) {
      paramCount++;
      params.push(status);
      filters.push(`r."StatusID" = $${paramCount}`);
    }

    if (priority) {
      paramCount++;
      params.push(priority);
      filters.push(`r."PriorityID" = $${paramCount}`);
    }

    const whereClause =
      filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
    
    // Exclude drafts
    const draftFilter = filters.length > 0 
      ? ` AND (s."StatusName" IS NULL OR s."StatusName" != 'Nháp')`
      : `WHERE (s."StatusName" IS NULL OR s."StatusName" != 'Nháp')`;

    // Get requests report
    const reportsQuery = `
      SELECT 
        r."RequestID",
        r."Title",
        r."Description",
        r."CreatedAt",
        r."UpdatedAt",
        creator."UserName" as "CreatedBy",
        creator."Email" as "CreatorEmail",
        assignee."UserName" as "AssignedTo",
        d."Name" as "DepartmentName",
        s."StatusName",
        s."IsFinal",
        p."PriorityName",
        EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600 as "hoursElapsed",
        (SELECT COUNT(*) FROM "Comments" WHERE "RequestID" = r."RequestID") as "commentCount"
      FROM "Requests" r
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      LEFT JOIN "Departments" d ON assignee."DepartmentID" = d."DepartmentID"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      ${whereClause}
      ${draftFilter}
      ORDER BY r."CreatedAt" DESC
      LIMIT 500
    `;

    const reportsResult = await query(reportsQuery, params);

    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(*) as "totalRequests",
        COUNT(*) FILTER (WHERE s."IsFinal" = true) as "completed",
        COUNT(*) FILTER (WHERE s."IsFinal" = false OR s."IsFinal" IS NULL) as "pending",
        AVG(EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600) 
          FILTER (WHERE s."IsFinal" = true) as "avgHours",
        MIN(r."CreatedAt") as "earliestDate",
        MAX(r."CreatedAt") as "latestDate"
      FROM "Requests" r
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      ${whereClause}
      ${draftFilter}
    `;

    const summaryResult = await query(summaryQuery, params);
    const summary = summaryResult.rows[0];

    // Format average hours - Làm tròn 2 chữ số thập phân
    const avgHours = parseFloat(summary.avgHours) || 0;
    summary.avgHoursRaw = avgHours.toFixed(2);
    summary.avgTime = avgHours > 24 
      ? `${(avgHours / 24).toFixed(1)} ngày`
      : `${avgHours.toFixed(1)} giờ`;

    // Get departments for filter
    const departmentsResult = await query(
      `SELECT "DepartmentID", "Name" FROM "Departments" WHERE "IsActive" = true ORDER BY "Name"`
    );

    // Get statuses for filter
    const statusesResult = await query(
      `SELECT "StatusID", "StatusName" FROM "Status" ORDER BY "StatusName"`
    );

    // Get priorities for filter
    const prioritiesResult = await query(
      `SELECT "PriorityID", "PriorityName" FROM "Priority" ORDER BY "PriorityID"`
    );

    res.render('reports/index', {
      title: 'Báo cáo',
      page: 'reports',
      reports: reportsResult.rows,
      summary,
      departments: departmentsResult.rows,
      statuses: statusesResult.rows,
      priorities: prioritiesResult.rows,
      filters: { startDate, endDate, department, status, priority },
      user: req.user,
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).render('errors/500', { error: error.message });
  }
});

// Export Report to Excel
router.get('/export/excel', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, department, status, priority } = req.query;

    // Build filters (same as above)
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
      filters.push(`assignee."DepartmentID" = $${paramCount}`);
    }

    if (status) {
      paramCount++;
      params.push(status);
      filters.push(`r."StatusID" = $${paramCount}`);
    }

    if (priority) {
      paramCount++;
      params.push(priority);
      filters.push(`r."PriorityID" = $${paramCount}`);
    }

    const whereClause =
      filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

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
        creator."Email" as "CreatorEmail",
        assignee."UserName" as "AssignedTo",
        assignee."Email" as "AssigneeEmail",
        d."Name" as "Department",
        EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600 as "hoursToComplete",
        (SELECT COUNT(*) FROM "Comments" WHERE "RequestID" = r."RequestID") as "commentCount"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      LEFT JOIN "Departments" d ON assignee."DepartmentID" = d."DepartmentID"
      ${whereClause}
      ORDER BY r."CreatedAt" DESC
    `;

    const result = await query(requestsQuery, params);
    const requests = result.rows;

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo yêu cầu');

    // Set worksheet properties
    worksheet.properties.defaultRowHeight = 20;

    // Add header with company info
    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = 'BÁO CÁO YÊU CẦU - iREQUEST';
    worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0052CC' },
    };
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 30;

    // Add filter info
    worksheet.mergeCells('A2:K2');
    const filterInfo = [];
    if (startDate) filterInfo.push(`Từ: ${new Date(startDate).toLocaleDateString('vi-VN')}`);
    if (endDate) filterInfo.push(`Đến: ${new Date(endDate).toLocaleDateString('vi-VN')}`);
    worksheet.getCell('A2').value = filterInfo.length > 0 ? filterInfo.join(' | ') : 'Tất cả thời gian';
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    worksheet.getCell('A2').font = { italic: true };

    // Add column headers
    worksheet.addRow([]);
    const headerRow = worksheet.addRow([
      'ID',
      'Tiêu đề',
      'Mô tả',
      'Trạng thái',
      'Ưu tiên',
      'Người tạo',
      'Email người tạo',
      'Người xử lý',
      'Phòng ban',
      'Ngày tạo',
      'Thời gian xử lý (giờ)',
      'Số bình luận',
    ]);

    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0052CC' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Set column widths
    worksheet.columns = [
      { key: 'RequestID', width: 8 },
      { key: 'Title', width: 35 },
      { key: 'Description', width: 45 },
      { key: 'StatusName', width: 15 },
      { key: 'PriorityName', width: 12 },
      { key: 'CreatedBy', width: 20 },
      { key: 'CreatorEmail', width: 25 },
      { key: 'AssignedTo', width: 20 },
      { key: 'Department', width: 20 },
      { key: 'CreatedAt', width: 18 },
      { key: 'hoursToComplete', width: 18 },
      { key: 'commentCount', width: 15 },
    ];

    // Add data rows
    requests.forEach((req, index) => {
      const row = worksheet.addRow({
        RequestID: req.RequestID,
        Title: req.Title,
        Description: req.Description || '',
        StatusName: req.StatusName,
        PriorityName: req.PriorityName,
        CreatedBy: req.CreatedBy,
        CreatorEmail: req.CreatorEmail,
        AssignedTo: req.AssignedTo || 'Chưa gán',
        Department: req.Department || 'N/A',
        CreatedAt: new Date(req.CreatedAt).toLocaleString('vi-VN'),
        hoursToComplete: req.hoursToComplete ? Math.round(req.hoursToComplete * 10) / 10 : '',
        commentCount: req.commentCount || 0,
      });

      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' },
        };
      }

      // Color code by priority
      const priorityCell = row.getCell(5);
      if (req.PriorityName === 'Cao') {
        priorityCell.font = { color: { argb: 'FFFF0000' }, bold: true };
      } else if (req.PriorityName === 'Trung bình') {
        priorityCell.font = { color: { argb: 'FFFF8800' } };
      } else {
        priorityCell.font = { color: { argb: 'FF00AA00' } };
      }
    });

    // Add summary at the end
    worksheet.addRow([]);
    const summaryRow = worksheet.addRow([
      'TỔNG KẾT',
      `Tổng: ${requests.length} yêu cầu`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`,
      '',
      '',
    ]);
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=bao-cao-yeu-cau-${Date.now()}.xlsx`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Không thể xuất báo cáo Excel' });
  }
});

// Export Report to PDF
router.get('/export/pdf', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, department, status, priority } = req.query;

    // Build filters (same as above)
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
      filters.push(`assignee."DepartmentID" = $${paramCount}`);
    }

    if (status) {
      paramCount++;
      params.push(status);
      filters.push(`r."StatusID" = $${paramCount}`);
    }

    if (priority) {
      paramCount++;
      params.push(priority);
      filters.push(`r."PriorityID" = $${paramCount}`);
    }

    const whereClause =
      filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

    // Get statistics for PDF
    const summaryQuery = `
      SELECT 
        COUNT(*) as "totalRequests",
        COUNT(*) FILTER (WHERE s."IsFinal" = true) as "completedRequests",
        COUNT(*) FILTER (WHERE s."IsFinal" = false OR s."IsFinal" IS NULL) as "inProgressRequests",
        COUNT(*) FILTER (WHERE p."PriorityName" = 'Cao') as "highPriority",
        AVG(EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600) 
          FILTER (WHERE s."IsFinal" = true) as "avgCompletionHours"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      ${whereClause}
    `;

    const statsResult = await query(summaryQuery, params);
    const stats = statsResult.rows[0];

    // Get top 50 requests for PDF
    const requestsQuery = `
      SELECT 
        r."RequestID",
        r."Title",
        r."CreatedAt",
        s."StatusName",
        p."PriorityName",
        creator."UserName" as "CreatedBy",
        assignee."UserName" as "AssignedTo"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      ${whereClause}
      ORDER BY r."CreatedAt" DESC
      LIMIT 50
    `;

    const requestsResult = await query(requestsQuery, params);
    const requests = requestsResult.rows;

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=bao-cao-yeu-cau-${Date.now()}.pdf`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(22).text('BÁO CÁO YÊU CẦU - iREQUEST', { align: 'center', underline: true });
    doc.moveDown();

    // Add filter info
    doc.fontSize(10);
    if (startDate || endDate) {
      let period = 'Kỳ báo cáo: ';
      if (startDate) period += `Từ ${new Date(startDate).toLocaleDateString('vi-VN')} `;
      if (endDate) period += `đến ${new Date(endDate).toLocaleDateString('vi-VN')}`;
      doc.text(period, { align: 'center' });
    } else {
      doc.text('Kỳ báo cáo: Tất cả thời gian', { align: 'center' });
    }
    doc.moveDown(2);

    // Add statistics section
    doc.fontSize(16).text('TỔNG QUAN', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Tổng số yêu cầu: ${stats.totalRequests || 0}`);
    doc.text(`Yêu cầu hoàn thành: ${stats.completedRequests || 0}`);
    doc.text(`Yêu cầu đang xử lý: ${stats.inProgressRequests || 0}`);
    doc.text(`Yêu cầu ưu tiên cao: ${stats.highPriority || 0}`);
    
    const avgHours = parseFloat(stats.avgCompletionHours) || 0;
    const avgTime = avgHours > 24 
      ? `${Math.round(avgHours / 24)} ngày`
      : `${Math.round(avgHours)} giờ`;
    doc.text(`Thời gian xử lý trung bình: ${avgTime}`);

    doc.moveDown(2);

    // Add requests list (top 50)
    doc.fontSize(16).text('CHI TIẾT YÊU CẦU (Top 50)', { underline: true });
    doc.moveDown();
    doc.fontSize(10);

    requests.forEach((req, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.text(`${index + 1}. [#${req.RequestID}] ${req.Title}`, { continued: false });
      doc.fontSize(9);
      doc.text(`   Trạng thái: ${req.StatusName} | Ưu tiên: ${req.PriorityName}`, { indent: 20 });
      doc.text(`   Người tạo: ${req.CreatedBy} | Người xử lý: ${req.AssignedTo || 'Chưa gán'}`, { indent: 20 });
      doc.text(`   Ngày tạo: ${new Date(req.CreatedAt).toLocaleString('vi-VN')}`, { indent: 20 });
      doc.moveDown(0.5);
      doc.fontSize(10);
    });

    // Add footer
    doc.moveDown(2);
    doc.fontSize(9).text(`Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`, {
      align: 'center',
    });
    doc.text(`Người xuất: ${req.user.UserName}`, {
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
