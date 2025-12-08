const express = require('express');
const router = express.Router();
const {
  authenticateToken,
  checkResourceAccess,
  canProcessRequest,
} = require('../middleware/auth');
const Request = require('../models/Request');
const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(
      null,
      Date.now() +
        '-' +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Configure multer for comment attachments
const commentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/comments/');
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const uploadCommentAttachment = multer({
  storage: commentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5, // Max 5 files per upload
  },
  fileFilter: function (req, file, cb) {
    // Allowed file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, documents, and archives are allowed!'));
    }
  },
});

// Danh sách requests
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const statusId = req.query.status || '';
    const priorityId = req.query.priority || '';

    const filters = {
      userId: req.user.Id,
      search,
      statusId: statusId || undefined,
      priorityId: priorityId || undefined,
    };

    const [requests, totalCount] = await Promise.all([
      Request.getAll(page, limit, filters),
      Request.count(filters),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render('requests/index', {
      title: 'Danh sách yêu cầu',
      requests,
      currentPage: page,
      totalPages,
      totalCount,
      search,
      statusFilter: statusId,
      priorityFilter: priorityId,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  } catch (error) {
    console.error('Requests list error:', error);
    res.render('requests/index', {
      title: 'Danh sách yêu cầu',
      error: 'Không thể tải danh sách yêu cầu',
      requests: [],
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
    });
  }
});

// Route cho "Yêu cầu của tôi"
// Redirect /my to /my/kanban (Kanban is default view now)
router.get('/my', authenticateToken, (req, res) => {
  res.redirect('/requests/my/kanban');
});

// List view (alternative to Kanban)
router.get('/my/list', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const statusId = req.query.status || '';
    const priorityId = req.query.priority || '';

    const filters = {
      creatorId: req.user.Id, // Chỉ lấy yêu cầu do user tạo
      search,
      statusId: statusId || undefined,
      priorityId: priorityId || undefined,
    };

    const [
      requests,
      totalCount,
      statuses,
      priorities,
      workflows,
      requestTypes,
    ] = await Promise.all([
      Request.getByCreator(page, limit, filters),
      Request.countByCreator(filters),
      Request.getStatuses(),
      Request.getPriorities(),
      Request.getWorkflows(),
      Request.getRequestTypes(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Tính stats
    const stats = await Request.getStatsForUser(req.user.Id);

    res.render('requests/my', {
      title: 'My Requests',
      page: 'my-requests',
      requests,
      stats,
      statuses,
      priorities,
      workflows,
      requestTypes,
      filters: { search, status: statusId, priority: priorityId },
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
    console.error('My requests error:', error);
    res.render('requests/my', {
      title: 'Yêu cầu của tôi',
      page: 'my-requests',
      error: 'Không thể tải danh sách yêu cầu',
      requests: [],
      stats: { total: 0, pending: 0, inProgress: 0, completed: 0 },
      statuses: [],
      priorities: [],
      filters: {},
      pagination: { currentPage: 1, totalPages: 0, totalRecords: 0 },
    });
  }
});

// Route Kanban Board cho "Yêu cầu của tôi"
router.get('/my/kanban', authenticateToken, async (req, res) => {
  try {
    // Get all statuses
    const statusesResult = await query(`
      SELECT "StatusID", "StatusName", "Description", "IsFinal"
      FROM "Status"
      ORDER BY "StatusID" ASC
    `);

    // Get requests grouped by status
    // Admin xem tất cả yêu cầu, user thường chỉ xem yêu cầu của mình
    let requestsQuery, requestsParams;

    if (req.user.isAdmin) {
      requestsQuery = `
        SELECT 
          r."RequestID",
          r."Title",
          r."Description",
          r."CreatedAt",
          r."StatusID",
          s."StatusName",
          p."PriorityID",
          p."PriorityName",
          creator."Email" as "CreatorEmail",
          assignee."Email" as "AssignedToEmail"
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
        LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
        LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
        ORDER BY r."CreatedAt" DESC
      `;
      requestsParams = [];
    } else {
      requestsQuery = `
        SELECT 
          r."RequestID",
          r."Title",
          r."Description",
          r."CreatedAt",
          r."StatusID",
          s."StatusName",
          p."PriorityID",
          p."PriorityName",
          u."Email" as "AssignedToEmail"
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
        LEFT JOIN "Users" u ON r."AssignedUserId" = u."Id"
        WHERE r."UsersId" = $1
        ORDER BY r."CreatedAt" DESC
      `;
      requestsParams = [req.user.Id];
    }

    const requestsResult = await query(requestsQuery, requestsParams);

    // Group requests by status
    const statuses = statusesResult.rows.map((status) => ({
      ...status,
      requests: requestsResult.rows.filter(
        (req) => req.StatusID === status.StatusID
      ),
    }));

    // Get statistics
    let statsQuery, statsParams;

    if (req.user.isAdmin) {
      statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE s."StatusName" = 'Pending') as pending,
          COUNT(*) FILTER (WHERE s."StatusName" = 'In Progress') as "inProgress",
          COUNT(*) FILTER (WHERE s."StatusName" = 'Completed') as completed
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      `;
      statsParams = [];
    } else {
      statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE s."StatusName" = 'Pending') as pending,
          COUNT(*) FILTER (WHERE s."StatusName" = 'In Progress') as "inProgress",
          COUNT(*) FILTER (WHERE s."StatusName" = 'Completed') as completed
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        WHERE r."UsersId" = $1
      `;
      statsParams = [req.user.Id];
    }

    const statsResult = await query(statsQuery, statsParams);
    const stats = statsResult.rows[0];

    res.render('requests/kanban', {
      title: req.user.isAdmin
        ? 'Kanban Board - Tất cả yêu cầu'
        : 'Kanban Board - Yêu cầu của tôi',
      page: 'my-requests',
      statuses,
      stats,
      user: req.user,
    });
  } catch (error) {
    console.error('Kanban board error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      error: error.message,
    });
  }
});

// Route cho "Yêu cầu được giao"
router.get('/assigned', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const statusId = req.query.status || '';
    const priorityId = req.query.priority || '';
    const overdue = req.query.overdue || '';

    const filters = {
      search,
      statusId: statusId || undefined,
      priorityId: priorityId || undefined,
    };

    const [
      requests,
      totalCount,
      statuses,
      priorities,
      workflows,
      requestTypes,
    ] = await Promise.all([
      Request.getAssignedRequests(req.user.Id, page, limit, filters),
      Request.countAssignedRequests(req.user.Id, filters),
      Request.getStatuses(),
      Request.getPriorities(),
      Request.getWorkflows(),
      Request.getRequestTypes(),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Tính stats cho assigned requests
    const stats = await Request.getAssignedStats(req.user.Id);

    res.render('requests/assigned', {
      title: 'Assigned Requests',
      page: 'assigned',
      requests,
      stats,
      statuses,
      priorities,
      workflows,
      requestTypes,
      filters: { search, status: statusId, priority: priorityId, overdue },
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
    console.error('Assigned requests error:', error);
    res.render('requests/assigned', {
      title: 'Yêu cầu được giao',
      page: 'assigned',
      error: 'Không thể tải danh sách yêu cầu được giao',
      requests: [],
      stats: { total: 0, urgent: 0, inProgress: 0, completed: 0 },
      statuses: [],
      priorities: [],
      filters: {},
      pagination: { currentPage: 1, totalPages: 0, totalRecords: 0 },
    });
  }
});

// API endpoint for assigned requests statistics
router.get('/assigned-stats', authenticateToken, async (req, res) => {
  try {
    const stats = await Request.getAssignedStats(req.user.Id);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Assigned stats error:', error);
    res.json({
      success: false,
      error: 'Không thể tải thống kê',
      stats: { total: 0, pending: 0, processing: 0, completedToday: 0 },
    });
  }
});

// Trang tạo request mới
router.get('/create', authenticateToken, async (req, res) => {
  try {
    const [priorities, workflows] = await Promise.all([
      Request.getPriorities(),
      Request.getWorkflows(),
    ]);

    res.render('requests/create', {
      title: 'Tạo yêu cầu mới',
      priorities: priorities,
      workflows: workflows,
    });
  } catch (error) {
    console.error('Error loading create form data:', error);
    res.render('requests/create', {
      title: 'Tạo yêu cầu mới',
      error: 'Không thể tải dữ liệu form',
      priorities: [],
      workflows: [],
    });
  }
});

// Xử lý tạo request mới
router.post(
  '/create',
  authenticateToken,
  upload.single('attachment'),
  async (req, res) => {
    try {
      const { title, description, priorityId, issueType } = req.body;

      if (!title || title.trim().length === 0) {
        const [priorities, workflows] = await Promise.all([
          Request.getPriorities(),
          Request.getWorkflows(),
        ]);

        return res.render('requests/create', {
          title: 'Tạo yêu cầu mới',
          error: 'Tiêu đề không được để trống',
          formData: req.body,
          priorities: priorities,
          workflows: workflows,
        });
      }

      // Lấy status mặc định và workflow dựa trên priority
      const defaultStatus = await query(
        'SELECT "StatusID" FROM "Status" WHERE "StatusName" = $1 LIMIT 1',
        ['Mới']
      );
      const statusId = defaultStatus.rows[0]?.StatusID || 1;

      // Xác định workflow dựa trên priority (có thể customize logic này)
      let workflowId = 1; // Default workflow
      if (priorityId) {
        const priority = await query(
          'SELECT "PriorityName", "SortOrder" FROM "Priority" WHERE "PriorityID" = $1',
          [priorityId]
        );
        const priorityName = priority.rows[0]?.PriorityName;

        // Logic: Priority "Cao" hoặc "Khẩn cấp" dùng urgent workflow
        if (
          priorityName &&
          (priorityName.includes('Cao') || priorityName.includes('Khẩn cấp'))
        ) {
          workflowId = 2; // Urgent workflow nếu có
        }
      }

      const requestData = {
        title: title.trim(),
        description: description?.trim() || '',
        userId: req.user.Id,
        priorityId: priorityId || 2, // Default to medium priority (PriorityID = 2)
        statusId: statusId,
        workflowId: workflowId,
        issueType: issueType || 'General',
        attachmentURL: req.file ? `/uploads/${req.file.filename}` : null,
        attachmentFileName: req.file ? req.file.originalname : null,
        attachmentFileSize: req.file ? req.file.size : null,
        attachmentFileType: req.file ? req.file.mimetype : null,
      };

      const newRequest = await Request.create(requestData);

      res.redirect(`/requests/${newRequest.RequestID}?created=true`);
    } catch (error) {
      console.error('Create request error:', error);

      try {
        const [priorities, workflows] = await Promise.all([
          Request.getPriorities(),
          Request.getWorkflows(),
        ]);

        res.render('requests/create', {
          title: 'Tạo yêu cầu mới',
          error: 'Không thể tạo yêu cầu. Vui lòng thử lại.',
          formData: req.body,
          priorities: priorities,
          workflows: workflows,
        });
      } catch (dbError) {
        console.error('Error loading form data:', dbError);
        res.render('requests/create', {
          title: 'Tạo yêu cầu mới',
          error: 'Đã có lỗi xảy ra. Vui lòng thử lại.',
          formData: req.body,
          priorities: [],
          workflows: [],
        });
      }
    }
  }
);

// Chi tiết request
router.get(
  '/:id',
  authenticateToken,
  checkResourceAccess('request'),
  async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);

      if (isNaN(requestId)) {
        return res.status(404).render('errors/404', {
          title: 'Không tìm thấy',
          message: 'Yêu cầu không tồn tại',
        });
      }

      // Thêm view cho request
      await Request.addView(requestId, req.user.Id);

      const [request, comments] = await Promise.all([
        Request.findById(requestId),
        Request.getComments(requestId),
      ]);

      if (!request) {
        return res.status(404).render('errors/404', {
          title: 'Không tìm thấy',
          message: 'Yêu cầu không tồn tại',
        });
      }

      console.log('Request data:', {
        id: request.Id,
        title: request.Title,
        status: request.StatusName,
        priority: request.PriorityName,
      });

      res.render('requests/detail', {
        title: `Yêu cầu #${requestId}`,
        request,
        comments,
        isOwner: request.UsersId === req.user.Id,
        isAssigned: request.AssignedUserId === req.user.Id,
        showSuccess: req.query.created === 'true',
        success:
          req.query.created === 'true' ? 'Request created successfully!' : null,
      });
    } catch (error) {
      console.error('Request detail error:', error);
      res.status(500).render('errors/500', {
        title: 'Lỗi hệ thống',
        message: 'Không thể tải chi tiết yêu cầu',
      });
    }
  }
);

// Thêm comment
router.post(
  '/:id/comments',
  authenticateToken,
  checkResourceAccess('request'),
  async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.redirect(`/requests/${requestId}?error=empty_comment`);
      }

      await Request.addComment(requestId, req.user.Id, content.trim());

      res.redirect(`/requests/${requestId}#comments`);
    } catch (error) {
      console.error('Add comment error:', error);
      res.redirect(`/requests/${req.params.id}?error=comment_failed`);
    }
  }
);

// Cập nhật trạng thái request
router.post('/:id/status', authenticateToken, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { statusId, note } = req.body;

    // Kiểm tra quyền cập nhật status
    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request không tồn tại' });
    }

    // Chỉ owner hoặc assignee mới có thể cập nhật status
    if (
      request.UsersId !== req.user.Id &&
      request.AssignedUserId !== req.user.Id
    ) {
      return res.status(403).json({ message: 'Không có quyền cập nhật' });
    }

    await Request.updateStatus(requestId, statusId, note);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
    } else {
      res.redirect(`/requests/${requestId}?updated=true`);
    }
  } catch (error) {
    console.error('Update status error:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      res.status(500).json({ message: 'Không thể cập nhật trạng thái' });
    } else {
      res.redirect(`/requests/${req.params.id}?error=update_failed`);
    }
  }
});

// API endpoints

// API: Lấy danh sách requests
router.get('/api/requests', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {
      userId: req.user.Id,
      search: req.query.search,
      statusId: req.query.status,
      priorityId: req.query.priority,
    };

    const [requests, totalCount] = await Promise.all([
      Request.getAll(page, limit, filters),
      Request.count(filters),
    ]);

    res.json({
      requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error('API requests error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Route cho "Yêu cầu được giao"
router.get('/assigned', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const statusId = req.query.status || '';
    const priorityId = req.query.priority || '';

    const filters = {
      search,
      statusId: statusId || undefined,
      priorityId: priorityId || undefined,
    };

    const [requests, totalCount, stats, statuses, priorities] =
      await Promise.all([
        Request.getAssignedRequests(req.user.Id, page, limit, filters),
        Request.countAssignedRequests(req.user.Id, filters),
        Request.getAssignedStats(req.user.Id),
        Request.getStatuses(),
        Request.getPriorities(),
      ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render('requests/assigned', {
      title: 'Yêu cầu được giao',
      requests,
      stats,
      statuses,
      priorities,
      currentPage: page,
      totalPages,
      totalCount,
      search,
      statusFilter: statusId,
      priorityFilter: priorityId,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    });
  } catch (error) {
    console.error('Assigned requests error:', error);
    res.render('requests/assigned', {
      title: 'Yêu cầu được giao',
      error: 'Không thể tải danh sách yêu cầu được giao',
      requests: [],
      stats: { total: 0, urgent: 0, pending: 0, completed: 0 },
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
    });
  }
});

// Phê duyệt request
router.post(
  '/:id/approve',
  authenticateToken,
  canProcessRequest,
  async (req, res) => {
    try {
      const requestId = req.params.id;
      const { note } = req.body;

      // Kiểm tra quyền xử lý
      const canProcess = await Request.canProcessRequest(
        requestId,
        req.user.Id
      );
      if (!canProcess) {
        return res
          .status(403)
          .json({ message: 'Bạn không có quyền xử lý yêu cầu này' });
      }

      await Request.approveRequest(requestId, req.user.Id, note);

      // Tạo notification cho người tạo request
      const request = await Request.findById(requestId);
      if (request && request.UsersId !== req.user.Id) {
        await query(
          `
                INSERT INTO "Notifications" ("Title", "Content", "CreatedAt", "IsRead", "Type", "RequestId", "UserId")
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
          [
            'Yêu cầu được phê duyệt',
            `Yêu cầu "${request.Title}" của bạn đã được phê duyệt`,
            new Date(),
            false,
            'approval',
            requestId,
            request.UsersId,
          ]
        );
      }

      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.json({ success: true, message: 'Đã phê duyệt yêu cầu' });
      } else {
        req.flash('success', 'Đã phê duyệt yêu cầu thành công');
        res.redirect(`/requests/${requestId}`);
      }
    } catch (error) {
      console.error('Approve request error:', error);
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.status(500).json({ message: 'Không thể phê duyệt yêu cầu' });
      } else {
        req.flash('error', 'Không thể phê duyệt yêu cầu');
        res.redirect(`/requests/${req.params.id}`);
      }
    }
  }
);

// Từ chối request
router.post(
  '/:id/reject',
  authenticateToken,
  canProcessRequest,
  async (req, res) => {
    try {
      const requestId = req.params.id;
      const { note } = req.body;

      if (!note) {
        return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối' });
      }

      // Kiểm tra quyền xử lý
      const canProcess = await Request.canProcessRequest(
        requestId,
        req.user.Id
      );
      if (!canProcess) {
        return res
          .status(403)
          .json({ message: 'Bạn không có quyền xử lý yêu cầu này' });
      }

      await Request.rejectRequest(requestId, req.user.Id, note);

      // Tạo notification cho người tạo request
      const request = await Request.findById(requestId);
      if (request && request.UsersId !== req.user.Id) {
        await query(
          `
                INSERT INTO "Notifications" ("Title", "Content", "CreatedAt", "IsRead", "Type", "RequestId", "UserId")
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
          [
            'Yêu cầu bị từ chối',
            `Yêu cầu "${request.Title}" của bạn đã bị từ chối. Lý do: ${note}`,
            new Date(),
            false,
            'rejection',
            requestId,
            request.UsersId,
          ]
        );
      }

      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.json({ success: true, message: 'Đã từ chối yêu cầu' });
      } else {
        req.flash('success', 'Đã từ chối yêu cầu');
        res.redirect('/requests/assigned');
      }
    } catch (error) {
      console.error('Reject request error:', error);
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.status(500).json({ message: 'Không thể từ chối yêu cầu' });
      } else {
        req.flash('error', 'Không thể từ chối yêu cầu');
        res.redirect(`/requests/${req.params.id}`);
      }
    }
  }
);

// Bắt đầu xử lý request
router.post(
  '/:id/start-processing',
  authenticateToken,
  canProcessRequest,
  async (req, res) => {
    try {
      const requestId = req.params.id;

      // Kiểm tra quyền xử lý
      const canProcess = await Request.canProcessRequest(
        requestId,
        req.user.Id
      );
      if (!canProcess) {
        return res
          .status(403)
          .json({ message: 'Bạn không có quyền xử lý yêu cầu này' });
      }

      await Request.startProcessing(requestId);

      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.json({ success: true, message: 'Đã bắt đầu xử lý yêu cầu' });
      } else {
        req.flash('success', 'Đã bắt đầu xử lý yêu cầu');
        res.redirect(`/requests/${requestId}`);
      }
    } catch (error) {
      console.error('Start processing error:', error);
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.status(500).json({ message: 'Không thể bắt đầu xử lý yêu cầu' });
      } else {
        req.flash('error', 'Không thể bắt đầu xử lý yêu cầu');
        res.redirect(`/requests/${req.params.id}`);
      }
    }
  }
);

// API: Tạo request mới
router.post('/api/requests', authenticateToken, async (req, res) => {
  try {
    const requestData = {
      ...req.body,
      userId: req.user.Id,
    };

    const newRequest = await Request.create(requestData);
    res.status(201).json(newRequest);
  } catch (error) {
    console.error('API create request error:', error);
    res.status(500).json({ message: 'Không thể tạo request' });
  }
});

// API: Update request status (for Kanban drag & drop)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { statusId, note, isApproved, rejectionReason } = req.body;

    if (!statusId) {
      return res.status(400).json({
        success: false,
        message: 'StatusID is required',
      });
    }

    if (!note || note.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Note/reason is required',
      });
    }

    // Check if request exists and user has permission
    // Admin có quyền cập nhật tất cả yêu cầu
    let requestQuery, requestParams;

    if (req.user.isAdmin) {
      requestQuery = `
        SELECT r.*, s."StatusName"
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        WHERE r."RequestID" = $1
      `;
      requestParams = [requestId];
    } else {
      requestQuery = `
        SELECT r.*, s."StatusName"
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        WHERE r."RequestID" = $1 AND (r."UsersId" = $2 OR r."AssignedUserId" = $2)
      `;
      requestParams = [requestId, req.user.Id];
    }

    const requestResult = await query(requestQuery, requestParams);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found or you do not have permission',
      });
    }

    const request = requestResult.rows[0];

    // Get new status info
    const newStatusResult = await query(
      `SELECT "StatusName" FROM "Status" WHERE "StatusID" = $1`,
      [statusId]
    );

    if (newStatusResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status ID',
      });
    }

    const newStatus = newStatusResult.rows[0];

    // Update request status and approval if provided
    let updateQuery = `
      UPDATE "Requests" 
      SET "StatusID" = $1, "UpdatedAt" = NOW()
    `;
    let updateParams = [statusId];
    let paramIndex = 2;

    if (typeof isApproved === 'boolean') {
      updateQuery += `, "IsApproved" = $${paramIndex}`;
      updateParams.push(isApproved);
      paramIndex++;

      if (isApproved) {
        updateQuery += `, "ApprovedAt" = NOW()`;
      }
    }

    updateQuery += ` WHERE "RequestID" = $${paramIndex}`;
    updateParams.push(requestId);

    await query(updateQuery, updateParams);

    // Log to RequestHistories
    await query(
      `INSERT INTO "RequestHistories" 
       ("RequestID", "UserID", "Status", "Note", "StartTime")
       VALUES ($1, $2, $3, $4, NOW())`,
      [requestId, req.user.Id, newStatus.StatusName, rejectionReason || note]
    );

    // Create notification for request creator (if not the same user)
    if (request.UsersId !== req.user.Id) {
      let notificationContent = `Yêu cầu "${request.Title}" đã chuyển sang trạng thái: ${newStatus.StatusName}`;

      if (typeof isApproved === 'boolean') {
        notificationContent = isApproved
          ? `Yêu cầu "${request.Title}" đã được phê duyệt`
          : `Yêu cầu "${request.Title}" đã bị từ chối. Lý do: ${rejectionReason || note}`;
      }

      await query(
        `INSERT INTO "Notifications" 
         ("Title", "Content", "CreatedAt", "IsRead", "Type", "RequestId", "UserId")
         VALUES ($1, $2, NOW(), false, 'status_change', $3, $4)`,
        [
          typeof isApproved === 'boolean'
            ? isApproved
              ? 'Yêu cầu được phê duyệt'
              : 'Yêu cầu bị từ chối'
            : 'Trạng thái yêu cầu đã thay đổi',
          notificationContent,
          requestId,
          request.UsersId,
        ]
      );
    }

    res.json({
      success: true,
      message: 'Đã cập nhật trạng thái',
      data: {
        requestId,
        statusId,
        statusName: newStatus.StatusName,
      },
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật trạng thái: ' + error.message,
    });
  }
});

// API: Get request detail
router.get('/:id/api', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    // Check permission
    let requestQuery, requestParams;

    if (req.user.isAdmin) {
      requestQuery = `
        SELECT 
          r.*,
          s."StatusName",
          p."PriorityName",
          creator."Email" as "CreatorEmail",
          assignee."Email" as "AssignedToEmail"
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
        LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
        LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
        WHERE r."RequestID" = $1
      `;
      requestParams = [requestId];
    } else {
      requestQuery = `
        SELECT 
          r.*,
          s."StatusName",
          p."PriorityName",
          creator."Email" as "CreatorEmail",
          assignee."Email" as "AssignedToEmail"
        FROM "Requests" r
        LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
        LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
        LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
        LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
        WHERE r."RequestID" = $1 
          AND (r."UsersId" = $2 OR r."AssignedUserId" = $2)
      `;
      requestParams = [requestId, req.user.Id];
    }

    const result = await query(requestQuery, requestParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found or you do not have permission',
      });
    }

    res.json({
      success: true,
      request: result.rows[0],
    });
  } catch (error) {
    console.error('Get request detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading request: ' + error.message,
    });
  }
});

// ==================== COMMENTS SYSTEM ====================

// GET /requests/:id/comments - Get all comments for a request
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.Id;
    const isAdmin = req.user.isAdmin;

    // First check if user has access to this request
    const requestCheck = await query(
      `SELECT r."RequestID", r."UsersId", r."AssignedUserId"
       FROM "Requests" r
       WHERE r."RequestID" = $1`,
      [requestId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    const request = requestCheck.rows[0];
    const hasAccess =
      isAdmin ||
      request.UsersId === userId ||
      request.AssignedUserId === userId;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this request',
      });
    }

    // Get comments with user details and attachments
    // If user is not admin/staff, only show public comments
    const commentsQuery =
      isAdmin || request.AssignedUserId === userId
        ? `SELECT 
          c."CommentId",
          c."RequestId",
          c."Content",
          c."IsInternal",
          c."IsEdited",
          c."CreatedAt",
          c."UpdatedAt",
          c."EditedAt",
          c."ParentCommentId",
          c."MentionedUserIds",
          u."Id" as "UserId",
          u."UserName",
          u."Email",
          u."Avatar",
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'AttachmentId', ca."AttachmentId",
                'FileName', ca."FileName",
                'FilePath', ca."FilePath",
                'FileSize', ca."FileSize",
                'MimeType', ca."MimeType"
              )
            ) FILTER (WHERE ca."AttachmentId" IS NOT NULL),
            '[]'
          ) as "Attachments",
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'ReactionType', cr."ReactionType",
                'Count', COUNT(cr."ReactionId")
              )
            ) FILTER (WHERE cr."ReactionId" IS NOT NULL),
            '[]'
          ) as "Reactions"
        FROM "Comments" c
        INNER JOIN "Users" u ON c."UserId" = u."Id"
        LEFT JOIN "CommentAttachments" ca ON c."CommentId" = ca."CommentId"
        LEFT JOIN "CommentReactions" cr ON c."CommentId" = cr."CommentId"
        WHERE c."RequestId" = $1
        GROUP BY c."CommentId", u."Id", u."UserName", u."Email", u."Avatar"
        ORDER BY c."CreatedAt" ASC`
        : `SELECT 
          c."CommentId",
          c."RequestId",
          c."Content",
          c."IsInternal",
          c."IsEdited",
          c."CreatedAt",
          c."UpdatedAt",
          c."EditedAt",
          c."ParentCommentId",
          c."MentionedUserIds",
          u."Id" as "UserId",
          u."UserName",
          u."Email",
          u."Avatar",
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'AttachmentId', ca."AttachmentId",
                'FileName', ca."FileName",
                'FilePath', ca."FilePath",
                'FileSize', ca."FileSize",
                'MimeType', ca."MimeType"
              )
            ) FILTER (WHERE ca."AttachmentId" IS NOT NULL),
            '[]'
          ) as "Attachments",
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'ReactionType', cr."ReactionType",
                'Count', COUNT(cr."ReactionId")
              )
            ) FILTER (WHERE cr."ReactionId" IS NOT NULL),
            '[]'
          ) as "Reactions"
        FROM "Comments" c
        INNER JOIN "Users" u ON c."UserId" = u."Id"
        LEFT JOIN "CommentAttachments" ca ON c."CommentId" = ca."CommentId"
        LEFT JOIN "CommentReactions" cr ON c."CommentId" = cr."CommentId"
        WHERE c."RequestId" = $1 AND c."IsInternal" = FALSE
        GROUP BY c."CommentId", u."Id", u."UserName", u."Email", u."Avatar"
        ORDER BY c."CreatedAt" ASC`;

    const result = await query(commentsQuery, [requestId]);

    res.json({
      success: true,
      comments: result.rows,
      canViewInternal: isAdmin || request.AssignedUserId === userId,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading comments: ' + error.message,
    });
  }
});

// POST /requests/:id/comments - Add a new comment
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.Id;
    const isAdmin = req.user.isAdmin;
    const { content, isInternal, mentionedUserIds, parentCommentId } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required',
      });
    }

    // Check if user has access to this request
    const requestCheck = await query(
      `SELECT r."RequestID", r."UsersId", r."AssignedUserId"
       FROM "Requests" r
       WHERE r."RequestID" = $1`,
      [requestId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Request not found',
      });
    }

    const request = requestCheck.rows[0];
    const hasAccess =
      isAdmin ||
      request.UsersId === userId ||
      request.AssignedUserId === userId;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this request',
      });
    }

    // Only admin/assigned staff can create internal notes
    const canCreateInternal = isAdmin || request.AssignedUserId === userId;
    const finalIsInternal = isInternal && canCreateInternal ? true : false;

    // Insert comment
    const insertResult = await query(
      `INSERT INTO "Comments" 
       ("RequestId", "UserId", "Content", "IsInternal", "CreatedAt", "ParentCommentId", "MentionedUserIds")
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)
       RETURNING "CommentId", "CreatedAt"`,
      [
        requestId,
        userId,
        content.trim(),
        finalIsInternal,
        parentCommentId || null,
        mentionedUserIds ? JSON.stringify(mentionedUserIds) : null,
      ]
    );

    const newComment = insertResult.rows[0];

    // Create notifications for mentioned users
    if (
      mentionedUserIds &&
      Array.isArray(mentionedUserIds) &&
      mentionedUserIds.length > 0
    ) {
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId !== userId) {
          await query(
            `INSERT INTO "Notifications" 
             ("UserId", "Title", "Message", "Type", "RelatedId", "IsRead", "CreatedAt")
             VALUES ($1, $2, $3, $4, $5, FALSE, NOW())`,
            [
              mentionedUserId,
              'You were mentioned in a comment',
              `${req.user.UserName || req.user.Email} mentioned you in request #${requestId}`,
              'mention',
              requestId,
            ]
          );
        }
      }
    }

    // Create notification for request creator if it's a new comment (not internal)
    if (!finalIsInternal && request.UsersId !== userId) {
      await query(
        `INSERT INTO "Notifications" 
         ("UserId", "Title", "Message", "Type", "RelatedId", "IsRead", "CreatedAt")
         VALUES ($1, $2, $3, $4, $5, FALSE, NOW())`,
        [
          request.UsersId,
          'New comment on your request',
          `${req.user.UserName || req.user.Email} commented on request #${requestId}`,
          'comment',
          requestId,
        ]
      );
    }

    res.json({
      success: true,
      comment: {
        CommentId: newComment.CommentId,
        CreatedAt: newComment.CreatedAt,
        Content: content.trim(),
        IsInternal: finalIsInternal,
        UserId: userId,
        UserName: req.user.UserName,
        Email: req.user.Email,
        Avatar: req.user.Avatar,
      },
      message: 'Comment added successfully',
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment: ' + error.message,
    });
  }
});

// PUT /requests/comments/:commentId - Update a comment
router.put('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.Id;
    const isAdmin = req.user.isAdmin;
    const { content } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required',
      });
    }

    // Check if comment exists and user is the owner or admin
    const commentCheck = await query(
      `SELECT c."CommentId", c."UserId"
       FROM "Comments" c
       WHERE c."CommentId" = $1`,
      [commentId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const comment = commentCheck.rows[0];
    const canEdit = isAdmin || comment.UserId === userId;

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own comments',
      });
    }

    // Update comment
    await query(
      `UPDATE "Comments" 
       SET "Content" = $1, "IsEdited" = TRUE, "EditedAt" = NOW(), "UpdatedAt" = NOW()
       WHERE "CommentId" = $2`,
      [content.trim(), commentId]
    );

    res.json({
      success: true,
      message: 'Comment updated successfully',
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating comment: ' + error.message,
    });
  }
});

// DELETE /requests/comments/:commentId - Delete a comment
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.Id;
    const isAdmin = req.user.isAdmin;

    // Check if comment exists and user is the owner or admin
    const commentCheck = await query(
      `SELECT c."CommentId", c."UserId"
       FROM "Comments" c
       WHERE c."CommentId" = $1`,
      [commentId]
    );

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const comment = commentCheck.rows[0];
    const canDelete = isAdmin || comment.UserId === userId;

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments',
      });
    }

    // Delete comment (cascades to attachments and reactions)
    await query(`DELETE FROM "Comments" WHERE "CommentId" = $1`, [commentId]);

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting comment: ' + error.message,
    });
  }
});

// POST /requests/comments/:commentId/reactions - Add reaction to comment
router.post(
  '/comments/:commentId/reactions',
  authenticateToken,
  async (req, res) => {
    try {
      const commentId = req.params.commentId;
      const userId = req.user.Id;
      const { reactionType } = req.body;

      // Validate reaction type
      const validReactions = ['like', 'helpful', 'thumbsup', 'thumbsdown'];
      if (!validReactions.includes(reactionType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reaction type',
        });
      }

      // Check if comment exists
      const commentCheck = await query(
        `SELECT "CommentId" FROM "Comments" WHERE "CommentId" = $1`,
        [commentId]
      );

      if (commentCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      // Toggle reaction (insert if not exists, delete if exists)
      const existingReaction = await query(
        `SELECT "ReactionId" FROM "CommentReactions" 
       WHERE "CommentId" = $1 AND "UserId" = $2 AND "ReactionType" = $3`,
        [commentId, userId, reactionType]
      );

      if (existingReaction.rows.length > 0) {
        // Remove reaction
        await query(
          `DELETE FROM "CommentReactions" 
         WHERE "CommentId" = $1 AND "UserId" = $2 AND "ReactionType" = $3`,
          [commentId, userId, reactionType]
        );
        res.json({
          success: true,
          action: 'removed',
          message: 'Reaction removed',
        });
      } else {
        // Add reaction
        await query(
          `INSERT INTO "CommentReactions" ("CommentId", "UserId", "ReactionType", "CreatedAt")
         VALUES ($1, $2, $3, NOW())`,
          [commentId, userId, reactionType]
        );
        res.json({
          success: true,
          action: 'added',
          message: 'Reaction added',
        });
      }
    } catch (error) {
      console.error('Toggle reaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Error toggling reaction: ' + error.message,
      });
    }
  }
);

// POST /requests/comments/:commentId/attachments - Upload files to comment
router.post(
  '/comments/:commentId/attachments',
  authenticateToken,
  uploadCommentAttachment.array('files', 5),
  async (req, res) => {
    try {
      const commentId = req.params.commentId;
      const userId = req.user.Id;
      const files = req.files;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
      }

      // Check if comment exists and user has access
      const commentCheck = await query(
        `SELECT c."CommentId", c."RequestId", c."UserId"
         FROM "Comments" c
         WHERE c."CommentId" = $1`,
        [commentId]
      );

      if (commentCheck.rows.length === 0) {
        // Delete uploaded files if comment not found
        const fs = require('fs');
        files.forEach((file) => {
          fs.unlinkSync(file.path);
        });

        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      const comment = commentCheck.rows[0];

      // Check if user has access to the request
      const requestCheck = await query(
        `SELECT r."RequestID", r."UsersId", r."AssignedUserId"
         FROM "Requests" r
         WHERE r."RequestID" = $1`,
        [comment.RequestId]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Request not found',
        });
      }

      const request = requestCheck.rows[0];
      const hasAccess =
        req.user.isAdmin ||
        request.UsersId === userId ||
        request.AssignedUserId === userId;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this request',
        });
      }

      // Insert attachments into database
      const attachments = [];
      for (const file of files) {
        const result = await query(
          `INSERT INTO "CommentAttachments" 
           ("CommentId", "FileName", "FilePath", "FileSize", "MimeType", "UploadedBy", "CreatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING "AttachmentId", "FileName", "FilePath", "FileSize", "MimeType"`,
          [
            commentId,
            file.originalname,
            '/uploads/comments/' + file.filename,
            file.size,
            file.mimetype,
            userId,
          ]
        );

        attachments.push(result.rows[0]);
      }

      res.json({
        success: true,
        attachments,
        message: `${files.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      console.error('Upload attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading files: ' + error.message,
      });
    }
  }
);

// DELETE /requests/comments/attachments/:attachmentId - Delete attachment
router.delete(
  '/comments/attachments/:attachmentId',
  authenticateToken,
  async (req, res) => {
    try {
      const attachmentId = req.params.attachmentId;
      const userId = req.user.Id;
      const isAdmin = req.user.isAdmin;

      // Get attachment details
      const attachmentCheck = await query(
        `SELECT ca."AttachmentId", ca."FilePath", ca."UploadedBy", c."UserId"
       FROM "CommentAttachments" ca
       INNER JOIN "Comments" c ON ca."CommentId" = c."CommentId"
       WHERE ca."AttachmentId" = $1`,
        [attachmentId]
      );

      if (attachmentCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Attachment not found',
        });
      }

      const attachment = attachmentCheck.rows[0];

      // Check permission (uploader, comment owner, or admin)
      const canDelete =
        isAdmin ||
        attachment.UploadedBy === userId ||
        attachment.UserId === userId;

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this attachment',
        });
      }

      // Delete file from disk
      const fs = require('fs');
      const filePath = path.join(__dirname, '..', attachment.FilePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete from database
      await query(
        `DELETE FROM "CommentAttachments" WHERE "AttachmentId" = $1`,
        [attachmentId]
      );

      res.json({
        success: true,
        message: 'Attachment deleted successfully',
      });
    } catch (error) {
      console.error('Delete attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting attachment: ' + error.message,
      });
    }
  }
);

module.exports = router;
