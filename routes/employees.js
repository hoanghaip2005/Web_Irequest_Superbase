const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all employees
router.get('/', async (req, res) => {
  try {
    const { search, department, role } = req.query;

    let queryText = `
            SELECT 
                u.*,
                d."Name" as "DepartmentName",
                r."Name" as "RoleName"
            FROM "Users" u
            LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
            LEFT JOIN "UserRoles" ur ON u."Id" = ur."UserId"
            LEFT JOIN "Roles" r ON ur."RoleId" = r."Id"
            WHERE 1=1
        `;

    const params = [];

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (u."Email" ILIKE $${params.length} OR u."UserName" ILIKE $${params.length})`;
    }

    if (department) {
      params.push(department);
      queryText += ` AND u."DepartmentID" = $${params.length}`;
    }

    if (role) {
      params.push(role);
      queryText += ` AND ur."RoleId" = $${params.length}`;
    }

    queryText += ` ORDER BY u."Email" DESC`;

    const result = await pool.query(queryText, params);

    // Get statistics
    const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as "totalUsers",
                COUNT(*) FILTER (WHERE "EmailConfirmed" = true) as "activeUsers",
                COUNT(*) FILTER (
                    WHERE "Id" IN (
                        SELECT ur."UserId" 
                        FROM "UserRoles" ur 
                        JOIN "Roles" r ON ur."RoleId" = r."Id" 
                        WHERE r."Name" = 'Admin'
                    )
                ) as "adminUsers"
            FROM "Users"
        `);

    const departmentCountResult = await pool.query(`
            SELECT COUNT(*) as count FROM "Departments" WHERE "IsActive" = true
        `);

    // Get departments and roles for filters
    const departmentsResult = await pool.query(`
            SELECT * FROM "Departments" WHERE "IsActive" = true ORDER BY "Name"
        `);

    const rolesResult = await pool.query(`
            SELECT * FROM "Roles" ORDER BY "Name"
        `);

    const stats = statsResult.rows[0];

    res.render('employees/index', {
      title: 'Quản lý Nhân viên',
      user: req.user,
      users: result.rows,
      departments: departmentsResult.rows,
      roles: rolesResult.rows,
      totalUsers: stats.totalUsers || 0,
      activeUsers: stats.activeUsers || 0,
      adminUsers: stats.adminUsers || 0,
      departmentCount: departmentCountResult.rows[0].count || 0,
      search: search || '',
      selectedDepartment: department || '',
      selectedRole: role || '',
      success: req.query.success,
      error: req.query.error,
    });
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      user: req.user,
      error: 'Không thể tải danh sách nhân viên',
    });
  }
});

// Create new employee
router.post('/create', async (req, res) => {
  try {
    const {
      username,
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      departmentId,
      roleId,
      address,
      isActive,
    } = req.body;

    // Validate password match
    if (password !== confirmPassword) {
      return res.redirect(
        '/employees?error=' + encodeURIComponent('Mật khẩu xác nhận không khớp')
      );
    }

    // Check if username or email already exists
    const existingUser = await pool.query(
      `
            SELECT * FROM "Users" WHERE "UserName" = $1 OR "Email" = $2
        `,
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.redirect(
        '/employees?error=' +
          encodeURIComponent('Tên đăng nhập hoặc email đã tồn tại')
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate UUID for new user
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();

    // Insert user
    const userResult = await pool.query(
      `
            INSERT INTO "Users" (
                "Id",
                "UserName",
                "NormalizedUserName",
                "Email",
                "NormalizedEmail",
                "EmailConfirmed",
                "PasswordHash",
                "PhoneNumber",
                "DepartmentID",
                "HomeAdress",
                "PhoneNumberConfirmed",
                "TwoFactorEnabled",
                "LockoutEnabled",
                "AccessFailedCount"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, false, false, 0)
            RETURNING "Id"
        `,
      [
        userId,
        username,
        username.toUpperCase(),
        email,
        email.toUpperCase(),
        isActive === 'on',
        hashedPassword,
        phone || null,
        departmentId || null,
        address || null,
      ]
    );

    const newUserId = userResult.rows[0].Id;

    // Assign role if provided
    if (roleId) {
      await pool.query(
        `
                INSERT INTO "UserRoles" ("UserId", "RoleId")
                VALUES ($1, $2)
            `,
        [newUserId, roleId]
      );
    }

    res.redirect(
      '/employees?success=' + encodeURIComponent('Thêm nhân viên thành công')
    );
  } catch (err) {
    console.error('Error creating employee:', err);
    res.redirect(
      '/employees?error=' + encodeURIComponent('Không thể thêm nhân viên')
    );
  }
});

// Update employee
router.post('/update', async (req, res) => {
  try {
    const {
      userId,
      fullName,
      email,
      phone,
      departmentId,
      roleId,
      address,
      isActive,
    } = req.body;

    // Check if email already exists (exclude current user)
    const existingUser = await pool.query(
      `
            SELECT * FROM "Users" WHERE "Email" = $1 AND "Id" != $2
        `,
      [email, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.redirect(
        '/employees?error=' + encodeURIComponent('Email đã tồn tại')
      );
    }

    // Update user
    await pool.query(
      `
            UPDATE "Users" SET
                "Email" = $1,
                "NormalizedEmail" = $2,
                "PhoneNumber" = $3,
                "DepartmentID" = $4,
                "HomeAdress" = $5,
                "EmailConfirmed" = $6
            WHERE "Id" = $7
        `,
      [
        email,
        email.toUpperCase(),
        phone || null,
        departmentId || null,
        address || null,
        isActive === 'on',
        userId,
      ]
    );

    // Update role
    await pool.query(
      `
            DELETE FROM "UserRoles" WHERE "UserId" = $1
        `,
      [userId]
    );

    if (roleId) {
      await pool.query(
        `
                INSERT INTO "UserRoles" ("UserId", "RoleId")
                VALUES ($1, $2)
            `,
        [userId, roleId]
      );
    }

    res.redirect(
      '/employees?success=' +
        encodeURIComponent('Cập nhật nhân viên thành công')
    );
  } catch (err) {
    console.error('Error updating employee:', err);
    res.redirect(
      '/employees?error=' + encodeURIComponent('Không thể cập nhật nhân viên')
    );
  }
});

// Reset password
router.post('/:id/reset-password', async (req, res) => {
  try {
    // Generate random password
    const newPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
            UPDATE "Users" SET
                "PasswordHash" = $1
            WHERE "Id" = $2
        `,
      [hashedPassword, req.params.id]
    );

    res.json({
      success: true,
      newPassword: newPassword,
      message: 'Đã đặt lại mật khẩu thành công',
    });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({
      success: false,
      message: 'Không thể đặt lại mật khẩu',
    });
  }
});

// Toggle user status
router.post('/:id/toggle-status', async (req, res) => {
  try {
    const { currentStatus } = req.body;
    const newStatus = !currentStatus;

    await pool.query(
      `
            UPDATE "Users" SET
                "EmailConfirmed" = $1
            WHERE "Id" = $2
        `,
      [newStatus, req.params.id]
    );

    res.json({
      success: true,
      message: newStatus
        ? 'Đã kích hoạt tài khoản'
        : 'Đã vô hiệu hóa tài khoản',
    });
  } catch (err) {
    console.error('Error toggling user status:', err);
    res.status(500).json({
      success: false,
      message: 'Không thể thay đổi trạng thái tài khoản',
    });
  }
});

module.exports = router;
