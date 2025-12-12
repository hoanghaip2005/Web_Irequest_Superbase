const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Helper function to extract URLs from text
function extractURLs(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches || [];
}

// Helper function to save extracted links
async function saveMessageLinks(messageId, urls) {
  if (!urls || urls.length === 0) return;

  try {
    // Create MessageLinks table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "MessageLinks" (
        "LinkId" SERIAL PRIMARY KEY,
        "MessageId" INTEGER NOT NULL,
        "URL" TEXT NOT NULL,
        "Title" VARCHAR(500),
        "Description" TEXT,
        "ImageURL" TEXT,
        "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_message
          FOREIGN KEY ("MessageId")
          REFERENCES "ChatMessages"("MessageID")
          ON DELETE CASCADE
      )
    `);

    // Insert each URL
    for (const url of urls) {
      await pool.query(
        `INSERT INTO "MessageLinks" ("MessageId", "URL")
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [messageId, url]
      );
    }
    console.log(`✅ Saved ${urls.length} link(s) for message ${messageId}`);
  } catch (error) {
    console.error('Error saving links:', error);
  }
}

// Configure multer for chat file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.bmp',
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.txt',
      '.csv',
      '.zip',
      '.rar',
      '.7z',
    ];

    if (allowedExtensions.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error(`Loại file không được hỗ trợ: ${ext}`));
  },
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Apply authentication middleware
router.use(authenticateToken);

// Chat interface
router.get('/', async (req, res) => {
  try {
    const { chat: selectedChatId, type: chatType } = req.query;

    // Get all users (except current user) with their chat information
    const directChatsQuery = await pool.query(
      `SELECT 
        u."Id" as "UserId",
        u."UserName" as name,
        u."Email",
        u."Avatar" as "AvatarPath",
        'bg-primary' as "AvatarColor",
        (SELECT cm."Message" 
         FROM "ChatMessages" cm
         WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = u."Id")
            OR (cm."SenderId" = u."Id" AND cm."ReceiverId" = $1)
         ORDER BY cm."CreatedAt" DESC 
         LIMIT 1) as "lastMessage",
        (SELECT cm."CreatedAt" 
         FROM "ChatMessages" cm
         WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = u."Id")
            OR (cm."SenderId" = u."Id" AND cm."ReceiverId" = $1)
         ORDER BY cm."CreatedAt" DESC 
         LIMIT 1) as "lastMessageTime",
        (SELECT COUNT(*) 
         FROM "ChatMessages" cm
         WHERE cm."SenderId" = u."Id"
           AND cm."ReceiverId" = $1 
           AND cm."IsRead" = false) as "unreadCount",
        false as online
       FROM "Users" u
       WHERE u."Id" != $1
       ORDER BY "lastMessageTime" DESC NULLS LAST, u."UserName" ASC`,
      [req.user.Id]
    );

    // Get group chats (if you have group chat functionality)
    let groupChatsQuery = { rows: [] };
    try {
      // Check schema first
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'ChatGroups' 
        AND column_name IN ('Id', 'GroupId', 'Name', 'GroupName')
      `);

      const hasIdColumn = schemaCheck.rows.some(
        (row) => row.column_name === 'Id'
      );
      const hasNameColumn = schemaCheck.rows.some(
        (row) => row.column_name === 'Name'
      );

      console.log('Loading groups - Schema:', {
        hasIdColumn,
        hasNameColumn,
        userId: req.user.Id,
      });

      if (hasIdColumn && hasNameColumn) {
        // UUID schema
        groupChatsQuery = await pool.query(
          `SELECT 
            g."Id"::text as id,
            g."Name" as name,
            g."Description",
            g."CreatedAt",
            (SELECT COUNT(*) FROM "GroupMembers" gm2 WHERE gm2."GroupId"::text = g."Id"::text) as "memberCount",
            (SELECT gm2."Message" 
             FROM "GroupMessages" gm2
             WHERE gm2."GroupId"::text = g."Id"::text
             ORDER BY gm2."CreatedAt" DESC 
             LIMIT 1) as "lastMessage",
            (SELECT u."UserName"
             FROM "GroupMessages" gm2
             LEFT JOIN "Users" u ON gm2."SenderId" = u."Id"
             WHERE gm2."GroupId"::text = g."Id"::text
             ORDER BY gm2."CreatedAt" DESC 
             LIMIT 1) as "lastMessageUser",
            (SELECT gm2."CreatedAt" 
             FROM "GroupMessages" gm2
             WHERE gm2."GroupId"::text = g."Id"::text
             ORDER BY gm2."CreatedAt" DESC 
             LIMIT 1) as "lastMessageTime"
           FROM "ChatGroups" g
           INNER JOIN "GroupMembers" gm ON g."Id"::text = gm."GroupId"::text
           WHERE gm."UserId" = $1
           ORDER BY "lastMessageTime" DESC NULLS LAST`,
          [req.user.Id]
        );
      } else {
        // SERIAL schema
        groupChatsQuery = await pool.query(
          `SELECT 
            g."GroupId"::text as id,
            g."GroupName" as name,
            g."Description",
            g."CreatedAt",
            (SELECT COUNT(*) FROM "GroupMembers" gm2 WHERE gm2."GroupId"::text = g."GroupId"::text) as "memberCount",
            (SELECT gm2."Message" 
             FROM "GroupMessages" gm2
             WHERE gm2."GroupId"::text = g."GroupId"::text
             ORDER BY gm2."CreatedAt" DESC 
             LIMIT 1) as "lastMessage",
            (SELECT u."UserName"
             FROM "GroupMessages" gm2
             LEFT JOIN "Users" u ON gm2."SenderId" = u."Id"
             WHERE gm2."GroupId"::text = g."GroupId"::text
             ORDER BY gm2."CreatedAt" DESC 
             LIMIT 1) as "lastMessageUser",
            (SELECT gm2."CreatedAt" 
             FROM "GroupMessages" gm2
             WHERE gm2."GroupId"::text = g."GroupId"::text
             ORDER BY gm2."CreatedAt" DESC 
             LIMIT 1) as "lastMessageTime"
           FROM "ChatGroups" g
           INNER JOIN "GroupMembers" gm ON g."GroupId"::text = gm."GroupId"::text
           WHERE gm."UserId" = $1
           ORDER BY "lastMessageTime" DESC NULLS LAST`,
          [req.user.Id]
        );
      }

      console.log('✅ Group chats loaded:', groupChatsQuery.rows.length);
    } catch (err) {
      console.error('❌ Error loading group chats:', err.message);
      console.error('Error stack:', err.stack);
      groupChatsQuery = { rows: [] };
    }

    console.log('Direct chats found:', directChatsQuery.rows.length);
    console.log('Sample direct chat:', directChatsQuery.rows[0]);
    console.log('Group chats found:', groupChatsQuery.rows.length);

    // If a specific chat is selected, load its messages
    let currentChat = null;
    if (selectedChatId && chatType === 'direct') {
      // Get user info for direct chat
      const userInfoQuery = await pool.query(
        `SELECT 
          u."Id" as "UserId",
          u."UserName" as name,
          u."Email",
          u."Avatar" as "AvatarPath",
          'bg-primary' as "AvatarColor"
         FROM "Users" u
         WHERE u."Id" = $1`,
        [selectedChatId]
      );

      if (userInfoQuery.rows[0]) {
        // Get messages with attachments
        let messagesQuery;
        try {
          // Try to get messages with attachments
          messagesQuery = await pool.query(
            `SELECT 
              cm.*,
              sender."UserName" as "senderName",
              sender."Avatar" as "senderAvatar",
              'bg-primary' as "senderColor",
              COALESCE(
                (
                  SELECT json_agg(json_build_object(
                    'Id', ma."Id",
                    'name', ma."FileName",
                    'url', ma."FilePath",
                    'type', ma."FileType",
                    'size', ma."FileSize"
                  ))
                  FROM "MessageAttachments" ma
                  WHERE ma."MessageId"::text = cm."MessageID"::text
                ),
                '[]'::json
              ) as attachments
             FROM "ChatMessages" cm
             LEFT JOIN "Users" sender ON cm."SenderId" = sender."Id"
             WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = $2)
                OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1)
             ORDER BY cm."CreatedAt" ASC
             LIMIT 100`,
            [req.user.Id, selectedChatId]
          );
        } catch (err) {
          // If MessageAttachments table doesn't exist, get messages without attachments
          console.log('Getting messages without attachments:', err.message);
          messagesQuery = await pool.query(
            `SELECT 
              cm.*,
              sender."UserName" as "senderName",
              sender."Avatar" as "senderAvatar",
              'bg-primary' as "senderColor",
              '[]'::json as attachments
             FROM "ChatMessages" cm
             LEFT JOIN "Users" sender ON cm."SenderId" = sender."Id"
             WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = $2)
                OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1)
             ORDER BY cm."CreatedAt" ASC
             LIMIT 100`,
            [req.user.Id, selectedChatId]
          );
        }

        // Mark messages as read
        await pool.query(
          `UPDATE "ChatMessages" 
           SET "IsRead" = true 
           WHERE "SenderId" = $1 AND "ReceiverId" = $2 AND "IsRead" = false`,
          [selectedChatId, req.user.Id]
        );

        currentChat = {
          ...userInfoQuery.rows[0],
          isGroup: false,
          messages: messagesQuery.rows,
        };
      }
    } else if (selectedChatId && chatType === 'group') {
      // Handle group chat (if implemented)
      // TODO: Implement group chat logic
    }

    res.render('chat/index', {
      title: 'Chat',
      page: 'chat',
      directChats: directChatsQuery.rows,
      groupChats: groupChatsQuery.rows,
      currentChat: currentChat,
      currentUser: req.user,
      user: req.user,
    });
  } catch (error) {
    console.error('Chat page error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      message: 'Không thể tải trang chat',
    });
  }
});

// API: Search users for chat/group
router.get('/search-users', authenticateToken, async (req, res) => {
  try {
    const searchQuery = req.query.q || '';
    const currentUserId = req.user.Id;

    console.log('Searching users with query:', searchQuery);

    // Search users by name or email, excluding current user
    const result = await pool.query(
      `SELECT 
        "Id" as id,
        "UserName" as name,
        "Email" as email,
        "Avatar" as "AvatarPath",
        'bg-primary' as "AvatarColor"
       FROM "Users"
       WHERE "Id" != $1
         AND (
           LOWER("UserName") LIKE LOWER($2) 
           OR LOWER("Email") LIKE LOWER($2)
         )
       ORDER BY "UserName"
       LIMIT 20`,
      [currentUserId, `%${searchQuery}%`]
    );

    console.log('Found users:', result.rows.length);

    res.json(result.rows);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tìm kiếm người dùng',
    });
  }
});

// API: Create group chat
router.post('/create-group', authenticateToken, async (req, res) => {
  console.log('🎯 POST /create-group endpoint hit!');
  console.log('Request body:', req.body);
  console.log('User:', req.user);

  const client = await pool.connect();

  try {
    const { name, description, members } = req.body;
    const currentUserId = req.user.Id;

    console.log('Creating group:', {
      name,
      description,
      members,
      currentUserId,
    });

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tên nhóm không được để trống',
      });
    }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng thêm ít nhất một thành viên',
      });
    }

    await client.query('BEGIN');

    // Check if ChatGroups table uses 'Id' (UUID) or 'GroupId' (SERIAL)
    const tableCheckResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ChatGroups' 
      AND column_name IN ('Id', 'GroupId', 'Name', 'GroupName', 'CreatedBy', 'CreatedById')
    `);

    const columns = {};
    tableCheckResult.rows.forEach((row) => {
      columns[row.column_name] = row.data_type;
    });

    console.log('ChatGroups table structure:', columns);

    let groupId;

    // Determine which schema we're using
    if (columns['Id']) {
      // Using UUID schema (migration 009 or newer)
      const { v4: uuidv4 } = require('uuid');
      groupId = uuidv4();

      await client.query(
        `INSERT INTO "ChatGroups" ("Id", "Name", "Description", "CreatedById", "CreatedAt")
         VALUES ($1, $2, $3, $4, NOW())`,
        [groupId, name.trim(), description || '', currentUserId]
      );
    } else {
      // Using SERIAL schema (migration 008)
      const insertResult = await client.query(
        `INSERT INTO "ChatGroups" ("GroupName", "Description", "CreatedBy", "CreatedAt")
         VALUES ($1, $2, $3, NOW())
         RETURNING "GroupId"`,
        [name.trim(), description || '', currentUserId]
      );
      groupId = insertResult.rows[0].GroupId;
    }

    console.log('Created group with ID:', groupId);

    // Add creator as admin
    await client.query(
      `INSERT INTO "GroupMembers" ("GroupId", "UserId", "Role")
       VALUES ($1, $2, 'admin')`,
      [groupId, currentUserId]
    );

    // Add members
    for (const memberId of members) {
      try {
        await client.query(
          `INSERT INTO "GroupMembers" ("GroupId", "UserId", "Role")
           VALUES ($1, $2, 'member')
           ON CONFLICT ("GroupId", "UserId") DO NOTHING`,
          [groupId, memberId]
        );
        console.log(`Added member ${memberId} to group`);
      } catch (memberError) {
        console.error(`Error adding member ${memberId}:`, memberError.message);
      }
    }

    await client.query('COMMIT');

    console.log('✅ Group created successfully');

    res.json({
      success: true,
      groupId: groupId,
      message: 'Tạo nhóm thành công',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo nhóm: ' + error.message,
    });
  } finally {
    client.release();
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

    const result = await pool
      .query(
        `SELECT 
        cm.*,
        sender."UserName" as "SenderName",
        receiver."UserName" as "ReceiverName",
        (
          SELECT json_agg(json_build_object(
            'Id', ma."Id",
            'name', ma."FileName",
            'url', ma."FilePath",
            'type', ma."FileType",
            'size', ma."FileSize"
          ))
          FROM "MessageAttachments" ma
          WHERE ma."MessageId" = cm."MessageID"
        ) as attachments
       FROM "ChatMessages" cm
       LEFT JOIN "Users" sender ON cm."SenderId" = sender."Id"
       LEFT JOIN "Users" receiver ON cm."ReceiverId" = receiver."Id"
       WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = $2)
          OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1)
       ORDER BY cm."CreatedAt" ASC
       LIMIT $3 OFFSET $4`,
        [req.user.Id, userId, limit, offset]
      )
      .catch((err) => {
        // If MessageAttachments table doesn't exist, get messages without attachments
        console.log('Getting messages without attachments:', err.message);
        return pool.query(
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
      });

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

// API: Get chat data (user info + messages)
router.get('/api/chat-data', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin userId',
      });
    }

    // Get user info
    const userInfoQuery = await pool.query(
      `SELECT 
        u."Id" as "UserId",
        u."UserName" as name,
        u."Email",
        u."Avatar" as "AvatarPath",
        'bg-primary' as "AvatarColor"
       FROM "Users" u
       WHERE u."Id" = $1`,
      [userId]
    );

    if (userInfoQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng',
      });
    }

    // Get messages with attachments
    let messagesQuery;
    try {
      // Try to get messages with attachments
      messagesQuery = await pool.query(
        `SELECT 
          cm.*,
          sender."UserName" as "senderName",
          sender."Avatar" as "senderAvatar",
          'bg-primary' as "senderColor",
          COALESCE(
            (
              SELECT json_agg(json_build_object(
                'Id', ma."Id",
                'name', ma."FileName",
                'url', ma."FilePath",
                'type', ma."FileType",
                'size', ma."FileSize"
              ))
              FROM "MessageAttachments" ma
              WHERE ma."MessageId"::text = cm."MessageID"::text
            ),
            '[]'::json
          ) as attachments
         FROM "ChatMessages" cm
         LEFT JOIN "Users" sender ON cm."SenderId" = sender."Id"
         WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = $2)
            OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1)
         ORDER BY cm."CreatedAt" ASC
         LIMIT 100`,
        [req.user.Id, userId]
      );
    } catch (err) {
      // If MessageAttachments table doesn't exist, get messages without attachments
      console.log('Getting messages without attachments:', err.message);
      messagesQuery = await pool.query(
        `SELECT 
          cm.*,
          sender."UserName" as "senderName",
          sender."Avatar" as "senderAvatar",
          'bg-primary' as "senderColor",
          '[]'::json as attachments
         FROM "ChatMessages" cm
         LEFT JOIN "Users" sender ON cm."SenderId" = sender."Id"
         WHERE (cm."SenderId" = $1 AND cm."ReceiverId" = $2)
            OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1)
         ORDER BY cm."CreatedAt" ASC
         LIMIT 100`,
        [req.user.Id, userId]
      );
    }

    // Mark messages as read
    await pool.query(
      `UPDATE "ChatMessages" 
       SET "IsRead" = true 
       WHERE "SenderId" = $1 AND "ReceiverId" = $2 AND "IsRead" = false`,
      [userId, req.user.Id]
    );

    res.json({
      success: true,
      user: userInfoQuery.rows[0],
      messages: messagesQuery.rows,
    });
  } catch (error) {
    console.error('Get chat data error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải dữ liệu chat',
    });
  }
});

// API: Get group chat data (group info + messages)
router.get('/api/group-data', async (req, res) => {
  try {
    const { groupId } = req.query;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin groupId',
      });
    }

    console.log('Loading group data for groupId:', groupId);

    // First, check which schema columns exist
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ChatGroups' 
      AND column_name IN ('Id', 'GroupId', 'Name', 'GroupName')
    `);

    const hasIdColumn = schemaCheck.rows.some(
      (row) => row.column_name === 'Id'
    );
    const hasNameColumn = schemaCheck.rows.some(
      (row) => row.column_name === 'Name'
    );

    console.log(
      'Schema check - hasId:',
      hasIdColumn,
      'hasName:',
      hasNameColumn
    );

    // Get group info based on schema
    let groupInfoQuery;
    let memberCount = 0;

    if (hasIdColumn && hasNameColumn) {
      // UUID schema
      groupInfoQuery = await pool.query(
        `SELECT 
          g."Id"::text as id,
          g."Name" as name,
          g."Description",
          g."CreatedAt"
         FROM "ChatGroups" g
         WHERE g."Id"::text = $1`,
        [groupId]
      );

      // Get member count separately to avoid subquery issues
      try {
        const memberCountQuery = await pool.query(
          `SELECT COUNT(*) as count FROM "GroupMembers" WHERE "GroupId"::text = $1`,
          [groupId]
        );
        memberCount = parseInt(memberCountQuery.rows[0]?.count || 0);
      } catch (err) {
        console.log('Error counting members:', err.message);
      }
    } else {
      // SERIAL schema
      groupInfoQuery = await pool.query(
        `SELECT 
          g."GroupId"::text as id,
          g."GroupName" as name,
          g."Description",
          g."CreatedAt"
         FROM "ChatGroups" g
         WHERE g."GroupId"::text = $1`,
        [groupId]
      );

      // Get member count separately
      try {
        const memberCountQuery = await pool.query(
          `SELECT COUNT(*) as count FROM "GroupMembers" WHERE "GroupId"::text = $1`,
          [groupId]
        );
        memberCount = parseInt(memberCountQuery.rows[0]?.count || 0);
      } catch (err) {
        console.log('Error counting members:', err.message);
      }
    }

    // Add member count to result
    if (groupInfoQuery.rows.length > 0) {
      groupInfoQuery.rows[0].memberCount = memberCount;
    }

    if (groupInfoQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm chat',
      });
    }

    // Get group messages
    let messagesQuery;
    try {
      messagesQuery = await pool.query(
        `SELECT 
          gm.*,
          sender."UserName" as "senderName",
          sender."Avatar" as "senderAvatar",
          'bg-primary' as "senderColor"
         FROM "GroupMessages" gm
         LEFT JOIN "Users" sender ON gm."SenderId" = sender."Id"
         WHERE gm."GroupId"::text = $1
         ORDER BY gm."CreatedAt" ASC
         LIMIT 100`,
        [groupId]
      );
    } catch (msgError) {
      console.log(
        'Error loading messages (table might not exist):',
        msgError.message
      );
      messagesQuery = { rows: [] };
    }

    console.log('✅ Group loaded:', groupInfoQuery.rows[0]);
    console.log('✅ Messages count:', messagesQuery.rows.length);

    // Format group data
    const groupData = {
      ...groupInfoQuery.rows[0],
      isGroup: true,
      AvatarColor: 'bg-secondary',
    };

    res.json({
      success: true,
      group: groupData,
      messages: messagesQuery.rows,
    });
  } catch (error) {
    console.error('❌ Get group data error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Không thể tải dữ liệu nhóm: ' + error.message,
    });
  }
});

// API: Send message (new endpoint for chat interface)
router.post('/send-message', async (req, res) => {
  try {
    const { chatId, chatType, content } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin người nhận hoặc nội dung tin nhắn',
      });
    }

    if (chatType !== 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ hỗ trợ tin nhắn trực tiếp',
      });
    }

    const result = await pool.query(
      `INSERT INTO "ChatMessages" ("SenderId", "ReceiverId", "Message", "CreatedAt", "IsRead")
       VALUES ($1, $2, $3, NOW(), false)
       RETURNING *`,
      [req.user.Id, chatId, content]
    );

    const messageId = result.rows[0].MessageID;

    // Extract and save URLs from message content
    const urls = extractURLs(content);
    if (urls.length > 0) {
      await saveMessageLinks(messageId, urls);
    }

    // Get sender info for response
    const messageWithSender = {
      ...result.rows[0],
      senderName: req.user.UserName,
      senderAvatar: req.user.Avatar,
      senderColor: 'bg-primary',
      isMine: true,
    };

    res.json({
      success: true,
      message: messageWithSender,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể gửi tin nhắn',
    });
  }
});

// API: Send message with files/images
router.post(
  '/send-message-with-files',
  upload.array('files', 10),
  async (req, res) => {
    try {
      const { chatId, chatType, content } = req.body;
      const files = req.files || [];

      console.log('Send message with files:', {
        chatId,
        chatType,
        content,
        filesCount: files.length,
      });

      if (!chatId) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin người nhận',
        });
      }

      if (chatType !== 'direct') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ hỗ trợ tin nhắn trực tiếp',
        });
      }

      // Check if there's content or files
      if (!content && files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Tin nhắn phải có nội dung hoặc file đính kèm',
        });
      }

      // Insert message
      const messageContent = content || '';
      const result = await pool.query(
        `INSERT INTO "ChatMessages" ("SenderId", "ReceiverId", "Message", "CreatedAt", "IsRead")
       VALUES ($1, $2, $3, NOW(), false)
       RETURNING *`,
        [req.user.Id, chatId, messageContent]
      );

      const message = result.rows[0];

      // Save file attachments
      const attachments = [];
      if (files.length > 0) {
        // Check if MessageAttachments table exists, if not create it
        try {
          // First, check the type of MessageID in ChatMessages
          const typeCheckResult = await pool.query(`
          SELECT data_type 
          FROM information_schema.columns 
          WHERE table_name = 'ChatMessages' 
          AND column_name = 'MessageID'
        `);

          const messageIdType = typeCheckResult.rows[0]?.data_type || 'integer';
          console.log('MessageID type in ChatMessages:', messageIdType);

          // Check if MessageAttachments table exists
          const tableExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'MessageAttachments'
          )
        `);

          if (tableExists.rows[0].exists) {
            // Check if MessageId type matches
            const attachmentTypeResult = await pool.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'MessageAttachments' 
            AND column_name = 'MessageId'
          `);

            const attachmentMessageIdType =
              attachmentTypeResult.rows[0]?.data_type;
            console.log(
              'MessageId type in MessageAttachments:',
              attachmentMessageIdType
            );

            // If types don't match, drop and recreate table
            if (attachmentMessageIdType !== messageIdType) {
              console.log(
                '⚠️  Type mismatch! Recreating MessageAttachments table...'
              );
              await pool.query(
                'DROP TABLE IF EXISTS "MessageAttachments" CASCADE'
              );
            }
          }

          // Create table with matching type
          if (messageIdType === 'uuid') {
            await pool.query(`
            CREATE TABLE IF NOT EXISTS "MessageAttachments" (
              "Id" SERIAL PRIMARY KEY,
              "MessageId" UUID NOT NULL,
              "FileName" VARCHAR(255) NOT NULL,
              "FilePath" VARCHAR(500) NOT NULL,
              "FileType" VARCHAR(50) NOT NULL,
              "FileSize" INTEGER NOT NULL,
              "CreatedAt" TIMESTAMP DEFAULT NOW(),
              FOREIGN KEY ("MessageId") REFERENCES "ChatMessages"("MessageID") ON DELETE CASCADE
            )
          `);
          } else {
            await pool.query(`
            CREATE TABLE IF NOT EXISTS "MessageAttachments" (
              "Id" SERIAL PRIMARY KEY,
              "MessageId" INTEGER NOT NULL,
              "FileName" VARCHAR(255) NOT NULL,
              "FilePath" VARCHAR(500) NOT NULL,
              "FileType" VARCHAR(50) NOT NULL,
              "FileSize" INTEGER NOT NULL,
              "CreatedAt" TIMESTAMP DEFAULT NOW(),
              FOREIGN KEY ("MessageId") REFERENCES "ChatMessages"("MessageID") ON DELETE CASCADE
            )
          `);
          }

          console.log('✅ MessageAttachments table ready');
        } catch (tableError) {
          console.error(
            '❌ MessageAttachments table error:',
            tableError.message
          );
        }

        // Insert attachments
        for (const file of files) {
          const fileUrl = `/uploads/chat/${file.filename}`;
          const fileType = file.mimetype.startsWith('image/')
            ? 'image'
            : 'file';

          try {
            const attachmentResult = await pool.query(
              `INSERT INTO "MessageAttachments" 
             ("MessageId", "FileName", "FilePath", "FileType", "FileSize", "CreatedAt")
             VALUES ($1, $2, $3, $4, $5, NOW())
             RETURNING "Id", "FileName", "FilePath", "FileType", "FileSize"`,
              [
                message.MessageID,
                file.originalname,
                fileUrl,
                fileType,
                file.size,
              ]
            );

            attachments.push({
              ...attachmentResult.rows[0],
              name: file.originalname,
              url: fileUrl,
              type: fileType,
              size: formatFileSize(file.size),
            });
          } catch (attachError) {
            console.error('Error saving attachment:', attachError);
          }
        }
      }

      // Prepare response
      const messageWithSender = {
        ...message,
        senderName: req.user.UserName,
        senderAvatar: req.user.Avatar,
        senderColor: 'bg-primary',
        isMine: true,
        attachments: attachments,
      };

      res.json({
        success: true,
        message: messageWithSender,
      });
    } catch (error) {
      console.error('Send message with files error:', error);

      // Clean up uploaded files if there was an error
      if (req.files) {
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkError) {
            console.error('Error deleting file:', unlinkError);
          }
        });
      }

      res.status(500).json({
        success: false,
        message: 'Không thể gửi tin nhắn: ' + error.message,
      });
    }
  }
);

// API: Get chat info sidebar data
router.get('/api/chat-info/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.Id;

    // Get media (images/videos) shared between users
    const mediaQuery = await pool.query(
      `SELECT ma."Id", ma."FileName", ma."FilePath", ma."FileType", ma."FileSize", ma."CreatedAt"
       FROM "MessageAttachments" ma
       INNER JOIN "ChatMessages" cm ON ma."MessageId" = cm."MessageID"
       WHERE ma."FileType" IN ('image', 'video')
         AND ((cm."SenderId" = $1 AND cm."ReceiverId" = $2)
              OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1))
       ORDER BY ma."CreatedAt" DESC
       LIMIT 50`,
      [currentUserId, userId]
    );

    // Get files shared between users
    const filesQuery = await pool.query(
      `SELECT ma."Id", ma."FileName", ma."FilePath", ma."FileType", ma."FileSize", ma."CreatedAt"
       FROM "MessageAttachments" ma
       INNER JOIN "ChatMessages" cm ON ma."MessageId" = cm."MessageID"
       WHERE ma."FileType" = 'file'
         AND ((cm."SenderId" = $1 AND cm."ReceiverId" = $2)
              OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1))
       ORDER BY ma."CreatedAt" DESC
       LIMIT 50`,
      [currentUserId, userId]
    );

    // Get links shared between users
    const linksQuery = await pool
      .query(
        `SELECT ml."LinkId", ml."URL", ml."Title", ml."Description", ml."ImageURL", ml."CreatedAt"
       FROM "MessageLinks" ml
       INNER JOIN "ChatMessages" cm ON ml."MessageId" = cm."MessageID"
       WHERE ((cm."SenderId" = $1 AND cm."ReceiverId" = $2)
              OR (cm."SenderId" = $2 AND cm."ReceiverId" = $1))
       ORDER BY ml."CreatedAt" DESC
       LIMIT 50`,
        [currentUserId, userId]
      )
      .catch(() => ({ rows: [] })); // Ignore if table doesn't exist yet

    // Get common groups (group chats where both users are members)
    // TODO: Implement this when group chat is ready
    const commonGroups = [];

    res.json({
      success: true,
      media: mediaQuery.rows,
      files: filesQuery.rows,
      links: linksQuery.rows,
      commonGroups: commonGroups,
    });
  } catch (error) {
    console.error('Get chat info error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tải thông tin chat',
    });
  }
});

// API: Clear chat history
router.post('/clear/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user.Id;

    console.log('Clearing chat history between:', currentUserId, 'and', chatId);

    // Delete all messages between the two users
    const result = await pool.query(
      `DELETE FROM "ChatMessages"
       WHERE (("SenderId" = $1 AND "ReceiverId" = $2)
          OR ("SenderId" = $2 AND "ReceiverId" = $1))`,
      [currentUserId, chatId]
    );

    console.log(`✅ Deleted ${result.rowCount} messages`);

    res.json({
      success: true,
      message: 'Đã xóa lịch sử trò chuyện',
      deletedCount: result.rowCount,
    });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xóa lịch sử trò chuyện',
    });
  }
});

// API: Delete chat (same as clear for now, in future might delete entire conversation thread)
router.delete('/delete/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user.Id;

    console.log('Deleting chat between:', currentUserId, 'and', chatId);

    // Delete all messages between the two users
    const result = await pool.query(
      `DELETE FROM "ChatMessages"
       WHERE (("SenderId" = $1 AND "ReceiverId" = $2)
          OR ("SenderId" = $2 AND "ReceiverId" = $1))`,
      [currentUserId, chatId]
    );

    console.log(`✅ Deleted ${result.rowCount} messages`);

    res.json({
      success: true,
      message: 'Đã xóa cuộc trò chuyện',
      deletedCount: result.rowCount,
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xóa cuộc trò chuyện',
    });
  }
});

// API: Delete group
router.delete('/delete-group/:groupId', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { groupId } = req.params;
    const currentUserId = req.user.Id;

    console.log('🗑️ Deleting group:', groupId, 'by user:', currentUserId);

    await client.query('BEGIN');

    // Check schema to determine which columns to use
    const schemaCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ChatGroups' 
      AND column_name IN ('Id', 'GroupId', 'CreatedById', 'CreatedBy')
    `);

    const hasIdColumn = schemaCheck.rows.some(
      (row) => row.column_name === 'Id'
    );
    const hasCreatedByIdColumn = schemaCheck.rows.some(
      (row) => row.column_name === 'CreatedById'
    );

    // Check if user is the creator of the group
    let creatorCheck;
    if (hasIdColumn && hasCreatedByIdColumn) {
      // UUID schema
      creatorCheck = await client.query(
        `SELECT "CreatedById" FROM "ChatGroups" WHERE "Id"::text = $1`,
        [groupId]
      );
    } else {
      // SERIAL schema
      creatorCheck = await client.query(
        `SELECT "CreatedBy" FROM "ChatGroups" WHERE "GroupId"::text = $1`,
        [groupId]
      );
    }

    if (creatorCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm',
      });
    }

    const creatorId =
      creatorCheck.rows[0].CreatedById || creatorCheck.rows[0].CreatedBy;

    // Only allow creator to delete the group
    if (creatorId && creatorId.toString() !== currentUserId.toString()) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Chỉ người tạo nhóm mới có quyền xóa nhóm',
      });
    }

    // Delete group messages first (if foreign key not set to CASCADE)
    try {
      const deletedMessages = await client.query(
        `DELETE FROM "GroupMessages" WHERE "GroupId"::text = $1`,
        [groupId]
      );
      console.log(`✅ Deleted ${deletedMessages.rowCount} group messages`);
    } catch (err) {
      console.log(
        'Note: GroupMessages might not exist or already deleted:',
        err.message
      );
    }

    // Delete group members
    const deletedMembers = await client.query(
      `DELETE FROM "GroupMembers" WHERE "GroupId"::text = $1`,
      [groupId]
    );
    console.log(`✅ Deleted ${deletedMembers.rowCount} group members`);

    // Delete the group itself
    let deletedGroup;
    if (hasIdColumn) {
      deletedGroup = await client.query(
        `DELETE FROM "ChatGroups" WHERE "Id"::text = $1`,
        [groupId]
      );
    } else {
      deletedGroup = await client.query(
        `DELETE FROM "ChatGroups" WHERE "GroupId"::text = $1`,
        [groupId]
      );
    }

    await client.query('COMMIT');

    console.log('✅ Group deleted successfully');

    res.json({
      success: true,
      message: 'Đã xóa nhóm thành công',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Delete group error:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa nhóm: ' + error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
