const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const Request = require('../models/Request');
const { query } = require('../config/database');

// Trang chủ
router.get('/', (req, res) => {
  res.render('index', {
    title: 'iRequest - Hệ thống quản lý yêu cầu',
    user: req.session.user,
  });
});

// Dashboard (cần đăng nhập)
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.Id;

    // Get comprehensive dashboard statistics
    const statsQuery = `
      SELECT 
        -- Total system requests (exclude drafts)
        (SELECT COUNT(*) FROM "Requests" r
         LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
         WHERE s."StatusName" != 'Nháp' OR s."StatusName" IS NULL) as "totalRequests",
        
        -- My Requests (created by me, exclude drafts)
        (SELECT COUNT(*) FROM "Requests" r
         LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
         WHERE r."UsersId" = $1 
         AND (s."StatusName" != 'Nháp' OR s."StatusName" IS NULL)) as "myRequests",
        
        -- Assigned to me (exclude drafts)
        (SELECT COUNT(*) FROM "Requests" r
         LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
         WHERE r."AssignedUserId" = $1
         AND (s."StatusName" != 'Nháp' OR s."StatusName" IS NULL)) as "assignedToMe",
        
        -- In Progress (not final status, assigned to me or created by me, exclude drafts)
        (SELECT COUNT(*) FROM "Requests" r
         LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
         WHERE (r."UsersId" = $1 OR r."AssignedUserId" = $1) 
         AND (s."IsFinal" = false OR s."IsFinal" IS NULL)
         AND (s."StatusName" != 'Nháp' OR s."StatusName" IS NULL)) as "inProgress",
        
        -- Pending requests (not final status, exclude drafts)
        (SELECT COUNT(*) FROM "Requests" r
         LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
         WHERE (r."UsersId" = $1 OR r."AssignedUserId" = $1) 
         AND (s."IsFinal" = false OR s."IsFinal" IS NULL)
         AND (s."StatusName" != 'Nháp' OR s."StatusName" IS NULL)) as "pendingRequests",
         
        -- Completed requests (final status, exclude drafts)
        (SELECT COUNT(*) FROM "Requests" r
         LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
         WHERE (r."UsersId" = $1 OR r."AssignedUserId" = $1) 
         AND s."IsFinal" = true
         AND (s."StatusName" != 'Nháp' OR s."StatusName" IS NULL)) as "completedRequests"
    `;

    const statsResult = await query(statsQuery, [userId]);
    const stats = statsResult.rows[0];

    // Get all departments for filter
    const departmentsQuery = `
      SELECT "DepartmentID", "Name" 
      FROM "Departments" 
      ORDER BY "Name"
    `;
    const departmentsResult = await query(departmentsQuery);
    const departments = departmentsResult.rows;

    // Get all priorities for filter
    const prioritiesQuery = `
      SELECT "PriorityID", "PriorityName" 
      FROM "Priority" 
      ORDER BY 
        CASE "PriorityName"
          WHEN 'Cao' THEN 1
          WHEN 'Trung bình' THEN 2
          WHEN 'Thấp' THEN 3
          ELSE 4
        END
    `;
    const prioritiesResult = await query(prioritiesQuery);
    const priorities = prioritiesResult.rows;

    // Get recent requests (last 7 days)
    const recentRequestsQuery = `
      SELECT 
        r."RequestID",
        r."Title",
        r."CreatedAt",
        r."UpdatedAt",
        s."StatusName",
        s."IsFinal",
        p."PriorityName",
        creator."UserName" as "CreatedByName",
        assignee."UserName" as "AssignedToName",
        CASE 
          WHEN r."UsersId" = $1 THEN 'created'
          WHEN r."AssignedUserId" = $1 THEN 'assigned'
          ELSE 'other'
        END as "relationType"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      WHERE (r."UsersId" = $1 OR r."AssignedUserId" = $1)
        AND r."CreatedAt" >= NOW() - INTERVAL '7 days'
      ORDER BY r."UpdatedAt" DESC
      LIMIT 10
    `;

    const recentRequestsResult = await query(recentRequestsQuery, [userId]);
    const recentRequests = recentRequestsResult.rows;

    // Get upcoming tasks (assigned to me, not completed)
    const upcomingTasksQuery = `
      SELECT 
        r."RequestID",
        r."Title",
        r."CreatedAt",
        s."StatusName",
        p."PriorityName",
        creator."UserName" as "CreatedByName"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      WHERE r."AssignedUserId" = $1
        AND (s."IsFinal" = false OR s."IsFinal" IS NULL)
      ORDER BY 
        CASE p."PriorityName"
          WHEN 'Cao' THEN 1
          WHEN 'Trung bình' THEN 2
          WHEN 'Thấp' THEN 3
          ELSE 4
        END,
        r."CreatedAt" ASC
      LIMIT 5
    `;

    const upcomingTasksResult = await query(upcomingTasksQuery, [userId]);
    const upcomingTasks = upcomingTasksResult.rows;

    // Get notification count
    const notificationQuery = `
      SELECT COUNT(*) as count 
      FROM "Notifications" 
      WHERE "UserId" = $1 AND "IsRead" = false
    `;

    const notificationResult = await query(notificationQuery, [userId]);
    const unreadNotifications = notificationResult.rows[0]?.count || 0;

    // Get user department
    const userDeptQuery = `
      SELECT d."Name" as "DepartmentName"
      FROM "Users" u
      LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
      WHERE u."Id" = $1
    `;

    const userDeptResult = await query(userDeptQuery, [userId]);
    const department = userDeptResult.rows[0]?.DepartmentName || 'N/A';

    res.render('dashboard', {
      title: 'Tổng quan',
      page: 'dashboard',
      layout: 'main',
      user: {
        ...req.user,
        UserName: req.user.UserName || req.user.userName,
        department: department,
      },
      stats: {
        totalRequests: parseInt(stats.totalRequests) || 0,
        myRequests: parseInt(stats.myRequests) || 0,
        assignedToMe: parseInt(stats.assignedToMe) || 0,
        inProgress: parseInt(stats.inProgress) || 0,
        pendingRequests: parseInt(stats.pendingRequests) || 0,
        completedRequests: parseInt(stats.completedRequests) || 0,
      },
      departments: departments,
      priorities: priorities,
      recentRequests: recentRequests,
      upcomingTasks: upcomingTasks,
      unreadNotifications: parseInt(unreadNotifications),
      currentDate: new Date(),
      showSuccess: req.query.welcome === 'true',
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', {
      title: 'Tổng quan',
      page: 'dashboard',
      layout: 'main',
      user: {
        ...req.user,
        UserName: req.user.UserName || req.user.userName,
        department: 'N/A',
      },
      stats: {
        myRequests: 0,
        assignedToMe: 0,
        pendingRequests: 0,
        completedRequests: 0,
        totalRequests: 0,
        inProgress: 0,
      },
      departments: [],
      priorities: [],
      recentRequests: [],
      upcomingTasks: [],
      unreadNotifications: 0,
      currentDate: new Date(),
      error: 'Không thể tải dữ liệu dashboard',
    });
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'Về chúng tôi',
  });
});

// API endpoint for dashboard chart data
router.get('/api/dashboard/chart-data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.Id;
    const days = parseInt(req.query.days) || 7;
    const departmentId = req.query.departmentId;
    const priorityId = req.query.priorityId;
    const tab = req.query.tab || 'all'; // all, my, assigned, inProgress

    // Build WHERE clause based on filters
    let whereClause = '';
    let queryParams = [userId];
    let paramCounter = 2;

    // Tab filtering
    if (tab === 'my') {
      whereClause += ` AND r."UsersId" = $1`;
    } else if (tab === 'assigned') {
      whereClause += ` AND r."AssignedUserId" = $1`;
    } else if (tab === 'inProgress') {
      whereClause += ` AND (r."UsersId" = $1 OR r."AssignedUserId" = $1) AND (s."IsFinal" = false OR s."IsFinal" IS NULL)`;
    } else {
      whereClause += ` AND (r."UsersId" = $1 OR r."AssignedUserId" = $1)`;
    }

    // Department filtering
    if (departmentId) {
      whereClause += ` AND u."DepartmentID" = $${paramCounter}`;
      queryParams.push(departmentId);
      paramCounter++;
    }

    // Priority filtering
    if (priorityId) {
      whereClause += ` AND r."PriorityID" = $${paramCounter}`;
      queryParams.push(priorityId);
      paramCounter++;
    }

    // Trend data - requests created and completed over time
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
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        LEFT JOIN "Users" u ON r."UsersId" = u."Id"
        WHERE r."CreatedAt" >= CURRENT_DATE - INTERVAL '${days} days'
        ${whereClause}
        GROUP BY DATE(r."CreatedAt")
      ) created ON ds.date = created.date
      LEFT JOIN (
        SELECT DATE(r."UpdatedAt") as date, COUNT(*) as count
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        LEFT JOIN "Users" u ON r."UsersId" = u."Id"
        WHERE s."IsFinal" = true
        AND r."UpdatedAt" >= CURRENT_DATE - INTERVAL '${days} days'
        ${whereClause}
        GROUP BY DATE(r."UpdatedAt")
      ) completed ON ds.date = completed.date
      ORDER BY ds.date
    `;

    const trendResult = await query(trendQuery, queryParams);

    // Status distribution
    const statusQuery = `
      SELECT 
        COALESCE(s."StatusName", 'Chưa phân loại') as status,
        COUNT(*) as count
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Users" u ON r."UsersId" = u."Id"
      WHERE 1=1 ${whereClause}
      GROUP BY s."StatusName"
      ORDER BY count DESC
    `;

    const statusResult = await query(statusQuery, queryParams);

    // Priority distribution
    const priorityQuery = `
      SELECT 
        COALESCE(p."PriorityName", 'Chưa xác định') as priority,
        COUNT(*) as count
      FROM "Requests" r
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Users" u ON r."UsersId" = u."Id"
      WHERE 1=1 ${whereClause}
      GROUP BY p."PriorityName"
      ORDER BY 
        CASE p."PriorityName"
          WHEN 'Cao' THEN 1
          WHEN 'Trung bình' THEN 2
          WHEN 'Thấp' THEN 3
          ELSE 4
        END
    `;

    const priorityResult = await query(priorityQuery, queryParams);

    res.json({
      trend: trendResult.rows,
      status: statusResult.rows,
      priority: priorityResult.rows,
    });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ error: 'Không thể tải dữ liệu biểu đồ' });
  }
});

// API để test database connection
router.get('/api/health', async (req, res) => {
  try {
    const { testConnection } = require('../config/database');
    const dbStatus = await testConnection();

    res.json({
      status: 'OK',
      database: dbStatus ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      message: error.message,
    });
  }
});

module.exports = router;
