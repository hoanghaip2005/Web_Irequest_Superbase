const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all workflows
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT 
                w.*,
                p."PriorityName",
                COUNT(DISTINCT ws."StepID") as "StepCount",
                COUNT(DISTINCT r."RequestID") as "RequestCount"
            FROM "Workflow" w
            LEFT JOIN "Priority" p ON w."PriorityID" = p."PriorityID"
            LEFT JOIN "WorkflowSteps" ws ON w."WorkflowID" = ws."WorkflowID"
            LEFT JOIN "Requests" r ON w."WorkflowID" = r."WorkflowID" 
                AND r."StatusID" IN (SELECT "StatusID" FROM "Status" WHERE "StatusName" IN ('Đang xử lý', 'Chờ duyệt'))
            GROUP BY w."WorkflowID", p."PriorityName"
            ORDER BY w."WorkflowID" DESC
        `);

    // Get statistics
    const statsResult = await pool.query(`
            SELECT 
                COUNT(*) as "totalWorkflows",
                COUNT(*) FILTER (WHERE "IsActive" = true) as "activeWorkflows",
                (SELECT COUNT(*) FROM "WorkflowSteps") as "totalSteps",
                (SELECT COUNT(*) FROM "Requests" 
                 WHERE "WorkflowID" IS NOT NULL 
                 AND "StatusID" IN (SELECT "StatusID" FROM "Status" WHERE "StatusName" IN ('Đang xử lý', 'Chờ duyệt'))
                ) as "processingRequests"
            FROM "Workflow"
        `);

    const stats = statsResult.rows[0];

    // Get priorities for dropdown
    const prioritiesResult = await pool.query(`
            SELECT "PriorityID", "PriorityName" FROM "Priority" WHERE "IsActive" = true ORDER BY "PriorityName"
        `);

    res.render('workflows/index', {
      title: 'Quản lý Workflow',
      user: req.user,
      workflows: result.rows,
      priorities: prioritiesResult.rows,
      totalWorkflows: stats.totalWorkflows || 0,
      activeWorkflows: stats.activeWorkflows || 0,
      totalSteps: stats.totalSteps || 0,
      processingRequests: stats.processingRequests || 0,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (err) {
    console.error('Error fetching workflows:', err);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      user: req.user,
      error: 'Không thể tải danh sách workflow',
    });
  }
});

// Get workflow templates page
router.get('/templates', async (req, res) => {
  try {
    // Get all active workflows as templates
    const templatesResult = await pool.query(`
            SELECT 
                w.*,
                p."PriorityName",
                COUNT(DISTINCT ws."StepID") as "StepCount"
            FROM "Workflow" w
            LEFT JOIN "Priority" p ON w."PriorityID" = p."PriorityID"
            LEFT JOIN "WorkflowSteps" ws ON w."WorkflowID" = ws."WorkflowID"
            WHERE w."IsActive" = true
            GROUP BY w."WorkflowID", p."PriorityName"
            ORDER BY w."WorkflowName"
        `);

    res.render('workflows/templates', {
      title: 'Mẫu Quy trình',
      page: 'workflows',
      user: req.user,
      templates: templatesResult.rows,
    });
  } catch (err) {
    console.error('Error fetching workflow templates:', err);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      user: req.user,
      error: 'Không thể tải mẫu quy trình',
    });
  }
});

// Get workflow builder page
router.get('/builder', async (req, res) => {
  try {
    // Get roles for assignment
    const rolesResult = await pool.query(`
            SELECT "Id", "Name" FROM "Roles" ORDER BY "Name"
        `);

    // Get statuses
    const statusesResult = await pool.query(`
            SELECT "StatusID", "StatusName" FROM "Status" ORDER BY "StatusName"
        `);

    // Get departments
    const departmentsResult = await pool.query(`
            SELECT "DepartmentID", "Name" FROM "Departments" 
            WHERE "IsActive" = true 
            ORDER BY "Name"
        `);

    // Get priorities
    const prioritiesResult = await pool.query(`
            SELECT "PriorityID", "PriorityName" FROM "Priority" 
            WHERE "IsActive" = true 
            ORDER BY "PriorityName"
        `);

    res.render('workflows/builder', {
      title: 'Thiết kế Quy trình',
      page: 'workflows',
      user: req.user,
      roles: rolesResult.rows,
      statuses: statusesResult.rows,
      departments: departmentsResult.rows,
      priorities: prioritiesResult.rows,
    });
  } catch (err) {
    console.error('Error loading workflow builder:', err);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      user: req.user,
      error: 'Không thể tải trình thiết kế quy trình',
    });
  }
});

// Get workflow details
router.get('/:id', async (req, res) => {
  try {
    const workflowResult = await pool.query(
      `
            SELECT 
                w.*,
                p."PriorityName"
            FROM "Workflow" w
            LEFT JOIN "Priority" p ON w."PriorityID" = p."PriorityID"
            WHERE w."WorkflowID" = $1
        `,
      [req.params.id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        user: req.user,
      });
    }

    const stepsResult = await pool.query(
      `
            SELECT 
                ws.*,
                s."StatusName"
            FROM "WorkflowSteps" ws
            LEFT JOIN "Status" s ON ws."StatusID" = s."StatusID"
            WHERE ws."WorkflowID" = $1
            ORDER BY ws."StepOrder"
        `,
      [req.params.id]
    );

    const requestsResult = await pool.query(
      `
            SELECT 
                r.*,
                s."StatusName",
                u."UserName",
                u."Email"
            FROM "Requests" r
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            LEFT JOIN "Users" u ON r."UsersId" = u."Id"
            WHERE r."WorkflowID" = $1
            ORDER BY r."CreatedAt" DESC
            LIMIT 10
        `,
      [req.params.id]
    );

    res.render('workflows/detail', {
      title: `Workflow: ${workflowResult.rows[0].WorkflowName}`,
      user: req.user,
      workflow: workflowResult.rows[0],
      steps: stepsResult.rows,
      requests: requestsResult.rows,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (err) {
    console.error('Error fetching workflow details:', err);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      user: req.user,
      error: 'Không thể tải thông tin workflow',
    });
  }
});

// Create new workflow
router.post('/create', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      workflowName,
      description,
      priorityId,
      isActive,
      steps,
      connections,
    } = req.body;

    // Insert workflow
    const workflowResult = await client.query(
      `
            INSERT INTO "Workflow" (
                "WorkflowName",
                "Description",
                "PriorityID",
                "IsActive"
            ) VALUES ($1, $2, $3, $4)
            RETURNING "WorkflowID"
        `,
      [
        workflowName,
        description || null,
        priorityId || null,
        isActive !== false,
      ]
    );

    const workflowId = workflowResult.rows[0].WorkflowID;

    // Insert workflow steps if provided
    if (steps && steps.length > 0) {
      for (const step of steps) {
        await client.query(
          `
                    INSERT INTO "WorkflowSteps" (
                        "WorkflowID",
                        "StepName",
                        "Description",
                        "StepOrder",
                        "AssignedRoleId",
                        "StatusID",
                        "ExpectedDuration",
                        "IsApprovalStep"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `,
          [
            workflowId,
            step.stepName,
            step.description || null,
            step.stepOrder,
            step.assignedRoleId || null,
            step.statusId || null,
            step.expectedDuration || null,
            step.isApprovalStep || false,
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Tạo workflow thành công',
      workflowId: workflowId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating workflow:', err);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo workflow: ' + err.message,
    });
  } finally {
    client.release();
  }
});

// Update workflow
router.post('/update', async (req, res) => {
  try {
    const { workflowId, workflowName, description, priorityId, isActive } =
      req.body;

    await pool.query(
      `
            UPDATE "Workflow" SET
                "WorkflowName" = $1,
                "Description" = $2,
                "PriorityID" = $3,
                "IsActive" = $4
            WHERE "WorkflowID" = $5
        `,
      [
        workflowName,
        description || null,
        priorityId || null,
        isActive === 'on',
        workflowId,
      ]
    );

    res.redirect(
      '/workflows?success=' + encodeURIComponent('Cập nhật workflow thành công')
    );
  } catch (err) {
    console.error('Error updating workflow:', err);
    res.redirect(
      '/workflows?error=' + encodeURIComponent('Không thể cập nhật workflow')
    );
  }
});

// Toggle workflow status
router.post('/:id/toggle', async (req, res) => {
  try {
    const { currentStatus } = req.body;
    const newStatus = currentStatus === 'true' ? false : true;

    await pool.query(
      `
            UPDATE "Workflow" SET
                "IsActive" = $1
            WHERE "WorkflowID" = $2
        `,
      [newStatus, req.params.id]
    );

    res.json({
      success: true,
      message: newStatus ? 'Đã kích hoạt workflow' : 'Đã vô hiệu hóa workflow',
    });
  } catch (err) {
    console.error('Error toggling workflow status:', err);
    res.status(500).json({
      success: false,
      message: 'Không thể thay đổi trạng thái workflow',
    });
  }
});

// Delete workflow
router.delete('/:id', async (req, res) => {
  try {
    // Check if workflow has any requests
    const requestCheck = await pool.query(
      `
            SELECT COUNT(*) as count FROM "Requests" WHERE "WorkflowID" = $1
        `,
      [req.params.id]
    );

    if (parseInt(requestCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa workflow đang được sử dụng bởi các yêu cầu',
      });
    }

    // Delete workflow steps first
    await pool.query(
      `
            DELETE FROM "WorkflowSteps" WHERE "WorkflowID" = $1
        `,
      [req.params.id]
    );

    // Delete workflow
    await pool.query(
      `
            DELETE FROM "Workflow" WHERE "WorkflowID" = $1
        `,
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Đã xóa workflow thành công',
    });
  } catch (err) {
    console.error('Error deleting workflow:', err);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa workflow',
    });
  }
});

// Get workflow setup/configuration page
router.get('/:id/setup', async (req, res) => {
  try {
    const workflowResult = await pool.query(
      `
            SELECT 
                w.*,
                p."PriorityName"
            FROM "Workflow" w
            LEFT JOIN "Priority" p ON w."PriorityID" = p."PriorityID"
            WHERE w."WorkflowID" = $1
        `,
      [req.params.id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        user: req.user,
      });
    }

    const stepsResult = await pool.query(
      `
            SELECT 
                ws.*,
                s."StatusName",
                r."Name" as "AssignedRoleName"
            FROM "WorkflowSteps" ws
            LEFT JOIN "Status" s ON ws."StatusID" = s."StatusID"
            LEFT JOIN "Roles" r ON ws."AssignedRoleId" = r."Id"
            WHERE ws."WorkflowID" = $1
            ORDER BY ws."StepOrder"
        `,
      [req.params.id]
    );

    // Get departments
    const departmentsResult = await pool.query(`
            SELECT "DepartmentID", "Name" FROM "Departments" 
            WHERE "IsActive" = true 
            ORDER BY "Name"
        `);

    // Get workflow statistics
    const statsResult = await pool.query(
      `
            SELECT 
                COUNT(DISTINCT r."RequestID") FILTER (WHERE s."StatusName" = 'Đang xử lý') as "processingCount",
                COUNT(DISTINCT r."RequestID") FILTER (WHERE s."StatusName" = 'Hoàn thành') as "completedCount",
                ROUND(AVG(EXTRACT(EPOCH FROM (r."UpdatedAt" - r."CreatedAt"))/3600), 1) as "avgDuration",
                ROUND(
                    COUNT(DISTINCT r."RequestID") FILTER (WHERE s."StatusName" = 'Hoàn thành')::numeric / 
                    NULLIF(COUNT(DISTINCT r."RequestID"), 0) * 100, 0
                ) as "completionRate"
            FROM "Requests" r
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            WHERE r."WorkflowID" = $1
        `,
      [req.params.id]
    );

    const stats = statsResult.rows[0] || {
      processingCount: 0,
      completedCount: 0,
      avgDuration: '0',
      completionRate: 0,
    };

    res.render('workflows/setup', {
      title: `Thiết lập Workflow: ${workflowResult.rows[0].WorkflowName}`,
      user: req.user,
      workflow: workflowResult.rows[0],
      steps: stepsResult.rows,
      departments: departmentsResult.rows,
      stats: stats,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (err) {
    console.error('Error fetching workflow setup:', err);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      user: req.user,
      error: 'Không thể tải trang thiết lập workflow',
    });
  }
});

// Get workflow steps
router.get('/:id/steps', async (req, res) => {
  try {
    const workflowResult = await pool.query(
      `
            SELECT 
                w.*,
                p."PriorityName"
            FROM "Workflow" w
            LEFT JOIN "Priority" p ON w."PriorityID" = p."PriorityID"
            WHERE w."WorkflowID" = $1
        `,
      [req.params.id]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).render('errors/404', {
        title: 'Không tìm thấy',
        user: req.user,
      });
    }

    const stepsResult = await pool.query(
      `
            SELECT 
                ws.*,
                s."StatusName",
                r."Name" as "AssignedRoleName"
            FROM "WorkflowSteps" ws
            LEFT JOIN "Status" s ON ws."StatusID" = s."StatusID"
            LEFT JOIN "Roles" r ON ws."AssignedRoleId" = r."Id"
            WHERE ws."WorkflowID" = $1
            ORDER BY ws."StepOrder"
        `,
      [req.params.id]
    );

    // Get roles for assignment
    const rolesResult = await pool.query(`
            SELECT "Id", "Name" FROM "Roles" ORDER BY "Name"
        `);

    // Get statuses
    const statusesResult = await pool.query(`
            SELECT "StatusID", "StatusName" FROM "Status" ORDER BY "StatusName"
        `);

    res.render('workflows/steps', {
      title: `Bước Workflow: ${workflowResult.rows[0].WorkflowName}`,
      user: req.user,
      workflow: workflowResult.rows[0],
      steps: stepsResult.rows,
      roles: rolesResult.rows,
      statuses: statusesResult.rows,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (err) {
    console.error('Error fetching workflow steps:', err);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      user: req.user,
      error: 'Không thể tải danh sách bước',
    });
  }
});

// Create workflow step
router.post('/:id/steps/create', async (req, res) => {
  try {
    const {
      stepName,
      stepDescription,
      stepOrder,
      expectedDuration,
      assignedRoleId,
      statusId,
      requiresApproval,
      isAutomatic,
      canSkip,
    } = req.body;

    await pool.query(
      `
            INSERT INTO "WorkflowSteps" (
                "WorkflowID",
                "StepName",
                "StepDescription",
                "StepOrder",
                "ExpectedDuration",
                "AssignedRoleId",
                "StatusID",
                "RequiresApproval",
                "IsAutomatic",
                "CanSkip"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
      [
        req.params.id,
        stepName,
        stepDescription || null,
        stepOrder,
        expectedDuration || null,
        assignedRoleId || null,
        statusId || null,
        requiresApproval === 'on',
        isAutomatic === 'on',
        canSkip === 'on',
      ]
    );

    res.redirect(
      `/workflows/${req.params.id}/steps?success=` +
        encodeURIComponent('Thêm bước thành công')
    );
  } catch (err) {
    console.error('Error creating workflow step:', err);
    res.redirect(
      `/workflows/${req.params.id}/steps?error=` +
        encodeURIComponent('Không thể thêm bước')
    );
  }
});

// Update workflow step
router.post('/:id/steps/update', async (req, res) => {
  try {
    const {
      stepId,
      stepName,
      stepDescription,
      stepOrder,
      expectedDuration,
      assignedRoleId,
      statusId,
      requiresApproval,
      isAutomatic,
      canSkip,
    } = req.body;

    await pool.query(
      `
            UPDATE "WorkflowSteps" SET
                "StepName" = $1,
                "StepDescription" = $2,
                "StepOrder" = $3,
                "ExpectedDuration" = $4,
                "AssignedRoleId" = $5,
                "StatusID" = $6,
                "RequiresApproval" = $7,
                "IsAutomatic" = $8,
                "CanSkip" = $9
            WHERE "StepID" = $10 AND "WorkflowID" = $11
        `,
      [
        stepName,
        stepDescription || null,
        stepOrder,
        expectedDuration || null,
        assignedRoleId || null,
        statusId || null,
        requiresApproval === 'on',
        isAutomatic === 'on',
        canSkip === 'on',
        stepId,
        req.params.id,
      ]
    );

    res.redirect(
      `/workflows/${req.params.id}/steps?success=` +
        encodeURIComponent('Cập nhật bước thành công')
    );
  } catch (err) {
    console.error('Error updating workflow step:', err);
    res.redirect(
      `/workflows/${req.params.id}/steps?error=` +
        encodeURIComponent('Không thể cập nhật bước')
    );
  }
});

// Delete workflow step
router.delete('/steps/:id', async (req, res) => {
  try {
    await pool.query(
      `
            DELETE FROM "WorkflowSteps" WHERE "StepID" = $1
        `,
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Đã xóa bước thành công',
    });
  } catch (err) {
    console.error('Error deleting workflow step:', err);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa bước',
    });
  }
});

// Move step up
router.post('/steps/:id/move-up', async (req, res) => {
  try {
    const stepResult = await pool.query(
      `
            SELECT "StepOrder", "WorkflowID" FROM "WorkflowSteps" WHERE "StepID" = $1
        `,
      [req.params.id]
    );

    if (stepResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy bước' });
    }

    const currentOrder = stepResult.rows[0].StepOrder;
    const workflowId = stepResult.rows[0].WorkflowID;

    if (currentOrder <= 1) {
      return res
        .status(400)
        .json({ success: false, message: 'Không thể di chuyển lên' });
    }

    // Swap with previous step
    await pool.query(
      `
            UPDATE "WorkflowSteps" SET "StepOrder" = $1
            WHERE "WorkflowID" = $2 AND "StepOrder" = $3
        `,
      [currentOrder, workflowId, currentOrder - 1]
    );

    await pool.query(
      `
            UPDATE "WorkflowSteps" SET "StepOrder" = $1
            WHERE "StepID" = $2
        `,
      [currentOrder - 1, req.params.id]
    );

    res.json({ success: true, message: 'Đã di chuyển bước lên' });
  } catch (err) {
    console.error('Error moving step up:', err);
    res
      .status(500)
      .json({ success: false, message: 'Không thể di chuyển bước' });
  }
});

// Move step down
router.post('/steps/:id/move-down', async (req, res) => {
  try {
    const stepResult = await pool.query(
      `
            SELECT "StepOrder", "WorkflowID" FROM "WorkflowSteps" WHERE "StepID" = $1
        `,
      [req.params.id]
    );

    if (stepResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy bước' });
    }

    const currentOrder = stepResult.rows[0].StepOrder;
    const workflowId = stepResult.rows[0].WorkflowID;

    const maxOrderResult = await pool.query(
      `
            SELECT MAX("StepOrder") as max FROM "WorkflowSteps" WHERE "WorkflowID" = $1
        `,
      [workflowId]
    );

    if (currentOrder >= maxOrderResult.rows[0].max) {
      return res
        .status(400)
        .json({ success: false, message: 'Không thể di chuyển xuống' });
    }

    // Swap with next step
    await pool.query(
      `
            UPDATE "WorkflowSteps" SET "StepOrder" = $1
            WHERE "WorkflowID" = $2 AND "StepOrder" = $3
        `,
      [currentOrder, workflowId, currentOrder + 1]
    );

    await pool.query(
      `
            UPDATE "WorkflowSteps" SET "StepOrder" = $1
            WHERE "StepID" = $2
        `,
      [currentOrder + 1, req.params.id]
    );

    res.json({ success: true, message: 'Đã di chuyển bước xuống' });
  } catch (err) {
    console.error('Error moving step down:', err);
    res
      .status(500)
      .json({ success: false, message: 'Không thể di chuyển bước' });
  }
});

// Update workflow settings from setup page
router.post('/:id/update', async (req, res) => {
  try {
    const {
      workflowName,
      description,
      requestType,
      priority,
      department,
      maxDuration,
      isActive,
      allowParallel,
    } = req.body;

    await pool.query(
      `
            UPDATE "Workflow" SET
                "WorkflowName" = $1,
                "Description" = $2,
                "UpdatedAt" = NOW()
            WHERE "WorkflowID" = $3
        `,
      [workflowName, description || null, req.params.id]
    );

    res.json({
      success: true,
      message: 'Đã cập nhật workflow thành công!',
    });
  } catch (err) {
    console.error('Error updating workflow:', err);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật workflow',
    });
  }
});

module.exports = router;
