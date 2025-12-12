const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Departments list
router.get('/', authenticateToken, async (req, res) => {
  try {
    const search = req.query.search || '';

    // Get departments with stats
    const departmentsQuery = `
      SELECT 
        d.*,
        u."Email" as "ManagerEmail",
        (SELECT COUNT(*) FROM "Users" WHERE "DepartmentID" = d."DepartmentID") as "EmployeeCount",
        (SELECT COUNT(*) FROM "Requests" r JOIN "Users" u2 ON r."UsersId" = u2."Id" WHERE u2."DepartmentID" = d."DepartmentID") as "RequestCount"
      FROM "Departments" d
      LEFT JOIN "Users" u ON d."AssignedUserId" = u."Id"
      WHERE d."Name" ILIKE $1
      ORDER BY d."Name" ASC
    `;

    const departmentsResult = await query(departmentsQuery, [`%${search}%`]);

    // Get stats
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM "Departments") as "totalDepartments",
        (SELECT COUNT(*) FROM "Users") as "totalEmployees",
        (SELECT COUNT(*) FROM "Requests" WHERE "ClosedAt" IS NULL) as "activeRequests",
        (SELECT COUNT(DISTINCT "AssignedUserId") FROM "Departments" WHERE "AssignedUserId" IS NOT NULL) as "totalManagers"
    `;
    const statsResult = await query(statsQuery);

    // Get all users for the dropdown
    const usersQuery = `SELECT "Id", "Email" FROM "Users" ORDER BY "Email" ASC`;
    const usersResult = await query(usersQuery);

    res.render('departments/index', {
      title: 'Quản lý phòng ban',
      departments: departmentsResult.rows,
      stats: statsResult.rows[0],
      users: usersResult.rows,
      search: search,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Departments list error:', error);
    res.render('departments/index', {
      title: 'Quản lý phòng ban',
      error: 'Không thể tải danh sách phòng ban',
      departments: [],
      stats: {
        totalDepartments: 0,
        totalEmployees: 0,
        activeRequests: 0,
        totalManagers: 0,
      },
      users: [],
      search: '',
    });
  }
});

// GET /:id/edit - Must be before /:id
router.get('/:id/edit', authenticateToken, async (req, res) => {
  try {
    const departmentId = req.params.id;

    // Get department info
    const departmentQuery = `
      SELECT d.*, u."UserName", u."Email" as "ManagerEmail"
      FROM "Departments" d
      LEFT JOIN "Users" u ON d."AssignedUserId" = u."Id"
      WHERE d."DepartmentID" = $1
    `;
    const departmentResult = await query(departmentQuery, [departmentId]);

    if (departmentResult.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Phòng ban không tồn tại',
      });
    }

    const department = departmentResult.rows[0];

    // Get employee count
    const countQuery = `SELECT COUNT(*) as count FROM "Users" WHERE "DepartmentID" = $1`;
    const countResult = await query(countQuery, [departmentId]);

    // Get all users for dropdown
    const usersQuery = `
      SELECT "Id", "UserName", "Email" 
      FROM "Users" 
      ORDER BY "UserName" ASC
    `;
    const usersResult = await query(usersQuery);

    res.render('departments/edit', {
      title: 'Chỉnh sửa phòng ban',
      department: department,
      employeeCount: countResult.rows[0].count,
      users: usersResult.rows,
    });
  } catch (error) {
    console.error('Edit department error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi hệ thống',
      message: 'Không thể tải form chỉnh sửa',
    });
  }
});

// Department detail
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const departmentId = req.params.id;

    // Get department info
    const departmentQuery = `
      SELECT d.*, u."Email" as "ManagerEmail"
      FROM "Departments" d
      LEFT JOIN "Users" u ON d."AssignedUserId" = u."Id"
      WHERE d."DepartmentID" = $1
    `;
    const departmentResult = await query(departmentQuery, [departmentId]);

    if (departmentResult.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        message: 'Phòng ban không tồn tại',
      });
    }

    const department = departmentResult.rows[0];

    // Get employees
    const employeesQuery = `
      SELECT "Id", "UserName", "Email", "PhoneNumber"
      FROM "Users"
      WHERE "DepartmentID" = $1
      ORDER BY "Email" ASC
    `;
    const employeesResult = await query(employeesQuery, [departmentId]);

    // Get requests
    const requestsQuery = `
      SELECT r.*, s."StatusName", p."PriorityName"
      FROM "Requests" r
      JOIN "Users" u ON r."UsersId" = u."Id"
      JOIN "Status" s ON r."StatusID" = s."StatusID"
      JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      WHERE u."DepartmentID" = $1
      ORDER BY r."CreatedAt" DESC
      LIMIT 10
    `;
    const requestsResult = await query(requestsQuery, [departmentId]);

    res.render('departments/detail', {
      title: department.Name,
      department: department,
      employees: employeesResult.rows,
      requests: requestsResult.rows,
    });
  } catch (error) {
    console.error('Department detail error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi hệ thống',
      message: 'Không thể tải thông tin phòng ban',
    });
  }
});

// Create department
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, code, description, managerId, isActive } = req.body;

    // Validate required fields
    if (!name) {
      return res.redirect(
        '/departments?error=' +
          encodeURIComponent('Vui lòng điền tên phòng ban')
      );
    }

    // Check if name already exists
    const checkQuery = `SELECT "DepartmentID" FROM "Departments" WHERE "Name" = $1`;
    const checkResult = await query(checkQuery, [name]);

    if (checkResult.rows.length > 0) {
      return res.redirect(
        '/departments?error=' + encodeURIComponent('Tên phòng ban đã tồn tại')
      );
    }

    const createQuery = `
      INSERT INTO "Departments" (
        "Name", "Description", "AssignedUserId", "IsActive", "CreatedAt"
      )
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING "DepartmentID"
    `;

    await query(createQuery, [
      name,
      description || null,
      managerId || null,
      isActive === 'on',
    ]);

    res.redirect(
      '/departments?success=' + encodeURIComponent('Tạo phòng ban thành công')
    );
  } catch (error) {
    console.error('Create department error:', error);
    res.redirect(
      '/departments?error=' +
        encodeURIComponent('Không thể tạo phòng ban: ' + error.message)
    );
  }
});

// Update department
router.post('/update', authenticateToken, async (req, res) => {
  try {
    const { departmentId, departmentName, description, managerId } = req.body;

    const updateQuery = `
      UPDATE "Departments"
      SET 
        "Name" = $1,
        "Description" = $2,
        "AssignedUserId" = $3
      WHERE "DepartmentID" = $4
    `;

    await query(updateQuery, [
      departmentName,
      description || '',
      managerId || null,
      departmentId,
    ]);

    res.redirect(
      '/departments?success=' +
        encodeURIComponent('Đã cập nhật phòng ban thành công')
    );
  } catch (error) {
    console.error('Update department error:', error);
    res.redirect(
      '/departments?error=' + encodeURIComponent('Không thể cập nhật phòng ban')
    );
  }
});

// PUT /:id - Cập nhật phòng ban
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { name, code, description, managerId, isActive } = req.body;

    // Validate required fields
    if (!name) {
      return res.redirect(
        `/departments/${departmentId}/edit?error=` +
          encodeURIComponent('Vui lòng điền tên phòng ban')
      );
    }

    // Check if name already exists (except current department)
    const checkQuery = `
      SELECT "DepartmentID" FROM "Departments" 
      WHERE "Name" = $1 AND "DepartmentID" != $2
    `;
    const checkResult = await query(checkQuery, [name, departmentId]);

    if (checkResult.rows.length > 0) {
      return res.redirect(
        `/departments/${departmentId}/edit?error=` +
          encodeURIComponent('Tên phòng ban đã tồn tại')
      );
    }

    // Update department
    const updateQuery = `
      UPDATE "Departments"
      SET 
        "Name" = $1,
        "Description" = $2,
        "AssignedUserId" = $3,
        "IsActive" = $4
      WHERE "DepartmentID" = $5
    `;

    await query(updateQuery, [
      name,
      description || null,
      managerId || null,
      isActive === 'on',
      departmentId,
    ]);

    res.redirect(
      `/departments/${departmentId}?success=` +
        encodeURIComponent('Cập nhật phòng ban thành công')
    );
  } catch (error) {
    console.error('Update department error:', error);
    res.redirect(
      `/departments/${req.params.id}/edit?error=` +
        encodeURIComponent('Không thể cập nhật: ' + error.message)
    );
  }
});

// DELETE /:id - Xóa phòng ban
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const departmentId = req.params.id;

    // Check if department has employees
    const checkQuery = `SELECT COUNT(*) as count FROM "Users" WHERE "DepartmentID" = $1`;
    const checkResult = await query(checkQuery, [departmentId]);

    const employeeCount = parseInt(checkResult.rows[0].count);

    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa phòng ban này vì còn ${employeeCount} nhân viên. Vui lòng chuyển nhân viên sang phòng ban khác trước.`,
      });
    }

    // Delete department
    await query(`DELETE FROM "Departments" WHERE "DepartmentID" = $1`, [
      departmentId,
    ]);

    res.json({
      success: true,
      message: 'Xóa phòng ban thành công',
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa phòng ban: ' + error.message,
    });
  }
});

module.exports = router;
