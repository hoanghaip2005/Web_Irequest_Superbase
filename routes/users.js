const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');

// Configure multer for avatar upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file hình ảnh (jpeg, jpg, png, gif)!'));
    }
  },
});

// POST /users/create - Tạo user mới (admin only)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.isAdmin) {
      return res
        .status(403)
        .redirect(
          '/users?error=' +
            encodeURIComponent('Bạn không có quyền tạo người dùng')
        );
    }

    const {
      userName,
      email,
      phoneNumber,
      departmentId,
      position,
      homeAdress,
      password,
      confirmPassword,
      roles,
      isAdmin,
      isActive,
    } = req.body;

    // Validate required fields
    if (!userName || !email || !password) {
      return res.redirect(
        '/users?error=' +
          encodeURIComponent('Vui lòng điền đầy đủ thông tin bắt buộc')
      );
    }

    // Validate password match
    if (password !== confirmPassword) {
      return res.redirect(
        '/users?error=' + encodeURIComponent('Mật khẩu xác nhận không khớp')
      );
    }

    // Validate password length
    if (password.length < 6) {
      return res.redirect(
        '/users?error=' + encodeURIComponent('Mật khẩu phải có ít nhất 6 ký tự')
      );
    }

    // Check if username or email already exists
    const checkQuery = `
      SELECT "Id" FROM "Users" 
      WHERE "UserName" = $1 OR "Email" = $2
    `;
    const checkResult = await query(checkQuery, [userName, email]);

    if (checkResult.rows.length > 0) {
      return res.redirect(
        '/users?error=' +
          encodeURIComponent('Tên đăng nhập hoặc email đã tồn tại')
      );
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate UUID for new user
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();

    // Insert new user
    const insertQuery = `
      INSERT INTO "Users" (
        "Id", "UserName", "NormalizedUserName",
        "Email", "NormalizedEmail", "EmailConfirmed",
        "PasswordHash", "PhoneNumber", "DepartmentID",
        "Position", "HomeAdress", "isAdmin", "IsActive",
        "CreatedAt", "UpdatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING "Id"
    `;

    const insertParams = [
      userId,
      userName,
      userName.toUpperCase(),
      email,
      email.toUpperCase(),
      true, // Email confirmed by default for admin-created users
      hashedPassword,
      phoneNumber || null,
      departmentId || null,
      position || null,
      homeAdress || null,
      isAdmin === 'on',
      isActive === 'on',
    ];

    const insertResult = await query(insertQuery, insertParams);

    // Insert user roles if provided
    if (roles) {
      const roleArray = Array.isArray(roles) ? roles : [roles];
      for (const roleId of roleArray) {
        await query(
          `INSERT INTO "UserRoles" ("UserId", "RoleId") VALUES ($1, $2)`,
          [userId, roleId]
        );
      }
    }

    res.redirect(
      '/users?success=' + encodeURIComponent('Tạo người dùng thành công')
    );
  } catch (error) {
    console.error('Create user error:', error);
    res.redirect(
      '/users?error=' +
        encodeURIComponent('Không thể tạo người dùng: ' + error.message)
    );
  }
});

// Danh sách users (admin only - tạm thời cho phép tất cả user xem)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const [users, totalCount] = await Promise.all([
      User.getAll(page, limit, search),
      User.count(search),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Get departments for modal
    const departmentsQuery = `
      SELECT * FROM "Departments" WHERE "IsActive" = true ORDER BY "Name"
    `;
    const departmentsResult = await query(departmentsQuery);

    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as "totalUsers",
        COUNT(*) FILTER (WHERE "IsActive" = true) as "activeUsers",
        COUNT(*) FILTER (WHERE "isAdmin" = true) as "adminUsers",
        COUNT(*) FILTER (WHERE "IsActive" = false) as "blockedUsers"
      FROM "Users"
    `;
    const statsResult = await query(statsQuery);

    res.render('users/index', {
      title: 'Danh sách người dùng',
      users,
      departments: departmentsResult.rows,
      stats: statsResult.rows[0] || {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        blockedUsers: 0,
      },
      currentPage: page,
      totalPages,
      totalCount,
      search,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.render('users/index', {
      title: 'Danh sách người dùng',
      error: 'Không thể tải danh sách người dùng',
      users: [],
      currentPage: 1,
      totalPages: 0,
      totalCount: 0,
    });
  }
});

// Profile của user hiện tại
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../config/database');

    // Get user information with department and roles
    const userQuery = `
      SELECT u.*, d."Name" as "Department"
      FROM "Users" u
      LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
      WHERE u."Id" = $1
    `;
    const userResult = await query(userQuery, [req.user.Id]);
    const user = userResult.rows[0];

    // Get user roles
    const rolesQuery = `
      SELECT r."Name"
      FROM "UserRoles" ur
      JOIN "Roles" r ON ur."RoleId" = r."Id"
      WHERE ur."UserId" = $1
    `;
    const rolesResult = await query(rolesQuery, [req.user.Id]);
    user.Roles = rolesResult.rows.map((r) => r.Name);

    // Get statistics
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM "Requests" WHERE "UsersId" = $1) as "createdRequests",
        (SELECT COUNT(*) FROM "Requests" WHERE "AssignedUserId" = $1) as "assignedRequests",
        (SELECT COUNT(*) FROM "Requests" r 
         LEFT JOIN "Status" s ON r."StatusID" = s."StatusID" 
         WHERE r."AssignedUserId" = $1 AND s."IsFinal" = true) as "completedRequests"
    `;
    const statsResult = await query(statsQuery, [req.user.Id]);
    const stats = statsResult.rows[0];

    // Get recent activities
    const activitiesQuery = `
      SELECT 
        'request_created' as type,
        'Đã tạo yêu cầu: ' || "Title" as description,
        "CreatedAt" as "createdAt",
        'primary' as color,
        'plus' as icon
      FROM "Requests"
      WHERE "UsersId" = $1
      UNION ALL
      SELECT 
        'comment_added' as type,
        'Đã bình luận trong yêu cầu #' || "RequestId" as description,
        "CreatedAt" as "createdAt",
        'secondary' as color,
        'comment' as icon
      FROM "Comments"
      WHERE "UserId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;
    const activitiesResult = await query(activitiesQuery, [req.user.Id]);

    res.render('users/profile', {
      title: 'Hồ sơ cá nhân',
      user: user,
      stats: stats,
      recentActivities: activitiesResult.rows,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.render('users/profile', {
      title: 'Hồ sơ cá nhân',
      error: 'Không thể tải thông tin hồ sơ',
      user: req.user,
      stats: { createdRequests: 0, assignedRequests: 0, completedRequests: 0 },
      recentActivities: [],
    });
  }
});

// Cập nhật profile
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const { userName, phoneNumber, homeAdress } = req.body;

    const updateData = {};
    if (userName && userName.trim() !== '') {
      updateData.UserName = userName.trim();
      updateData.NormalizedUserName = userName.trim().toUpperCase();
    }
    if (phoneNumber !== undefined) {
      updateData.PhoneNumber = phoneNumber.trim() || null;
    }
    if (homeAdress !== undefined) {
      updateData.HomeAdress = homeAdress.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.render('users/profile', {
        title: 'Hồ sơ cá nhân',
        error: 'Không có thông tin nào được cập nhật',
        profile: req.user,
      });
    }

    // Kiểm tra username đã tồn tại chưa
    if (updateData.UserName) {
      const existingUser = await User.findByUsername(updateData.UserName);
      if (existingUser && existingUser.Id !== req.user.Id) {
        const user = await User.findById(req.user.Id);
        return res.render('users/profile', {
          title: 'Hồ sơ cá nhân',
          error: 'Tên đăng nhập đã được sử dụng',
          profile: user,
          formData: req.body,
        });
      }
    }

    const updatedUser = await User.update(req.user.Id, updateData);

    // Cập nhật session
    req.session.user = {
      ...req.session.user,
      UserName: updatedUser.UserName,
      PhoneNumber: updatedUser.PhoneNumber,
      HomeAdress: updatedUser.HomeAdress,
    };

    res.render('users/profile', {
      title: 'Hồ sơ cá nhân',
      success: 'Cập nhật hồ sơ thành công',
      profile: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    const user = await User.findById(req.user.Id);
    res.render('users/profile', {
      title: 'Hồ sơ cá nhân',
      error: 'Không thể cập nhật hồ sơ. Vui lòng thử lại.',
      profile: user,
      formData: req.body,
    });
  }
});

// Chi tiết user (public info)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Người dùng không tồn tại',
      });
    }

    // Chỉ hiển thị thông tin public
    const publicInfo = {
      Id: user.Id,
      UserName: user.UserName,
      Email: user.Email,
      DepartmentName: user.DepartmentName,
      Avatar: user.Avatar,
    };

    res.render('users/detail', {
      title: `Thông tin ${user.UserName}`,
      userDetail: publicInfo,
      isOwnProfile: user.Id === req.user.Id,
    });
  } catch (error) {
    console.error('User detail error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi hệ thống',
      message: 'Không thể tải thông tin người dùng',
    });
  }
});

// API endpoints

// API: Lấy danh sách users
router.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const [users, totalCount] = await Promise.all([
      User.getAll(page, limit, search),
      User.count(search),
    ]);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error('API users error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// API: Lấy thông tin user
router.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }

    // Chỉ trả về thông tin public
    const publicInfo = {
      Id: user.Id,
      UserName: user.UserName,
      Email: user.Email,
      DepartmentName: user.DepartmentName,
    };

    res.json(publicInfo);
  } catch (error) {
    console.error('API user detail error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// API: Lấy dashboard data của user hiện tại
router.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const dashboardData = await User.getDashboardData(req.user.Id);
    res.json(
      dashboardData || {
        TotalRequests: 0,
        PendingRequests: 0,
        PendingTasks: 0,
        UnreadNotifications: 0,
      }
    );
  } catch (error) {
    console.error('API dashboard error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Update profile information
router.post('/update-profile', authenticateToken, async (req, res) => {
  try {
    const { fullName, email, phoneNumber, position } = req.body;
    const { query } = require('../config/database');

    const updateQuery = `
      UPDATE "Users" 
      SET "FullName" = $1, "Email" = $2, "PhoneNumber" = $3, "Position" = $4
      WHERE "Id" = $5
    `;

    await query(updateQuery, [
      fullName,
      email,
      phoneNumber || null,
      position || null,
      req.user.Id,
    ]);

    res.redirect(
      '/users/profile?success=' +
        encodeURIComponent('Cập nhật thông tin thành công')
    );
  } catch (error) {
    console.error('Update profile error:', error);
    res.redirect(
      '/users/profile?error=' +
        encodeURIComponent('Không thể cập nhật thông tin')
    );
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { query } = require('../config/database');
    const bcrypt = require('bcryptjs');

    // Get current user
    const userResult = await query(
      'SELECT "PasswordHash" FROM "Users" WHERE "Id" = $1',
      [req.user.Id]
    );

    if (userResult.rows.length === 0) {
      return res.redirect(
        '/users/profile?error=' + encodeURIComponent('Người dùng không tồn tại')
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].PasswordHash
    );

    if (!isValid) {
      return res.redirect(
        '/users/profile?error=' +
          encodeURIComponent('Mật khẩu hiện tại không đúng')
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await query('UPDATE "Users" SET "PasswordHash" = $1 WHERE "Id" = $2', [
      hashedPassword,
      req.user.Id,
    ]);

    res.redirect(
      '/users/profile?success=' + encodeURIComponent('Đổi mật khẩu thành công')
    );
  } catch (error) {
    console.error('Change password error:', error);
    res.redirect(
      '/users/profile?error=' + encodeURIComponent('Không thể đổi mật khẩu')
    );
  }
});

// Admin routes - User management
// Toggle user status (activate/deactivate)
router.post('/:userId/toggle-status', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const { query } = require('../config/database');

    // Check if current user is admin
    if (!req.user.IsAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'Không có quyền thực hiện' });
    }

    await query('UPDATE "Users" SET "IsActive" = $1 WHERE "Id" = $2', [
      isActive,
      userId,
    ]);

    res.json({
      success: true,
      message: `Đã ${isActive ? 'mở khóa' : 'khóa'} tài khoản thành công`,
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset password for user
router.post('/:userId/reset-password', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { query } = require('../config/database');
    const bcrypt = require('bcryptjs');

    // Check if current user is admin
    if (!req.user.IsAdmin) {
      return res
        .status(403)
        .json({ success: false, message: 'Không có quyền thực hiện' });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update password
    await query('UPDATE "Users" SET "PasswordHash" = $1 WHERE "Id" = $2', [
      hashedPassword,
      userId,
    ]);

    // TODO: Send email with temporary password

    res.json({
      success: true,
      message: 'Đã đặt lại mật khẩu. Mật khẩu tạm thời đã được gửi qua email',
      tempPassword: tempPassword, // Remove in production
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// View user details
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { query } = require('../config/database');

    const userQuery = `
      SELECT 
        u.*,
        d."Name" as "DepartmentName",
        (SELECT COUNT(*) FROM "Requests" WHERE "CreatedBy" = u."Id") as "requestCount",
        (SELECT COUNT(*) FROM "Requests" WHERE "AssignedTo" = u."Id") as "assignedCount"
      FROM "Users" u
      LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
      WHERE u."Id" = $1
    `;

    const result = await query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).render('errors/404', {
        message: 'Người dùng không tồn tại',
      });
    }

    res.render('users/detail', {
      title: 'Chi tiết người dùng',
      page: 'users',
      viewUser: result.rows[0],
    });
  } catch (error) {
    console.error('View user error:', error);
    res.status(500).render('errors/500', { error: error.message });
  }
});

// ==================== API ENDPOINTS ====================

// GET /users/api/search - Search users for @mentions autocomplete
router.get('/api/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;

    if (!query || query.trim().length < 1) {
      return res.json({
        success: true,
        users: [],
      });
    }

    // Search users by username or email
    const { query: dbQuery } = require('../config/database');
    const searchPattern = `%${query.trim()}%`;

    const result = await dbQuery(
      `SELECT 
        u."Id",
        u."UserName",
        u."Email",
        u."Avatar",
        d."Name" as "DepartmentName"
       FROM "Users" u
       LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
       WHERE (
         LOWER(u."UserName") LIKE LOWER($1) OR 
         LOWER(u."Email") LIKE LOWER($1)
       )
       AND u."LockoutEnabled" = false
       ORDER BY 
         CASE 
           WHEN LOWER(u."UserName") LIKE LOWER($2) THEN 1
           WHEN LOWER(u."Email") LIKE LOWER($2) THEN 2
           ELSE 3
         END,
         u."UserName"
       LIMIT $3`,
      [searchPattern, query.trim().toLowerCase() + '%', limit]
    );

    const users = result.rows.map((user) => ({
      id: user.Id,
      username: user.UserName,
      email: user.Email,
      avatar: user.Avatar || '/images/default-avatar.png',
      department: user.DepartmentName,
      displayName: user.UserName || user.Email.split('@')[0],
    }));

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users: ' + error.message,
    });
  }
});

// GET /users/api/:id - Get user details for mentions
router.get('/api/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { query: dbQuery } = require('../config/database');

    const result = await dbQuery(
      `SELECT 
        u."Id",
        u."UserName",
        u."Email",
        u."Avatar",
        d."Name" as "DepartmentName"
       FROM "Users" u
       LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
       WHERE u."Id" = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.Id,
        username: user.UserName,
        email: user.Email,
        avatar: user.Avatar || '/images/default-avatar.png',
        department: user.DepartmentName,
        displayName: user.UserName || user.Email.split('@')[0],
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user: ' + error.message,
    });
  }
});

// Upload avatar
router.post(
  '/upload-avatar',
  authenticateToken,
  upload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Không có file nào được tải lên',
        });
      }

      const userId = req.user.Id;
      const avatarPath = '/uploads/avatars/' + req.file.filename;

      // Get old avatar to delete
      const oldAvatarQuery = `SELECT "Avatar" FROM "Users" WHERE "Id" = $1`;
      const oldAvatarResult = await query(oldAvatarQuery, [userId]);
      const oldAvatar = oldAvatarResult.rows[0]?.Avatar;

      // Update avatar in database
      const updateQuery = `
      UPDATE "Users" 
      SET "Avatar" = $1 
      WHERE "Id" = $2
      RETURNING *
    `;
      const result = await query(updateQuery, [avatarPath, userId]);

      // Delete old avatar file if exists
      if (oldAvatar && oldAvatar.startsWith('/uploads/avatars/')) {
        const oldAvatarFullPath = path.join(__dirname, '..', oldAvatar);
        if (fs.existsSync(oldAvatarFullPath)) {
          fs.unlinkSync(oldAvatarFullPath);
        }
      }

      if (result.rows.length > 0) {
        res.json({
          success: true,
          message: 'Cập nhật avatar thành công!',
          avatarUrl: avatarPath,
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng',
        });
      }
    } catch (error) {
      console.error('Upload avatar error:', error);

      // Delete uploaded file if database update fails
      if (req.file) {
        const filePath = path.join(
          __dirname,
          '../uploads/avatars',
          req.file.filename
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Lỗi khi upload avatar: ' + error.message,
      });
    }
  }
);

// GET /users/:id/edit - Form chỉnh sửa user (admin only)
router.get('/:id/edit', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.isAdmin) {
      return res.status(403).render('errors/403', {
        title: 'Không có quyền',
        message: 'Bạn không có quyền chỉnh sửa người dùng',
      });
    }

    const userId = req.params.id;

    // Get user info
    const userQuery = `
      SELECT u.*, d."Name" as "DepartmentName"
      FROM "Users" u
      LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
      WHERE u."Id" = $1
    `;
    const userResult = await query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Người dùng không tồn tại',
      });
    }

    const editUser = userResult.rows[0];

    // Get user roles
    const rolesQuery = `
      SELECT r."Id", r."Name", r."Description"
      FROM "UserRoles" ur
      JOIN "Roles" r ON ur."RoleId" = r."Id"
      WHERE ur."UserId" = $1
    `;
    const userRolesResult = await query(rolesQuery, [userId]);
    const userRoles = userRolesResult.rows.map((r) => r.Id);

    // Get all departments
    const departmentsQuery = `
      SELECT * FROM "Departments" WHERE "IsActive" = true ORDER BY "Name"
    `;
    const departmentsResult = await query(departmentsQuery);

    // Get all roles
    const allRolesQuery = `SELECT * FROM "Roles" ORDER BY "Name"`;
    const allRolesResult = await query(allRolesQuery);

    res.render('users/edit', {
      title: 'Chỉnh sửa người dùng',
      editUser: editUser,
      departments: departmentsResult.rows,
      roles: allRolesResult.rows,
      userRoles: userRoles,
    });
  } catch (error) {
    console.error('Edit user error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi hệ thống',
      message: 'Không thể tải form chỉnh sửa',
    });
  }
});

// PUT /users/:id - Cập nhật thông tin user (admin only)
router.put(
  '/:id',
  authenticateToken,
  upload.single('avatar'),
  async (req, res) => {
    try {
      // Check admin permission
      if (!req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền chỉnh sửa người dùng',
        });
      }

      const userId = req.params.id;
      const {
        userName,
        email,
        phoneNumber,
        homeAdress,
        departmentId,
        position,
        isAdmin,
        isActive,
        emailConfirmed,
        newPassword,
        confirmPassword,
        roles,
      } = req.body;

      // Validate password if provided
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          return res.redirect(
            `/users/${userId}/edit?error=` +
              encodeURIComponent('Mật khẩu xác nhận không khớp')
          );
        }
        if (newPassword.length < 6) {
          return res.redirect(
            `/users/${userId}/edit?error=` +
              encodeURIComponent('Mật khẩu phải có ít nhất 6 ký tự')
          );
        }
      }

      // Update user info
      let updateQuery = `
      UPDATE "Users" 
      SET "UserName" = $1, 
          "Email" = $2,
          "PhoneNumber" = $3,
          "HomeAdress" = $4,
          "DepartmentID" = $5,
          "Position" = $6,
          "isAdmin" = $7,
          "IsActive" = $8,
          "EmailConfirmed" = $9,
          "UpdatedAt" = NOW()
    `;

      const params = [
        userName,
        email,
        phoneNumber || null,
        homeAdress || null,
        departmentId || null,
        position || null,
        isAdmin === 'on',
        isActive === 'on',
        emailConfirmed === 'on',
      ];

      // Handle avatar upload
      if (req.file) {
        const avatarPath = '/uploads/avatars/' + req.file.filename;
        updateQuery += `, "Avatar" = $${params.length + 1}`;
        params.push(avatarPath);
      }

      // Handle password change
      if (newPassword) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        updateQuery += `, "PasswordHash" = $${params.length + 1}`;
        params.push(hashedPassword);
      }

      updateQuery += ` WHERE "Id" = $${params.length + 1} RETURNING *`;
      params.push(userId);

      const updateResult = await query(updateQuery, params);

      if (updateResult.rows.length === 0) {
        return res.redirect(
          `/users/${userId}/edit?error=` +
            encodeURIComponent('Người dùng không tồn tại')
        );
      }

      // Update user roles
      if (roles) {
        // Delete existing roles
        await query(`DELETE FROM "UserRoles" WHERE "UserId" = $1`, [userId]);

        // Insert new roles
        const roleArray = Array.isArray(roles) ? roles : [roles];
        for (const roleId of roleArray) {
          await query(
            `INSERT INTO "UserRoles" ("UserId", "RoleId") VALUES ($1, $2)`,
            [userId, roleId]
          );
        }
      }

      res.redirect(
        `/users/${userId}?success=` + encodeURIComponent('Cập nhật thành công')
      );
    } catch (error) {
      console.error('Update user error:', error);
      res.redirect(
        `/users/${req.params.id}/edit?error=` +
          encodeURIComponent('Không thể cập nhật: ' + error.message)
      );
    }
  }
);

// DELETE /users/:id - Xóa user (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa người dùng',
      });
    }

    const userId = req.params.id;

    // Prevent self-deletion
    if (userId === req.user.Id) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản của chính mình',
      });
    }

    // Check if user exists
    const checkQuery = `SELECT "Id", "Avatar" FROM "Users" WHERE "Id" = $1`;
    const checkResult = await query(checkQuery, [userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    const avatar = checkResult.rows[0].Avatar;

    // Delete user (cascade will handle related records)
    const deleteQuery = `DELETE FROM "Users" WHERE "Id" = $1`;
    await query(deleteQuery, [userId]);

    // Delete avatar file if exists
    if (avatar && avatar.startsWith('/uploads/avatars/')) {
      const avatarPath = path.join(__dirname, '..', avatar);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    res.json({
      success: true,
      message: 'Xóa người dùng thành công',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa người dùng: ' + error.message,
    });
  }
});

// PUT /users/:id/permissions - Cập nhật quyền user (admin only)
router.put('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    // Check admin permission
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thay đổi phân quyền',
      });
    }

    const userId = req.params.id;
    const { roles, isAdmin } = req.body;

    // Update admin status
    if (typeof isAdmin !== 'undefined') {
      await query(`UPDATE "Users" SET "isAdmin" = $1 WHERE "Id" = $2`, [
        isAdmin,
        userId,
      ]);
    }

    // Update roles
    if (roles) {
      // Delete existing roles
      await query(`DELETE FROM "UserRoles" WHERE "UserId" = $1`, [userId]);

      // Insert new roles
      const roleArray = Array.isArray(roles) ? roles : [roles];
      for (const roleId of roleArray) {
        await query(
          `INSERT INTO "UserRoles" ("UserId", "RoleId") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, roleId]
        );
      }
    }

    res.json({
      success: true,
      message: 'Cập nhật phân quyền thành công',
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật phân quyền: ' + error.message,
    });
  }
});

module.exports = router;
