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
router.get('/my', authenticateToken, async (req, res) => {
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

// List view (redirect to main /my route)
router.get('/my/list', authenticateToken, (req, res) => {
  // Preserve query parameters
  const queryString = new URLSearchParams(req.query).toString();
  const redirectUrl = queryString
    ? `/requests/my?${queryString}`
    : '/requests/my';
  res.redirect(redirectUrl);
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

    // Get FormSchema for each workflow
    const workflowsWithSchema = await Promise.all(
      workflows.map(async (workflow) => {
        try {
          const formSchema = workflow.FormSchema
            ? typeof workflow.FormSchema === 'string'
              ? JSON.parse(workflow.FormSchema)
              : workflow.FormSchema
            : [];
          return { ...workflow, formFields: formSchema };
        } catch (e) {
          console.error(
            `Error parsing FormSchema for workflow ${workflow.WorkflowID}:`,
            e
          );
          return { ...workflow, formFields: [] };
        }
      })
    );

    res.render('requests/create', {
      title: 'Tạo yêu cầu mới',
      priorities: priorities,
      workflows: workflowsWithSchema,
      workflowsJSON: JSON.stringify(workflowsWithSchema),
    });
  } catch (error) {
    console.error('Error loading create form data:', error);
    res.render('requests/create', {
      title: 'Tạo yêu cầu mới',
      error: 'Không thể tải dữ liệu form',
      priorities: [],
      workflows: [],
      workflowsJSON: '[]',
    });
  }
});

// Trang chỉnh sửa request
router.get('/:id/edit', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.Id;

    // Get request details
    const request = await Request.findById(requestId);

    if (!request) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Yêu cầu không tồn tại',
      });
    }

    // Debug logging
    console.log('Edit permission check:', {
      requestUsersId: request.UsersId,
      currentUserId: userId,
      userIdType: typeof userId,
      requestUserIdType: typeof request.UsersId,
      isAdmin: req.user.isAdmin, // lowercase
      IsAdmin: req.user.IsAdmin, // uppercase
      userRole: req.user.Role,
      roles: req.user.roles,
      areEqual: request.UsersId == userId,
      areStrictEqual: request.UsersId === userId,
    });

    // Check permissions - only creator or admin can edit
    // Use loose equality (==) to handle string/number type mismatch
    if (request.UsersId != userId && !req.user.isAdmin) {
      return res.status(403).render('errors/404', {
        title: 'Không có quyền',
        message: 'Bạn không có quyền chỉnh sửa yêu cầu này',
      });
    }

    // Get priorities and workflows
    const [priorities, workflows] = await Promise.all([
      Request.getPriorities(),
      Request.getWorkflows(),
    ]);

    // Get FormSchema for each workflow
    const workflowsWithSchema = await Promise.all(
      workflows.map(async (workflow) => {
        try {
          const formSchema = workflow.FormSchema
            ? typeof workflow.FormSchema === 'string'
              ? JSON.parse(workflow.FormSchema)
              : workflow.FormSchema
            : [];
          return { ...workflow, formFields: formSchema };
        } catch (e) {
          console.error(
            `Error parsing FormSchema for workflow ${workflow.WorkflowID}:`,
            e
          );
          return { ...workflow, formFields: [] };
        }
      })
    );

    res.render('requests/edit', {
      title: `Chỉnh sửa yêu cầu #${requestId}`,
      request,
      priorities,
      workflows: workflowsWithSchema,
      workflowsJSON: JSON.stringify(workflowsWithSchema),
    });
  } catch (error) {
    console.error('Error loading edit form:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      error: error.message,
    });
  }
});

// Xử lý cập nhật request
router.post(
  '/:id/edit',
  authenticateToken,
  upload.single('attachment'),
  async (req, res) => {
    try {
      const requestId = req.params.id;
      const userId = req.user.Id;

      // Get existing request
      const existingRequest = await Request.findById(requestId);

      if (!existingRequest) {
        return res.status(404).json({
          success: false,
          error: 'Yêu cầu không tồn tại',
        });
      }

      // Check permissions - use loose equality (==) to handle type mismatch
      if (existingRequest.UsersId != userId && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Bạn không có quyền chỉnh sửa yêu cầu này',
        });
      }

      const { title, description, priorityId, workflowId, formData } = req.body;

      // Update request
      await Request.update(requestId, {
        Title: title,
        Description: description,
        PriorityID: priorityId,
        WorkflowID: workflowId,
        FormData: formData ? JSON.parse(formData) : null,
      });

      // Handle file attachment if uploaded
      if (req.file) {
        // TODO: Implement file attachment handling
      }

      res.redirect(
        `/requests/${requestId}?success=Cập nhật yêu cầu thành công`
      );
    } catch (error) {
      console.error('Error updating request:', error);
      res.status(500).json({
        success: false,
        error: 'Không thể cập nhật yêu cầu',
      });
    }
  }
);

// Xóa request
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.Id;

    // Get request details
    const request = await Request.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Yêu cầu không tồn tại',
      });
    }

    // Check permissions - only creator or admin can delete
    if (request.UsersId != userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa yêu cầu này',
      });
    }

    // Hard delete (temporary until IsActive column is added)
    // TODO: Change to soft delete after running migration: ALTER TABLE "Requests" ADD COLUMN "IsActive" BOOLEAN NOT NULL DEFAULT TRUE;
    await query(`DELETE FROM "Requests" WHERE "RequestID" = $1`, [requestId]);

    res.json({
      success: true,
      message: 'Đã xóa yêu cầu thành công',
    });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xóa yêu cầu',
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
      console.log('POST /requests/create called');
      const {
        title,
        description,
        priorityId,
        workflowId,
        issueType,
        formData,
      } = req.body;

      if (!title || title.trim().length === 0) {
        const [priorities, workflows] = await Promise.all([
          Request.getPriorities(),
          Request.getWorkflows(),
        ]);

        return res.status(400).json({
          success: false,
          message: 'Tiêu đề không được để trống',
        });
      }

      // Lấy status mặc định
      const defaultStatus = await query(
        'SELECT "StatusID" FROM "Status" WHERE "StatusName" = $1 LIMIT 1',
        ['Mới']
      );
      const statusId = defaultStatus.rows[0]?.StatusID || 1;

      // Xác định workflow
      let finalWorkflowId = workflowId;
      if (!finalWorkflowId && priorityId) {
        // Auto-select workflow based on priority if not provided
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
          finalWorkflowId = 2; // Urgent workflow nếu có
        } else {
          finalWorkflowId = 1; // Default workflow
        }
      }

      const requestData = {
        title: title.trim(),
        description: description?.trim() || '',
        userId: req.user.Id,
        priorityId: priorityId || 2, // Default to medium priority (PriorityID = 2)
        statusId: statusId,
        workflowId: finalWorkflowId || 1,
        issueType: issueType || 'General',
        attachmentURL: req.file ? `/uploads/${req.file.filename}` : null,
        attachmentFileName: req.file ? req.file.originalname : null,
        attachmentFileSize: req.file ? req.file.size : null,
        attachmentFileType: req.file ? req.file.mimetype : null,
        formData: formData || null, // Store dynamic form data as JSON
      };

      const newRequest = await Request.create(requestData);

      // Return JSON response for AJAX submission
      res.json({
        success: true,
        message: 'Tạo yêu cầu thành công',
        requestId: newRequest.RequestID,
      });
    } catch (error) {
      console.error('Create request error:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể tạo yêu cầu. Vui lòng thử lại.',
      });
    }
  }
);

// Xử lý lưu nháp request
router.post(
  '/draft',
  authenticateToken,
  upload.single('attachment'),
  async (req, res) => {
    try {
      console.log('POST /requests/draft called');
      const {
        title,
        description,
        priorityId,
        workflowId,
        issueType,
        formData,
      } = req.body;

      // Draft status ID - MUST exist
      let draftStatusId;
      try {
        const draftStatus = await query(
          'SELECT "StatusID" FROM "Status" WHERE "StatusName" = $1 LIMIT 1',
          ['Nháp']
        );
        draftStatusId = draftStatus.rows[0]?.StatusID;
        
        // If draft status doesn't exist, return error
        if (!draftStatusId) {
          console.error('Draft status "Nháp" not found in database');
          return res.status(500).json({
            success: false,
            message: 'Không tìm thấy trạng thái "Nháp". Vui lòng chạy migration 006.',
          });
        }
      } catch (e) {
        console.error('Error getting draft status:', e);
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi lấy trạng thái nháp',
        });
      }

      const requestData = {
        title: title?.trim() || 'Bản nháp chưa có tiêu đề',
        description: description?.trim() || '',
        userId: req.user.Id,
        priorityId: priorityId || 2,
        statusId: draftStatusId,
        workflowId: workflowId || 1,
        issueType: issueType || 'General',
        attachmentURL: req.file ? `/uploads/${req.file.filename}` : null,
        attachmentFileName: req.file ? req.file.originalname : null,
        attachmentFileSize: req.file ? req.file.size : null,
        attachmentFileType: req.file ? req.file.mimetype : null,
        formData: formData || null,
      };

      const draftRequest = await Request.create(requestData);

      res.json({
        success: true,
        message: 'Đã lưu nháp thành công',
        requestId: draftRequest.RequestID,
        isDraft: true,
      });
    } catch (error) {
      console.error('Draft save error:', error);
      res.status(500).json({
        success: false,
        message: 'Không thể lưu nháp. Vui lòng thử lại.',
      });
    }
  }
);

// Danh sách bản nháp
router.get('/drafts', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const [drafts, totalCount] = await Promise.all([
      Request.getDrafts(req.user.Id, page, limit),
      Request.countDrafts(req.user.Id),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render('requests/drafts', {
      title: 'Bản nháp',
      page: 'drafts',
      drafts,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: totalCount,
        showPagination: totalPages > 1,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Drafts list error:', error);
    res.render('requests/drafts', {
      title: 'Bản nháp',
      page: 'drafts',
      error: 'Không thể tải danh sách bản nháp',
      drafts: [],
      pagination: { currentPage: 1, totalPages: 0, totalRecords: 0 },
    });
  }
});

// Publish draft (chuyển draft thành request chính thức)
router.post('/drafts/:id/publish', authenticateToken, async (req, res) => {
  try {
    const draftId = parseInt(req.params.id);
    
    if (isNaN(draftId)) {
      return res.status(400).json({
        success: false,
        message: 'ID bản nháp không hợp lệ',
      });
    }

    const result = await Request.publishDraft(draftId, req.user.Id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bản nháp',
      });
    }

    res.json({
      success: true,
      message: 'Đã gửi yêu cầu thành công',
      requestId: result.RequestID,
    });
  } catch (error) {
    console.error('Publish draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể gửi yêu cầu',
    });
  }
});

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

    // Log to RequestHistories (StepID is required, use CurrentStepOrder or default to 1)
    const stepId = request.CurrentStepOrder || 1;
    await query(
      `INSERT INTO "RequestHistories" 
       ("RequestID", "StepID", "UserID", "Status", "Note", "StartTime")
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        requestId,
        stepId,
        req.user.Id,
        newStatus.StatusName,
        rejectionReason || note,
      ]
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

// API: Get requests as calendar events
router.get('/api/calendar-events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.Id;
    const start = req.query.start;
    const end = req.query.end;

    let eventsQuery = `
      SELECT 
        r."RequestID" as id,
        r."Title" as title,
        r."Description" as description,
        r."CreatedAt" as start,
        r."ClosedAt" as "end",
        CASE 
          WHEN s."IsFinal" = true THEN r."ClosedAt"
          ELSE NULL
        END as "actualEnd",
        s."StatusName" as status,
        s."IsFinal" as "isFinal",
        p."PriorityName" as priority,
        CASE 
          WHEN p."PriorityName" = 'Cao' THEN '#f56565'
          WHEN p."PriorityName" = 'Trung bình' THEN '#ed8936'
          WHEN p."PriorityName" = 'Thấp' THEN '#48bb78'
          WHEN s."IsFinal" = true THEN '#38b2ac'
          ELSE '#3788d8'
        END as color,
        creator."FullName" as "createdByName",
        assignee."FullName" as "assignedToName",
        r."UsersId" as "createdBy",
        r."AssignedUserId" as "assignedTo"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Users" creator ON r."UsersId" = creator."Id"
      LEFT JOIN "Users" assignee ON r."AssignedUserId" = assignee."Id"
      WHERE (r."UsersId" = $1 OR r."AssignedUserId" = $1)
    `;

    const params = [userId];

    if (start && end) {
      eventsQuery += ` AND r."CreatedAt" <= $3 AND (r."ClosedAt" >= $2 OR r."ClosedAt" IS NULL)`;
      params.push(start, end);
    }

    eventsQuery += ` ORDER BY r."CreatedAt" DESC`;

    const result = await query(eventsQuery, params);

    const events = result.rows.map((request) => ({
      id: request.id,
      title: `#${request.id} - ${request.title}`,
      start: request.start,
      end: request.actualEnd || request.start,
      allDay: !request.actualEnd,
      backgroundColor: request.color,
      borderColor: request.color,
      extendedProps: {
        description: request.description,
        status: request.status,
        priority: request.priority,
        isFinal: request.isFinal,
        createdByName: request.createdByName,
        assignedToName: request.assignedToName,
        createdBy: request.createdBy,
        assignedTo: request.assignedTo,
        requestId: request.id,
      },
    }));

    res.json(events);
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách yêu cầu: ' + error.message,
    });
  }
});

// POST /requests/:id/rate - Rate a completed request
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.user.Id;
    const {
      overallRating,
      qualityRating,
      responseTimeRating,
      solutionRating,
      comment,
      isAnonymous,
    } = req.body;

    // Validate ratings
    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Đánh giá phải từ 1 đến 5 sao',
      });
    }

    // Check if user is the creator of the request
    const requestCheckQuery = `
      SELECT r."RequestID", r."UsersId", s."IsFinal"
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      WHERE r."RequestID" = $1
    `;

    const requestResult = await query(requestCheckQuery, [requestId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy yêu cầu',
      });
    }

    const request = requestResult.rows[0];

    // Only creator can rate
    if (request.UsersId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Chỉ người tạo yêu cầu mới có thể đánh giá',
      });
    }

    // Only rate completed requests
    if (!request.IsFinal) {
      return res.status(400).json({
        success: false,
        error: 'Chỉ có thể đánh giá yêu cầu đã hoàn thành',
      });
    }

    // Check if already rated
    const existingRatingQuery = `
      SELECT "RatingID" FROM "RequestRatings"
      WHERE "RequestID" = $1 AND "UserId" = $2
    `;

    const existingRating = await query(existingRatingQuery, [
      requestId,
      userId,
    ]);

    if (existingRating.rows.length > 0) {
      // Update existing rating
      const updateQuery = `
        UPDATE "RequestRatings"
        SET 
          "OverallRating" = $1,
          "QualityRating" = $2,
          "ResponseTimeRating" = $3,
          "SolutionRating" = $4,
          "Comment" = $5,
          "IsAnonymous" = $6,
          "UpdatedAt" = NOW()
        WHERE "RequestID" = $7 AND "UserId" = $8
        RETURNING "RatingID"
      `;

      await query(updateQuery, [
        overallRating,
        qualityRating || null,
        responseTimeRating || null,
        solutionRating || null,
        comment || null,
        isAnonymous || false,
        requestId,
        userId,
      ]);

      return res.json({
        success: true,
        message: 'Cập nhật đánh giá thành công',
      });
    } else {
      // Create new rating
      const insertQuery = `
        INSERT INTO "RequestRatings" (
          "RequestID",
          "UserId",
          "OverallRating",
          "QualityRating",
          "ResponseTimeRating",
          "SolutionRating",
          "Comment",
          "IsAnonymous",
          "CreatedAt",
          "UpdatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING "RatingID"
      `;

      await query(insertQuery, [
        requestId,
        userId,
        overallRating,
        qualityRating || null,
        responseTimeRating || null,
        solutionRating || null,
        comment || null,
        isAnonymous || false,
      ]);

      return res.json({
        success: true,
        message: 'Đánh giá thành công',
      });
    }
  } catch (error) {
    console.error('Rate request error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi khi đánh giá: ' + error.message,
    });
  }
});

// GET /requests/:id/rating - Get rating for a request
router.get('/:id/rating', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;

    const ratingQuery = `
      SELECT 
        rr."RatingID",
        rr."OverallRating",
        rr."QualityRating",
        rr."ResponseTimeRating",
        rr."SolutionRating",
        rr."Comment",
        rr."IsAnonymous",
        rr."CreatedAt",
        u."UserName" as "RatedBy"
      FROM "RequestRatings" rr
      LEFT JOIN "Users" u ON rr."UserId" = u."Id"
      WHERE rr."RequestID" = $1
    `;

    const result = await query(ratingQuery, [requestId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        rating: null,
      });
    }

    const rating = result.rows[0];

    // Hide user name if anonymous
    if (rating.IsAnonymous) {
      rating.RatedBy = 'Ẩn danh';
    }

    res.json({
      success: true,
      rating,
    });
  } catch (error) {
    console.error('Get rating error:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi khi lấy đánh giá: ' + error.message,
    });
  }
});

module.exports = router;
