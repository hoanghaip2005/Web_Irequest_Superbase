const { query, transaction } = require('../config/database');

class Request {
  // Tạo request mới
  static async create(requestData) {
    const {
      title,
      description,
      userId,
      priorityId = null,
      workflowId = null,
      statusId = 1, // Default to "Mới"
      attachmentURL = null,
      attachmentFileName = null,
      attachmentFileSize = null,
      attachmentFileType = null,
      issueType = null,
      formData = null,
    } = requestData;

    const result = await query(
      `
            INSERT INTO "Requests" (
                "Title", "Description", "UsersId", "PriorityID", "WorkflowID", "StatusID",
                "AttachmentURL", "AttachmentFileName", "AttachmentFileSize", 
                "AttachmentFileType", "IssueType", "FormData", "IsApproved", 
                "CreatedAt", "UpdatedAt", "CurrentStepOrder", "RoleId"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `,
      [
        title,
        description,
        userId,
        priorityId,
        workflowId,
        statusId,
        attachmentURL,
        attachmentFileName,
        attachmentFileSize,
        attachmentFileType,
        issueType,
        formData ? JSON.stringify(formData) : null,
        false,
        new Date(),
        new Date(),
        0,
        '',
      ]
    );

    return result.rows[0];
  }

  // Lấy request theo ID với thông tin chi tiết
  static async findById(id) {
    const result = await query(
      `
            SELECT 
                r.*,
                u."UserName" as "CreatedByUser",
                u."Email" as "CreatedByEmail",
                au."UserName" as "AssignedToUser",
                au."Email" as "AssignedToEmail",
                s."StatusName",
                s."IsFinal" as "IsStatusFinal",
                p."PriorityName",
                p."ColorCode" as "PriorityColor",
                w."WorkflowName",
                d."Name" as "DepartmentName"
            FROM "Requests" r
            LEFT JOIN "Users" u ON r."UsersId" = u."Id"
            LEFT JOIN "Users" au ON r."AssignedUserId" = au."Id"
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
            LEFT JOIN "Workflow" w ON r."WorkflowID" = w."WorkflowID"
            LEFT JOIN "Departments" d ON au."DepartmentID" = d."DepartmentID"
            WHERE r."RequestID" = $1
        `,
      [id]
    );

    return result.rows[0];
  }

  // Lấy tất cả requests với phân trang và filter
  static async getAll(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];
    let paramCount = 1;

    // IMPORTANT: Exclude draft status from main list
    conditions.push(`s."StatusName" != 'Nháp'`);

    // Build WHERE conditions
    if (filters.userId) {
      conditions.push(
        `(r."UsersId" = $${paramCount} OR r."AssignedUserId" = $${paramCount})`
      );
      params.push(filters.userId);
      paramCount++;
    }

    if (filters.statusId) {
      conditions.push(`r."StatusID" = $${paramCount}`);
      params.push(filters.statusId);
      paramCount++;
    }

    if (filters.priorityId) {
      conditions.push(`r."PriorityID" = $${paramCount}`);
      params.push(filters.priorityId);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(
        `(r."Title" ILIKE $${paramCount} OR r."Description" ILIKE $${paramCount})`
      );
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit, offset);

    const result = await query(
      `
      SELECT 
        r.*,
        u."UserName" as "CreatedByUser",
        u."Email" as "CreatedByEmail",
        au."UserName" as "AssignedToUser",
        au."Email" as "AssignedToEmail",
        s."StatusName",
        s."IsFinal" as "IsStatusFinal",
        p."PriorityName",
        p."ColorCode" as "PriorityColor",
        w."WorkflowName",
        d."Name" as "DepartmentName",
        COALESCE(comment_count.count, 0) as "CommentCount",
        COALESCE(view_count.count, 0) as "ViewCount"
      FROM "Requests" r
      LEFT JOIN "Users" u ON r."UsersId" = u."Id"
      LEFT JOIN "Users" au ON r."AssignedUserId" = au."Id"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      LEFT JOIN "Workflow" w ON r."WorkflowID" = w."WorkflowID"
      LEFT JOIN "Departments" d ON au."DepartmentID" = d."DepartmentID"
      LEFT JOIN (
        SELECT "RequestId", COUNT(*) as count 
        FROM "Comments" 
        GROUP BY "RequestId"
      ) comment_count ON r."RequestID" = comment_count."RequestId"
      LEFT JOIN (
        SELECT "RequestID", COUNT(*) as count 
        FROM "RequestViews" 
        GROUP BY "RequestID"
      ) view_count ON r."RequestID" = view_count."RequestID"
      ${whereClause}
      ORDER BY r."CreatedAt" DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `,
      params
    );

    return result.rows;
  }

  // Đếm tổng số requests
  static async count(filters = {}) {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    // IMPORTANT: Exclude draft status from main list
    conditions.push(`"StatusID" != (SELECT "StatusID" FROM "Status" WHERE "StatusName" = 'Nháp' LIMIT 1)`);

    if (filters.userId) {
      conditions.push(
        `("UsersId" = $${paramCount} OR "AssignedUserId" = $${paramCount})`
      );
      params.push(filters.userId);
      paramCount++;
    }

    if (filters.statusId) {
      conditions.push(`"StatusID" = $${paramCount}`);
      params.push(filters.statusId);
      paramCount++;
    }

    if (filters.priorityId) {
      conditions.push(`"PriorityID" = $${paramCount}`);
      params.push(filters.priorityId);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(
        `("Title" ILIKE $${paramCount} OR "Description" ILIKE $${paramCount})`
      );
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `
      SELECT COUNT(*) as total FROM "Requests" ${whereClause}
    `,
      params
    );

    return parseInt(result.rows[0].total);
  }

  // Cập nhật request
  static async update(id, requestData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(requestData).forEach((key) => {
      if (requestData[key] !== undefined) {
        fields.push(`"${key}" = $${paramCount}`);
        values.push(requestData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Always update UpdatedAt
    fields.push(`"UpdatedAt" = $${paramCount}`);
    values.push(new Date());
    paramCount++;

    values.push(id);

    const result = await query(
      `
      UPDATE "Requests" 
      SET ${fields.join(', ')}
      WHERE "RequestID" = $${paramCount}
      RETURNING *
    `,
      values
    );

    return result.rows[0];
  }

  // Gán request cho user
  static async assignToUser(requestId, userId) {
    return await this.update(requestId, {
      AssignedUserId: userId,
    });
  }

  // Thay đổi status
  static async updateStatus(requestId, statusId, note = null) {
    const queries = [
      {
        text: 'UPDATE "Requests" SET "StatusID" = $1, "UpdatedAt" = $2 WHERE "RequestID" = $3',
        params: [statusId, new Date(), requestId],
      },
      {
        text: `INSERT INTO "RequestStepHistory" (
          "RequestID", "StatusID", "CreatedAt", "ActionTime", "Note"
        ) VALUES ($1, $2, $3, $4, $5)`,
        params: [requestId, statusId, new Date(), new Date(), note],
      },
    ];

    return await transaction(queries);
  }

  // Thêm view cho request
  static async addView(requestId, userId) {
    try {
      // Check if view already exists
      const existingView = await query(
        `
                SELECT "RequestViewId" FROM "RequestViews" 
                WHERE "RequestID" = $1 AND "UserId" = $2
            `,
        [requestId, userId]
      );

      // Only insert if view doesn't exist
      if (existingView.rows.length === 0) {
        await query(
          `
                    INSERT INTO "RequestViews" ("RequestID", "UserId", "ViewedAt")
                    VALUES ($1, $2, $3)
                `,
          [requestId, userId, new Date()]
        );
      }
    } catch (error) {
      // Ignore view tracking errors
      console.log('View tracking error:', error.message);
    }
  }

  // Xóa request
  static async delete(id) {
    const result = await query(
      'DELETE FROM "Requests" WHERE "RequestID" = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Lấy comments của request
  static async getComments(requestId) {
    const result = await query(
      `
      SELECT c.*, u."UserName", u."Avatar"
      FROM "Comments" c
      JOIN "Users" u ON c."UserId" = u."Id"
      WHERE c."RequestId" = $1
      ORDER BY c."CreatedAt" ASC
    `,
      [requestId]
    );

    return result.rows;
  }

  // Lấy dữ liệu dashboard
  static async getDashboardData(userId) {
    try {
      const [myRequestsResult, assignedResult, pendingResult, recentResult] =
        await Promise.all([
          // Yêu cầu của tôi
          query(
            'SELECT COUNT(*) as count FROM "Requests" WHERE "UsersId" = $1',
            [userId]
          ),

          // Được giao cho tôi
          query(
            'SELECT COUNT(*) as count FROM "Requests" WHERE "AssignedUserId" = $1',
            [userId]
          ),

          // Yêu cầu chưa hoàn thành
          query(
            `
                    SELECT COUNT(*) as count 
                    FROM "Requests" r 
                    LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
                    WHERE r."UsersId" = $1 AND (s."IsFinal" = false OR s."IsFinal" IS NULL)
                `,
            [userId]
          ),

          // Hoạt động gần đây
          query(
            `
                    SELECT r."RequestID", r."Title", r."CreatedAt", s."StatusName"
                    FROM "Requests" r 
                    LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
                    WHERE r."UsersId" = $1 OR r."AssignedUserId" = $1
                    ORDER BY r."UpdatedAt" DESC 
                    LIMIT 5
                `,
            [userId]
          ),
        ]);

      return {
        myRequests: parseInt(myRequestsResult.rows[0].count) || 0,
        assignedToMe: parseInt(assignedResult.rows[0].count) || 0,
        pendingRequests: parseInt(pendingResult.rows[0].count) || 0,
        recentActivity: recentResult.rows || [],
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      return {
        myRequests: 0,
        assignedToMe: 0,
        pendingRequests: 0,
        recentActivity: [],
      };
    }
  }

  // Thêm comment
  static async addComment(requestId, userId, content) {
    const result = await query(
      `
      INSERT INTO "Comments" ("RequestId", "Id", "Content", "CreatedAt")
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [requestId, userId, content, new Date()]
    );

    return result.rows[0];
  }

  // Lấy yêu cầu được tạo bởi user
  static async getByCreator(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    let whereConditions = ['r."UsersId" = $1', 's."StatusName" != \'Nháp\''];
    let queryParams = [filters.creatorId];
    let paramIndex = 2;

    // Search filter
    if (filters.search) {
      whereConditions.push(
        `(r."Title" ILIKE $${paramIndex} OR r."Description" ILIKE $${paramIndex})`
      );
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Status filter
    if (filters.statusId) {
      whereConditions.push(`r."StatusID" = $${paramIndex}`);
      queryParams.push(filters.statusId);
      paramIndex++;
    }

    // Priority filter
    if (filters.priorityId) {
      whereConditions.push(`r."PriorityID" = $${paramIndex}`);
      queryParams.push(filters.priorityId);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `
            SELECT 
                r.*,
                u."UserName" as "CreatedByName",
                au."UserName" as "AssignedUserName",
                s."StatusName",
                p."PriorityName",
                w."WorkflowName"
            FROM "Requests" r
            LEFT JOIN "Users" u ON r."UsersId" = u."Id"
            LEFT JOIN "Users" au ON r."AssignedUserId" = au."Id"
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
            LEFT JOIN "Workflow" w ON r."WorkflowID" = w."WorkflowID"
            WHERE ${whereClause}
            ORDER BY r."CreatedAt" DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
      [...queryParams, limit, offset]
    );

    return result.rows;
  }

  // Đếm yêu cầu được tạo bởi user
  static async countByCreator(filters = {}) {
    let whereConditions = ['r."UsersId" = $1', 's."StatusName" != \'Nháp\''];
    let queryParams = [filters.creatorId];
    let paramIndex = 2;

    if (filters.search) {
      whereConditions.push(
        `(r."Title" ILIKE $${paramIndex} OR r."Description" ILIKE $${paramIndex})`
      );
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.statusId) {
      whereConditions.push(`r."StatusID" = $${paramIndex}`);
      queryParams.push(filters.statusId);
      paramIndex++;
    }

    if (filters.priorityId) {
      whereConditions.push(`r."PriorityID" = $${paramIndex}`);
      queryParams.push(filters.priorityId);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `
            SELECT COUNT(*) as count
            FROM "Requests" r
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            WHERE ${whereClause}
        `,
      queryParams
    );

    return result.rows[0].count;
  }

  // Lấy yêu cầu được giao cho user
  static async getAssignedTo(page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    let whereConditions = ['r."AssignedUserId" = $1'];
    let queryParams = [filters.assignedUserId];
    let paramIndex = 2;

    // Search filter
    if (filters.search) {
      whereConditions.push(
        `(r."Title" ILIKE $${paramIndex} OR u."UserName" ILIKE $${paramIndex})`
      );
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Status filter
    if (filters.statusId) {
      whereConditions.push(`r."StatusID" = $${paramIndex}`);
      queryParams.push(filters.statusId);
      paramIndex++;
    }

    // Priority filter
    if (filters.priorityId) {
      whereConditions.push(`r."PriorityID" = $${paramIndex}`);
      queryParams.push(filters.priorityId);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `
            SELECT 
                r.*,
                u."UserName" as "CreatedByName",
                d."Name" as "CreatedByDepartment",
                s."StatusName",
                p."PriorityName",
                w."WorkflowName",
                CASE 
                    WHEN r."CreatedAt" > (CURRENT_TIMESTAMP - INTERVAL '24 hours') THEN true 
                    ELSE false 
                END as "isNew"
            FROM "Requests" r
            LEFT JOIN "Users" u ON r."UsersId" = u."Id"
            LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
            LEFT JOIN "Workflow" w ON r."WorkflowID" = w."WorkflowID"
            WHERE ${whereClause}
            ORDER BY 
                r."PriorityID" ASC,
                r."CreatedAt" DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
      [...queryParams, limit, offset]
    );

    return result.rows;
  }

  // Đếm yêu cầu được giao cho user
  static async countAssignedTo(filters = {}) {
    let whereConditions = ['r."AssignedUserId" = $1'];
    let queryParams = [filters.assignedUserId];
    let paramIndex = 2;

    if (filters.search) {
      whereConditions.push(
        `(r."Title" ILIKE $${paramIndex} OR u."UserName" ILIKE $${paramIndex})`
      );
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.statusId) {
      whereConditions.push(`r."StatusID" = $${paramIndex}`);
      queryParams.push(filters.statusId);
      paramIndex++;
    }

    if (filters.priorityId) {
      whereConditions.push(`r."PriorityID" = $${paramIndex}`);
      queryParams.push(filters.priorityId);
      paramIndex++;
    }

    // Note: ExpectedDate column doesn't exist in current schema

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `
            SELECT COUNT(*) as count
            FROM "Requests" r
            LEFT JOIN "Users" u ON r."UsersId" = u."Id"
            WHERE ${whereClause}
        `,
      queryParams
    );

    return result.rows[0].count;
  }

  // Lấy stats cho user (yêu cầu đã tạo)
  static async getStatsForUser(userId) {
    const result = await query(
      `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN s."StatusName" = 'Pending' THEN 1 END) as pending,
                COUNT(CASE WHEN s."StatusName" = 'In Progress' THEN 1 END) as "inProgress",
                COUNT(CASE WHEN s."StatusName" = 'Completed' THEN 1 END) as completed
            FROM "Requests" r
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            WHERE r."UsersId" = $1
        `,
      [userId]
    );

    return (
      result.rows[0] || { total: 0, pending: 0, inProgress: 0, completed: 0 }
    );
  }

  // Lấy stats cho assigned requests
  static async getAssignedStats(userId) {
    const result = await query(
      `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN p."PriorityName" = 'Urgent' THEN 1 END) as urgent,
                COUNT(CASE WHEN s."StatusName" = 'In Progress' THEN 1 END) as "inProgress",
                COUNT(CASE WHEN s."StatusName" = 'Completed' THEN 1 END) as completed
            FROM "Requests" r
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
            WHERE r."AssignedUserId" = $1
        `,
      [userId]
    );

    return (
      result.rows[0] || { total: 0, urgent: 0, inProgress: 0, completed: 0 }
    );
  }

  // Lấy danh sách status
  static async getStatuses() {
    const result = await query('SELECT * FROM "Status" ORDER BY "StatusID"');
    return result.rows;
  }

  // Lấy danh sách priorities
  static async getPriorities() {
    const result = await query(
      'SELECT * FROM "Priority" WHERE "IsActive" = true ORDER BY "SortOrder", "PriorityID"'
    );
    return result.rows;
  }

  // Lấy danh sách workflows
  static async getWorkflows() {
    const result = await query(
      'SELECT * FROM "Workflow" WHERE "IsActive" = true ORDER BY "WorkflowID"'
    );
    return result.rows;
  }

  // Lấy danh sách request types
  static async getRequestTypes() {
    // Table RequestTypes doesn't exist, return predefined types
    return [
      {
        TypeId: 1,
        TypeName: 'Bug Report',
        Description: 'Report a software bug',
      },
      {
        TypeId: 2,
        TypeName: 'Feature Request',
        Description: 'Request a new feature',
      },
      {
        TypeId: 3,
        TypeName: 'Support',
        Description: 'General support request',
      },
      {
        TypeId: 4,
        TypeName: 'Information',
        Description: 'Information request',
      },
    ];
  }

  // Lấy requests được gán cho user hiện tại
  static async getAssignedRequests(userId, page = 1, limit = 10, filters = {}) {
    const offset = (page - 1) * limit;
    const conditions = [`r."AssignedUserId" = $1`];
    const params = [userId];
    let paramCount = 2;

    if (filters.statusId) {
      conditions.push(`r."StatusID" = $${paramCount}`);
      params.push(filters.statusId);
      paramCount++;
    }

    if (filters.priorityId) {
      conditions.push(`r."PriorityID" = $${paramCount}`);
      params.push(filters.priorityId);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(
        `(r."Title" ILIKE $${paramCount} OR r."Description" ILIKE $${paramCount})`
      );
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    // Exclude drafts from assigned requests
    conditions.push(`s."StatusName" != 'Nháp'`);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit, offset);

    const result = await query(
      `
            SELECT 
                r.*,
                u."UserName" as "CreatedByUser",
                u."Email" as "CreatedByEmail", 
                s."StatusName",
                s."IsFinal" as "IsStatusFinal",
                p."PriorityName",
                p."ColorCode" as "PriorityColor",
                w."WorkflowName",
                d."Name" as "DepartmentName",
                COALESCE(comment_count.count, 0) as "CommentCount"
            FROM "Requests" r
            LEFT JOIN "Users" u ON r."UsersId" = u."Id"
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
            LEFT JOIN "Workflow" w ON r."WorkflowID" = w."WorkflowID"
            LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
            LEFT JOIN (
                SELECT "RequestId", COUNT(*) as count 
                FROM "Comments" 
                GROUP BY "RequestId"
            ) comment_count ON r."RequestID" = comment_count."RequestId"
            ${whereClause}
            ORDER BY 
                CASE WHEN p."PriorityName" = 'Khẩn cấp' THEN 1 
                     WHEN p."PriorityName" = 'Cao' THEN 2 
                     WHEN p."PriorityName" = 'Trung bình' THEN 3 
                     ELSE 4 END,
                r."CreatedAt" DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `,
      params
    );

    return result.rows;
  }

  // Đếm requests được gán cho user
  static async countAssignedRequests(userId, filters = {}) {
    const conditions = [`r."AssignedUserId" = $1`];
    const params = [userId];
    let paramCount = 2;

    if (filters.statusId) {
      conditions.push(`r."StatusID" = $${paramCount}`);
      params.push(filters.statusId);
      paramCount++;
    }

    if (filters.priorityId) {
      conditions.push(`r."PriorityID" = $${paramCount}`);
      params.push(filters.priorityId);
      paramCount++;
    }

    if (filters.search) {
      conditions.push(
        `(r."Title" ILIKE $${paramCount} OR r."Description" ILIKE $${paramCount})`
      );
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    // Exclude drafts from assigned requests
    conditions.push(`s."StatusName" != 'Nháp'`);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `
            SELECT COUNT(*) as total 
            FROM "Requests" r
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
            ${whereClause}
        `,
      params
    );

    return parseInt(result.rows[0].total);
  }

  // Lấy thống kê requests được gán
  static async getAssignedStats(userId) {
    const result = await query(
      `
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN p."PriorityName" = 'Khẩn cấp' THEN 1 END) as urgent,
                COUNT(CASE WHEN s."IsFinal" = false THEN 1 END) as pending,
                COUNT(CASE WHEN s."StatusName" = 'Hoàn thành' THEN 1 END) as completed
            FROM "Requests" r
            LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"  
            LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
            WHERE r."AssignedUserId" = $1
        `,
      [userId]
    );

    return result.rows[0] || { total: 0, urgent: 0, pending: 0, completed: 0 };
  }

  // Phê duyệt request
  static async approveRequest(requestId, userId, note = null) {
    const queries = [
      {
        text: `UPDATE "Requests" 
                       SET "IsApproved" = true, "UpdatedAt" = $1 
                       WHERE "RequestID" = $2`,
        params: [new Date(), requestId],
      },
      {
        text: `INSERT INTO "RequestApprovals" 
                       ("RequestId", "ApprovedByUserId", "ApprovedAt", "Note")
                       VALUES ($1, $2, $3, $4)`,
        params: [requestId, userId, new Date(), note],
      },
      {
        text: `INSERT INTO "RequestStepHistory" 
                       ("RequestID", "StatusID", "CreatedAt", "ActionTime", "Note")
                       VALUES ($1, (SELECT "StatusID" FROM "Status" WHERE "StatusName" = 'Hoàn thành' LIMIT 1), $2, $3, $4)`,
        params: [
          requestId,
          new Date(),
          new Date(),
          `Approved by user. ${note || ''}`,
        ],
      },
    ];

    return await transaction(queries);
  }

  // Từ chối request
  static async rejectRequest(requestId, userId, note) {
    const queries = [
      {
        text: `UPDATE "Requests" 
                       SET "StatusID" = (SELECT "StatusID" FROM "Status" WHERE "StatusName" = 'Từ chối' LIMIT 1),
                           "UpdatedAt" = $1 
                       WHERE "RequestID" = $2`,
        params: [new Date(), requestId],
      },
      {
        text: `INSERT INTO "RequestStepHistory" 
                       ("RequestID", "StatusID", "CreatedAt", "ActionTime", "Note")
                       VALUES ($1, (SELECT "StatusID" FROM "Status" WHERE "StatusName" = 'Từ chối' LIMIT 1), $2, $3, $4)`,
        params: [
          requestId,
          new Date(),
          new Date(),
          `Rejected by user: ${note}`,
        ],
      },
    ];

    return await transaction(queries);
  }

  // Bắt đầu xử lý request
  static async startProcessing(requestId) {
    return await this.updateStatus(
      requestId,
      await this.getStatusIdByName('Đang xử lý'),
      'Request processing started'
    );
  }

  // Lấy StatusID theo tên
  static async getStatusIdByName(statusName) {
    const result = await query(
      'SELECT "StatusID" FROM "Status" WHERE "StatusName" = $1',
      [statusName]
    );
    return result.rows[0]?.StatusID;
  }

  // Kiểm tra quyền xử lý request
  static async canProcessRequest(requestId, userId) {
    const result = await query(
      `
            SELECT r."AssignedUserId", r."UsersId"
            FROM "Requests" r
            WHERE r."RequestID" = $1
        `,
      [requestId]
    );

    if (!result.rows[0]) return false;

    const request = result.rows[0];
    return request.AssignedUserId === userId || request.UsersId === userId;
  }

  // Lấy danh sách bản nháp của user
  static async getDrafts(userId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    const result = await query(
      `
      SELECT 
        r.*,
        u."UserName" as "CreatedByUser",
        s."StatusName",
        p."PriorityName",
        p."ColorCode" as "PriorityColor"
      FROM "Requests" r
      LEFT JOIN "Users" u ON r."UsersId" = u."Id"
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      LEFT JOIN "Priority" p ON r."PriorityID" = p."PriorityID"
      WHERE r."UsersId" = $1 
        AND s."StatusName" = 'Nháp'
      ORDER BY r."UpdatedAt" DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    return result.rows;
  }

  // Đếm số bản nháp của user
  static async countDrafts(userId) {
    const result = await query(
      `
      SELECT COUNT(*) as count
      FROM "Requests" r
      LEFT JOIN "Status" s ON r."StatusID" = s."StatusID"
      WHERE r."UsersId" = $1 
        AND s."StatusName" = 'Nháp'
      `,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  // Chuyển draft thành request chính thức
  static async publishDraft(requestId, userId) {
    // Get default "Mới" status
    const statusResult = await query(
      'SELECT "StatusID" FROM "Status" WHERE "StatusName" = $1 LIMIT 1',
      ['Mới']
    );
    const statusId = statusResult.rows[0]?.StatusID || 1;

    const result = await query(
      `
      UPDATE "Requests"
      SET "StatusID" = $1,
          "UpdatedAt" = NOW()
      WHERE "RequestID" = $2 
        AND "UsersId" = $3
      RETURNING *
      `,
      [statusId, requestId, userId]
    );

    return result.rows[0];
  }

  // Lấy workflow steps của request
  static async getWorkflowSteps(requestId) {
    const result = await query(
      `
            SELECT 
                ws.*,
                s."StatusName",
                u."UserName" as "AssignedUserName"
            FROM "WorkflowSteps" ws
            LEFT JOIN "Status" s ON ws."StatusID" = s."StatusID"
            LEFT JOIN "Users" u ON ws."AssignedUserId" = u."Id"
            JOIN "Requests" r ON ws."WorkflowID" = r."WorkflowID"
            WHERE r."RequestID" = $1
            ORDER BY ws."StepOrder"
        `,
      [requestId]
    );

    return result.rows;
  }
}

module.exports = Request;
