const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const User = require('../models/User');
const { redirectIfAuthenticated } = require('../middleware/auth');

// Trang đăng nhập
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Đăng nhập',
    layout: 'auth',
    error: req.query.error,
  });
});

// Xử lý đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password, remember } = req.body;

    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Đăng nhập',
        layout: 'auth',
        error: 'Vui lòng nhập đầy đủ thông tin',
        email,
      });
    }

    // Tìm user theo email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.render('auth/login', {
        title: 'Đăng nhập',
        layout: 'auth',
        error: 'Email hoặc mật khẩu không đúng',
        email,
      });
    }

    // Kiểm tra mật khẩu
    const isValidPassword = await bcrypt.compare(password, user.PasswordHash);
    if (!isValidPassword) {
      return res.render('auth/login', {
        title: 'Đăng nhập',
        layout: 'auth',
        error: 'Email hoặc mật khẩu không đúng',
        email,
      });
    }

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

    // Lưu user vào session
    req.session.user = {
      Id: user.Id,
      UserName: user.UserName,
      Email: user.Email,
      DepartmentID: user.DepartmentID,
      isAdmin: isAdmin,
      roles: roles,
    };

    // Set remember me cookie nếu được chọn
    if (remember) {
      const rememberToken = uuidv4();
      await User.saveRememberToken(user.Id, rememberToken);

      res.cookie('remember_token', rememberToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: 'strict',
      });
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      title: 'Đăng nhập',
      layout: 'auth',
      error: 'Đã có lỗi xảy ra, vui lòng thử lại',
    });
  }
});

// Trang đăng ký
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Đăng ký',
    layout: 'auth',
  });
});

// Xử lý đăng ký
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword, department } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword || !department) {
      return res.render('auth/register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: 'Vui lòng nhập đầy đủ thông tin',
        username,
        email,
        department,
      });
    }

    if (password !== confirmPassword) {
      return res.render('auth/register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: 'Mật khẩu xác nhận không khớp',
        username,
        email,
        department,
      });
    }

    if (password.length < 6) {
      return res.render('auth/register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: 'Mật khẩu phải có ít nhất 6 ký tự',
        username,
        email,
        department,
      });
    }

    // Kiểm tra user đã tồn tại
    const existingUserByEmail = await User.findByEmail(email);
    if (existingUserByEmail) {
      return res.render('auth/register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: 'Email đã được sử dụng',
        username,
        email,
        department,
      });
    }

    const existingUserByUsername = await User.findByUsername(username);
    if (existingUserByUsername) {
      return res.render('auth/register', {
        title: 'Đăng ký',
        layout: 'auth',
        error: 'Tên đăng nhập đã được sử dụng',
        username,
        email,
        department,
      });
    }

    // Mã hóa mật khẩu
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Tạo user mới
    const newUser = await User.create({
      id: uuidv4(),
      username,
      email,
      passwordHash,
      departmentId: department ? parseInt(department) : null,
    });

    // Tạo JWT token
    const token = jwt.sign(
      { userId: newUser.Id, email: newUser.Email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Check if user is admin (for newly registered users, default is false)
    const { pool } = require('../config/database');
    const rolesResult = await pool.query(
      `
            SELECT r."Name" as "RoleName"
            FROM "UserRoles" ur
            JOIN "Roles" r ON ur."RoleId" = r."Id"
            WHERE ur."UserId" = $1
        `,
      [newUser.Id]
    );

    const roles = rolesResult.rows.map((r) => r.RoleName);
    const isAdmin = roles.includes('Admin') || roles.includes('admin');

    // Lưu user vào session
    req.session.user = {
      Id: newUser.Id,
      UserName: newUser.UserName,
      Email: newUser.Email,
      DepartmentID: newUser.DepartmentID,
      isAdmin: isAdmin,
      roles: roles,
    };

    res.redirect('/dashboard?welcome=true');
  } catch (error) {
    console.error('Register error:', error);
    res.render('auth/register', {
      title: 'Đăng ký',
      layout: 'auth',
      error: 'Đã có lỗi xảy ra, vui lòng thử lại',
    });
  }
});

// Đăng xuất
router.get('/logout', async (req, res) => {
  try {
    // Xóa remember token từ database nếu có
    if (req.session && req.session.user) {
      await User.clearRememberToken(req.session.user.Id);
    }

    // Xóa session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      // Xóa tất cả cookies
      res.clearCookie('auth_token');
      res.clearCookie('remember_token');
      res.redirect('/');
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/');
  }
});

// Trang quên mật khẩu
router.get('/forgot-password', redirectIfAuthenticated, (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Quên mật khẩu',
    layout: 'auth',
  });
});

// Xử lý quên mật khẩu
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.render('auth/forgot-password', {
        title: 'Quên mật khẩu',
        layout: 'auth',
        error: 'Vui lòng nhập địa chỉ email',
        email,
      });
    }

    // Kiểm tra user có tồn tại không
    const user = await User.findByEmail(email);
    if (!user) {
      // Không tiết lộ thông tin user có tồn tại hay không
      return res.render('auth/forgot-password', {
        title: 'Quên mật khẩu',
        layout: 'auth',
        success:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được liên kết đặt lại mật khẩu trong vài phút.',
        email,
      });
    }

    // Tạo reset token
    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Lưu token vào database (cần thêm bảng password_resets)
    // Tạm thời lưu vào session để demo
    req.session.resetToken = {
      token: resetToken,
      email: email,
      expiry: resetTokenExpiry,
    };

    // TODO: Gửi email với reset token
    console.log(`Reset password token for ${email}: ${resetToken}`);
    console.log(
      `Reset link: http://localhost:${process.env.PORT || 3000}/auth/reset-password?token=${resetToken}`
    );

    res.render('auth/forgot-password', {
      title: 'Quên mật khẩu',
      layout: 'auth',
      success:
        'Liên kết đặt lại mật khẩu đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.',
      info: `Để demo: <a href="/auth/reset-password?token=${resetToken}" class="text-decoration-none">Nhấn vào đây để đặt lại mật khẩu</a>`,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('auth/forgot-password', {
      title: 'Quên mật khẩu',
      layout: 'auth',
      error: 'Đã có lỗi xảy ra, vui lòng thử lại',
    });
  }
});

// Trang đặt lại mật khẩu
router.get('/reset-password', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.redirect('/auth/forgot-password');
  }

  // Kiểm tra token (từ session hoặc database)
  const resetData = req.session.resetToken;
  if (
    !resetData ||
    resetData.token !== token ||
    new Date() > new Date(resetData.expiry)
  ) {
    return res.render('auth/reset-password', {
      title: 'Đặt lại mật khẩu',
      layout: 'auth',
      error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      token,
    });
  }

  res.render('auth/reset-password', {
    title: 'Đặt lại mật khẩu',
    layout: 'auth',
    token,
  });
});

// Xử lý đặt lại mật khẩu
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.render('auth/reset-password', {
        title: 'Đặt lại mật khẩu',
        layout: 'auth',
        error: 'Vui lòng nhập đầy đủ thông tin',
        token,
      });
    }

    if (password !== confirmPassword) {
      return res.render('auth/reset-password', {
        title: 'Đặt lại mật khẩu',
        layout: 'auth',
        error: 'Mật khẩu xác nhận không khớp',
        token,
      });
    }

    if (password.length < 6) {
      return res.render('auth/reset-password', {
        title: 'Đặt lại mật khẩu',
        layout: 'auth',
        error: 'Mật khẩu phải có ít nhất 6 ký tự',
        token,
      });
    }

    // Kiểm tra token
    const resetData = req.session.resetToken;
    if (
      !resetData ||
      resetData.token !== token ||
      new Date() > new Date(resetData.expiry)
    ) {
      return res.render('auth/reset-password', {
        title: 'Đặt lại mật khẩu',
        layout: 'auth',
        error: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
        token,
      });
    }

    // Hash mật khẩu mới
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Cập nhật mật khẩu
    const updated = await User.updatePassword(resetData.email, hashedPassword);

    if (!updated) {
      return res.render('auth/reset-password', {
        title: 'Đặt lại mật khẩu',
        layout: 'auth',
        error: 'Không thể cập nhật mật khẩu. Vui lòng thử lại.',
        token,
      });
    }

    // Xóa token đã sử dụng
    delete req.session.resetToken;

    res.render('auth/login', {
      title: 'Đăng nhập',
      layout: 'auth',
      success:
        'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.render('auth/reset-password', {
      title: 'Đặt lại mật khẩu',
      layout: 'auth',
      error: 'Đã có lỗi xảy ra, vui lòng thử lại',
      token: req.body.token,
    });
  }
});

// API endpoints
router.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res
        .status(401)
        .json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const isValidPassword = await bcrypt.compare(password, user.PasswordHash);
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign(
      { userId: user.Id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.Id,
        username: user.UserName,
        email: user.Email,
      },
    });
  } catch (error) {
    console.error('API Login error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
