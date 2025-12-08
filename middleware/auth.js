const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware kiểm tra authentication
const authenticateToken = async (req, res, next) => {
  try {
    // Kiểm tra session trước
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    // Kiểm tra remember token từ cookie
    const rememberToken = req.cookies.remember_token;
    if (rememberToken) {
      const user = await User.findByRememberToken(rememberToken);
      if (user) {
        // Check if user is admin
        const { pool } = require('../config/database');
        const rolesResult = await pool.query(
          `
                    SELECT r."Name" as "RoleName"
                    FROM "UserRoles" ur
                    JOIN "Roles" r ON ur."RoleId" = r."Id"
                    WHERE ur."UserId" = $1
                `,
          [user.Id]
        );

        const roles = rolesResult.rows.map((r) => r.RoleName);
        const isAdmin = roles.includes('Admin') || roles.includes('admin');

        // Tạo lại session cho user
        req.session.user = {
          Id: user.Id,
          UserName: user.UserName,
          Email: user.Email,
          DepartmentID: user.DepartmentID,
          isAdmin: isAdmin,
          roles: roles,
        };
        req.user = req.session.user;
        return next();
      } else {
        // Token hết hạn hoặc không hợp lệ, xóa cookie
        res.clearCookie('remember_token');
      }
    }

    // Kiểm tra JWT token từ header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ message: 'Token không tồn tại' });
      }
      return res.redirect('/auth/login');
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        if (req.path.startsWith('/api/')) {
          return res.status(403).json({ message: 'Token không hợp lệ' });
        }
        return res.redirect('/auth/login');
      }

      // Lấy thông tin user từ database
      const user = await User.findById(decoded.userId);
      if (!user) {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ message: 'User không tồn tại' });
        }
        return res.redirect('/auth/login');
      }

      req.user = user;
      req.session.user = user; // Lưu vào session
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ message: 'Lỗi server' });
    }
    return res.redirect('/auth/login');
  }
};

// Middleware kiểm tra role
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({ message: 'Chưa đăng nhập' });
        }
        return res.redirect('/auth/login');
      }

      // Lấy thông tin role của user
      const { query } = require('../config/database');
      const userRoles = await query(
        `
                SELECT r."Name" as "RoleName"
                FROM "UserRoles" ur
                JOIN "Roles" r ON ur."RoleId" = r."Id"
                WHERE ur."UserId" = $1
            `,
        [req.user.Id]
      );

      req.user.roles = userRoles.rows.map((role) => role.RoleName);

      // Kiểm tra role
      if (Array.isArray(roles)) {
        const hasRole = roles.some((role) => req.user.roles.includes(role));
        if (!hasRole) {
          if (req.path.startsWith('/api/')) {
            return res.status(403).json({ message: 'Không có quyền truy cập' });
          }
          return res.status(403).render('errors/403', {
            title: 'Không có quyền truy cập',
            message: 'Bạn không có quyền truy cập trang này',
          });
        }
      } else if (typeof roles === 'string') {
        if (!req.user.roles.includes(roles)) {
          if (req.path.startsWith('/api/')) {
            return res.status(403).json({ message: 'Không có quyền truy cập' });
          }
          return res.status(403).render('errors/403', {
            title: 'Không có quyền truy cập',
            message: 'Bạn không có quyền truy cập trang này',
          });
        }
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({ message: 'Lỗi server' });
      }
      return res.redirect('/');
    }
  };
};

// Middleware kiểm tra quyền xử lý request
const canProcessRequest = async (req, res, next) => {
  try {
    const requestId = req.params.id || req.body.requestId;
    if (!requestId) {
      return res.status(400).json({ message: 'Request ID không hợp lệ' });
    }

    const Request = require('../models/Request');
    const canProcess = await Request.canProcessRequest(requestId, req.user.Id);

    if (!canProcess) {
      if (req.path.startsWith('/api/')) {
        return res
          .status(403)
          .json({ message: 'Bạn không có quyền xử lý yêu cầu này' });
      }
      return res.status(403).render('errors/403', {
        title: 'Không có quyền truy cập',
        message: 'Bạn không có quyền xử lý yêu cầu này',
      });
    }

    next();
  } catch (error) {
    console.error('Can process request middleware error:', error);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ message: 'Lỗi server' });
    }
    return res.redirect('/');
  }
};

// Middleware cho các route public (đã login thì redirect)
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

// Middleware kiểm tra quyền truy cập resource
const checkResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const userId = req.user.Id;

      // Logic kiểm tra quyền truy cập dựa vào resourceType
      // Ví dụ: user chỉ có thể truy cập request của mình hoặc được assign
      if (resourceType === 'request') {
        const Request = require('../models/Request');
        const request = await Request.findById(resourceId);

        if (!request) {
          return res.status(404).json({ message: 'Request không tồn tại' });
        }

        // Kiểm tra quyền: owner, assignee, hoặc admin
        if (request.UsersId !== userId && request.AssignedUserId !== userId) {
          // TODO: Kiểm tra thêm quyền admin
          return res.status(403).json({ message: 'Không có quyền truy cập' });
        }
      }

      next();
    } catch (error) {
      console.error('Resource access check error:', error);
      return res.status(500).json({ message: 'Lỗi server' });
    }
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  redirectIfAuthenticated,
  checkResourceAccess,
  canProcessRequest,
};
