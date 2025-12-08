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
      SELECT "Id", "Email", "PhoneNumber", "CreatedAt"
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
    const { departmentName, departmentCode, description, managerId } = req.body;

    const createQuery = `
      INSERT INTO "Departments" (
        "Name", "Description", "AssignedUserId", "CreatedAt", "IsActive"
      )
      VALUES ($1, $2, $3, NOW(), true)
      RETURNING "DepartmentID"
    `;

    await query(createQuery, [
      departmentName,
      description || '',
      managerId || null,
    ]);

    res.redirect(
      '/departments?success=' +
        encodeURIComponent('Đã tạo phòng ban thành công')
    );
  } catch (error) {
    console.error('Create department error:', error);
    res.redirect(
      '/departments?error=' + encodeURIComponent('Không thể tạo phòng ban')
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

// Delete department
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const departmentId = req.params.id;

    // Check if department has employees
    const checkQuery = `SELECT COUNT(*) as count FROM "Users" WHERE "DepartmentID" = $1`;
    const checkResult = await query(checkQuery, [departmentId]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      // Update employees to remove department
      await query(
        `UPDATE "Users" SET "DepartmentID" = NULL WHERE "DepartmentID" = $1`,
        [departmentId]
      );
    }

    // Delete department
    await query(`DELETE FROM "Departments" WHERE "DepartmentID" = $1`, [
      departmentId,
    ]);

    res.json({ success: true, message: 'Đã xóa phòng ban' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
