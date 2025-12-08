const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

// Apply authentication middleware
router.use(authenticateToken);

// Chat interface
router.get('/', async (req, res) => {
  try {
    // Get all users for chat list (exclude current user)
    const usersResult = await pool.query(
      `SELECT u."Id", u."UserName", u."Email", d."Name" as "DepartmentName"
       FROM "Users" u
       LEFT JOIN "Departments" d ON u."DepartmentID" = d."DepartmentID"
       WHERE u."Id" != $1
       ORDER BY u."UserName"`,
      [req.user.Id]
    );

    res.render('chat/index', {
      title: 'Chat',
      page: 'chat',
      users: usersResult.rows,
      currentUser: req.user,
    });
  } catch (error) {
    console.error('Chat page error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      message: 'Không thể tải trang chat',
    });
  }
});

// API: Get conversations
router.get('/api/conversations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (other_user)
        CASE 
          WHEN cm."SenderId" = $1 THEN cm."ReceiverId"
          ELSE cm."SenderId"
        END as other_user,
        u."UserName",
        u."Email",
        (SELECT "Message" 
         FROM "ChatMessages" 
         WHERE ("SenderId" = $1 AND "ReceiverId" = other_user) 
            OR ("SenderId" = other_user AND "ReceiverId" = $1)
         ORDER BY "CreatedAt" DESC 
         LIMIT 1) as last_message,
        (SELECT "CreatedAt" 
         FROM "ChatMessages" 
         WHERE ("SenderId" = $1 AND "ReceiverId" = other_user) 
            OR ("SenderId" = other_user AND "ReceiverId" = $1)
         ORDER BY "CreatedAt" DESC 
         LIMIT 1) as last_message_time,
        (SELECT COUNT(*) 
         FROM "ChatMessages" 
         WHERE "SenderId" = other_user 
           AND "ReceiverId" = $1 
           AND "IsRead" = false) as unread_count
       FROM "ChatMessages" cm
       LEFT JOIN "Users" u ON u."Id" = CASE 
         WHEN cm."SenderId" = $1 THEN cm."ReceiverId"
         ELSE cm."SenderId"
       END
       WHERE cm."SenderId" = $1 OR cm."ReceiverId" = $1
       ORDER BY other_user, last_message_time DESC`,
      [req.user.Id]
    );

    res.json({
      success: true,
      conversations: result.rows,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách hội thoại',
    });
  }
});

// API: Get messages with a user
router.get('/api/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT 
        cm.*,
        sender."UserName" as "SenderName",
        receiver."UserName" as "ReceiverName"
       FROM "ChatMessages" cm
       LEFT JOIN "Users" sender ON cm."SenderId" = sender."Id"
       LEFT JOIN "Users" receiver ON cm."ReceiverId" = receiver."Id"
       WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = $2)
          OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1)
       ORDER BY cm."CreatedAt" ASC
       LIMIT $3 OFFSET $4`,
      [req.user.Id, userId, limit, offset]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE "ChatMessages" 
       SET "IsRead" = true 
       WHERE "SenderId" = $1 AND "ReceiverId" = $2 AND "IsRead" = false`,
      [userId, req.user.Id]
    );

    res.json({
      success: true,
      messages: result.rows,
      pagination: {
        page,
        limit,
        hasMore: result.rows.length === limit,
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải tin nhắn',
    });
  }
});

// API: Send message (HTTP fallback)
router.post('/api/send', async (req, res) => {
  try {
    const { receiverId, message } = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin người nhận hoặc nội dung tin nhắn',
      });
    }

    const result = await pool.query(
      `INSERT INTO "ChatMessages" ("SenderId", "ReceiverId", "Message", "CreatedAt", "IsRead")
       VALUES ($1, $2, $3, NOW(), false)
       RETURNING *`,
      [req.user.Id, receiverId, message]
    );

    // Emit to Socket.io if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${receiverId}`).emit('chat:message', {
        ...result.rows[0],
        SenderName: req.user.UserName,
      });
    }

    res.json({
      success: true,
      message: result.rows[0],
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể gửi tin nhắn',
    });
  }
});

// API: Delete message
router.delete('/api/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Only allow deleting own messages
    await pool.query(
      `DELETE FROM "ChatMessages" 
       WHERE "MessageID" = $1 AND "SenderId" = $2`,
      [messageId, req.user.Id]
    );

    res.json({
      success: true,
      message: 'Đã xóa tin nhắn',
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa tin nhắn',
    });
  }
});

// API: Get unread count
router.get('/api/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM "ChatMessages"
       WHERE "ReceiverId" = $1 AND "IsRead" = false`,
      [req.user.Id]
    );

    res.json({
      success: true,
      count: parseInt(result.rows[0].count) || 0,
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      count: 0,
    });
  }
});

module.exports = router;
