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

module.exports = router;
