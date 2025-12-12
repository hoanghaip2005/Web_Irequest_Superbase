const { query, transaction } = require('../config/database');

class User {
  // Tìm user theo ID
  static async findById(id) {
    const result = await query('SELECT * FROM "Users" WHERE "Id" = $1', [id]);
    return result.rows[0];
  }

  // Tìm user theo email
  static async findByEmail(email) {
    const result = await query('SELECT * FROM "Users" WHERE "Email" = $1', [
      email,
    ]);
    return result.rows[0];
  }

  // Tìm user theo username
  static async findByUsername(username) {
    const result = await query('SELECT * FROM "Users" WHERE "UserName" = $1', [
      username,
    ]);
    return result.rows[0];
  }

  // Tạo user mới
  static async create(userData) {
    const { id, username, email, passwordHash, departmentId = null } = userData;

    const result = await query(
      `
      INSERT INTO "Users" (
        "Id", "UserName", "NormalizedUserName", "Email", "NormalizedEmail", 
        "EmailConfirmed", "PasswordHash", "DepartmentID", "PhoneNumberConfirmed",
        "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
      [
        id,
        username,
        username.toUpperCase(),
        email,
        email.toUpperCase(),
        true, // EmailConfirmed
        passwordHash,
        departmentId,
        false, // PhoneNumberConfirmed
        false, // TwoFactorEnabled
        false, // LockoutEnabled
        0, // AccessFailedCount
      ]
    );

    return result.rows[0];
  }

  // Cập nhật user
  static async update(id, userData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(userData).forEach((key) => {
      if (userData[key] !== undefined) {
        fields.push(`"${key}" = $${paramCount}`);
        values.push(userData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    const result = await query(
      `
      UPDATE "Users" 
      SET ${fields.join(', ')}
      WHERE "Id" = $${paramCount}
      RETURNING *
    `,
      values
    );

    return result.rows[0];
  }

  // Lấy tất cả users với phân trang
  static async getAll(page = 1, limit = 10, searchTerm = '') {
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = [limit, offset];

    if (searchTerm) {
      whereClause = `WHERE "UserName" ILIKE $3 OR "Email" ILIKE $3`;
      params.push(`%${searchTerm}%`);
    }

    const result = await query(
      `
      SELECT u.*, d."Name" as "DepartmentName", r."Name" as "RoleName"
      FROM "Users" u
      LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
      LEFT JOIN "Roles" r ON u."RolesId" = r."Id"
      ${whereClause}
      ORDER BY u."UserName"
      LIMIT $1 OFFSET $2
    `,
      params
    );

    return result.rows;
  }

  // Đếm tổng số users
  static async count(searchTerm = '') {
    let whereClause = '';
    let params = [];

    if (searchTerm) {
      whereClause = `WHERE "UserName" ILIKE $1 OR "Email" ILIKE $1`;
      params.push(`%${searchTerm}%`);
    }

    const result = await query(
      `
      SELECT COUNT(*) as total FROM "Users" ${whereClause}
    `,
      params
    );

    return parseInt(result.rows[0].total);
  }

  // Cập nhật mật khẩu
  static async updatePassword(email, hashedPassword) {
    try {
      const result = await query(
        'UPDATE "Users" SET "PasswordHash" = $1 WHERE "Email" = $2 RETURNING "Id", "Email"',
        [hashedPassword, email]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error updating password:', error);
      return null;
    }
  }

  // Cập nhật thông tin user
  static async update(id, userData) {
    const { username, email, departmentId } = userData;

    try {
      const result = await query(
        `
                UPDATE "Users" 
                SET "UserName" = $1, "NormalizedUserName" = $2, "Email" = $3, "NormalizedEmail" = $4, "DepartmentID" = $5
                WHERE "Id" = $6
                RETURNING *
            `,
        [
          username,
          username.toUpperCase(),
          email,
          email.toUpperCase(),
          departmentId,
          id,
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  // Xóa user
  static async delete(id) {
    const result = await query(
      'DELETE FROM "Users" WHERE "Id" = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Lấy dashboard data cho user
  static async getDashboardData(userId) {
    const result = await query(
      `
      SELECT * FROM "user_dashboard" WHERE "Id" = $1
    `,
      [userId]
    );

    return result.rows[0];
  }

  // Lưu remember token
  static async saveRememberToken(userId, token) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await query(
      `
            UPDATE "Users" 
            SET "RememberToken" = $1, "RememberTokenExpiresAt" = $2 
            WHERE "Id" = $3
        `,
      [token, expiresAt, userId]
    );
  }

  // Tìm user theo remember token
  static async findByRememberToken(token) {
    const result = await query(
      `
            SELECT * FROM "Users" 
            WHERE "RememberToken" = $1 
            AND "RememberTokenExpiresAt" > NOW()
        `,
      [token]
    );
    return result.rows[0];
  }

  // Xóa remember token
  static async clearRememberToken(userId) {
    await query(
      `
            UPDATE "Users" 
            SET "RememberToken" = NULL, "RememberTokenExpiresAt" = NULL 
            WHERE "Id" = $1
        `,
      [userId]
    );
  }
}

module.exports = User;
