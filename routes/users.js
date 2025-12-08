const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

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

    res.render('users/index', {
      title: 'Danh sách người dùng',
      users,
      currentPage: page,
      totalPages,
      totalCount,
      search,
      hasNext: page < totalPages,
      hasPrev: page > 1,
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
      SELECT u.*, d."DepartmentName" as "Department"
      FROM "Users" u
      LEFT JOIN "Departments" d ON u."DepartmentId" = d."DepartmentID"
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
        (SELECT COUNT(*) FROM "Requests" WHERE "AssignedUserId" = $1 AND "IsFinal" = true) as "completedRequests"
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
        d."DepartmentName",
        (SELECT COUNT(*) FROM "Requests" WHERE "CreatedBy" = u."Id") as "requestCount",
        (SELECT COUNT(*) FROM "Requests" WHERE "AssignedTo" = u."Id") as "assignedCount"
      FROM "Users" u
      LEFT JOIN "Departments" d ON u."DepartmentId" = d."DepartmentID"
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

module.exports = router;
