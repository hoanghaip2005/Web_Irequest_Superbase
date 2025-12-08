const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/chat');
    // Create directory if it doesn't exist
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
    // Accept images and common file types
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
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

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
    ];

    // Check extension OR mimetype (more flexible)
    if (
      allowedExtensions.includes(ext) ||
      allowedMimeTypes.includes(file.mimetype)
    ) {
      return cb(null, true);
    } else {
      console.log('File rejected:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        ext: ext,
      });
      cb(new Error(`Loại file không được hỗ trợ: ${ext} (${file.mimetype})`));
    }
  },
});

// Chat index page
router.get('/', authenticateToken, async (req, res) => {
  try {
    const chatId = req.query.chat; // Changed from req.query.id
    const chatType = req.query.type || 'direct';

    console.log('Chat page - User:', req.user.Id);
    console.log('Chat page - chatId:', chatId);
    console.log('Chat page - chatType:', chatType);

    // Get direct chats from Messages table
    const directChatsQuery = `
      SELECT DISTINCT
        CASE 
          WHEN m."SenderId" = $1 THEN m."ReceiverId"
          ELSE m."SenderId"
        END as "UserId",
        COALESCE(u."UserName", u."Email") as name,
        u."Email" as email,
        u."Avatar" as "AvatarPath",
        'bg-primary' as "AvatarColor",
        (SELECT m2."Content" 
         FROM "Messages" m2 
         WHERE (m2."SenderId" = $1 AND m2."ReceiverId" = u."Id") 
            OR (m2."SenderId" = u."Id" AND m2."ReceiverId" = $1)
         ORDER BY m2."CreatedAt" DESC 
         LIMIT 1) as "lastMessage",
        (SELECT m2."CreatedAt" 
         FROM "Messages" m2 
         WHERE (m2."SenderId" = $1 AND m2."ReceiverId" = u."Id") 
            OR (m2."SenderId" = u."Id" AND m2."ReceiverId" = $1)
         ORDER BY m2."CreatedAt" DESC 
         LIMIT 1) as "lastMessageTime",
        (SELECT COUNT(*) 
         FROM "Messages" m3 
         WHERE m3."SenderId" = u."Id" 
           AND m3."ReceiverId" = $1 
           AND m3."IsRead" = false) as "unreadCount",
        false as online
      FROM "Messages" m
      JOIN "Users" u ON (CASE WHEN m."SenderId" = $1 THEN m."ReceiverId" ELSE m."SenderId" END) = u."Id"
      WHERE m."GroupId" IS NULL 
        AND (m."SenderId" = $1 OR m."ReceiverId" = $1)
        AND m."IsDeleted" = false
      ORDER BY "lastMessageTime" DESC NULLS LAST
      LIMIT 50
    `;

    // Get group chats
    const groupChatsQuery = `
      SELECT 
        cg."Id" as id,
        cg."Name" as name,
        cg."Description" as description,
        '' as "lastMessage",
        '' as "lastMessageUser",
        NOW() as "lastMessageTime",
        0 as "unreadCount",
        (SELECT COUNT(*) FROM "ChatGroupMembers" WHERE "GroupId" = cg."Id") as "memberCount"
      FROM "ChatGroups" cg
      JOIN "ChatGroupMembers" cgm ON cg."Id" = cgm."GroupId"
      WHERE cgm."UserId" = $1
      ORDER BY cg."CreatedAt" DESC
      LIMIT 50
    `;

    const [directChats, groupChats] = await Promise.all([
      query(directChatsQuery, [req.user.Id]),
      query(groupChatsQuery, [req.user.Id]),
    ]);

    console.log('Direct chats found:', directChats.rows.length);
    console.log('Direct chats:', JSON.stringify(directChats.rows, null, 2));
    console.log('Group chats found:', groupChats.rows.length);

    let currentChat = null;
    if (chatId) {
      // Load specific chat
      if (chatType === 'direct') {
        const chatQuery = `
          SELECT 
            u."Id" as id,
            COALESCE(u."UserName", u."Email") as name,
            u."Email",
            u."Avatar" as "AvatarPath",
            'bg-primary' as "AvatarColor"
          FROM "Users" u
          WHERE u."Id" = $1
        `;
        const chatResult = await query(chatQuery, [chatId]);
        if (chatResult.rows.length > 0) {
          currentChat = chatResult.rows[0];
          currentChat.isGroup = false;

          // Load messages for this direct chat
          const messagesQuery = `
            SELECT 
              m."Id",
              m."Content",
              m."SenderId",
              m."ReceiverId",
              m."CreatedAt",
              m."IsRead",
              COALESCE(u."UserName", u."Email") as "senderName",
              u."Avatar" as "senderAvatar",
              'bg-primary' as "senderColor"
            FROM "Messages" m
            JOIN "Users" u ON m."SenderId" = u."Id"
            WHERE m."GroupId" IS NULL
              AND ((m."SenderId" = $1 AND m."ReceiverId" = $2) 
                OR (m."SenderId" = $2 AND m."ReceiverId" = $1))
              AND m."IsDeleted" = false
            ORDER BY m."CreatedAt" ASC
            LIMIT 100
          `;
          const messagesResult = await query(messagesQuery, [
            req.user.Id,
            chatId,
          ]);
          currentChat.messages = messagesResult.rows;
        }
      } else {
        const chatQuery = `
          SELECT cg.*,
            (SELECT COUNT(*) FROM "ChatGroupMembers" WHERE "GroupId" = cg."Id") as "memberCount"
          FROM "ChatGroups" cg
          WHERE cg."Id" = $1
        `;
        const chatResult = await query(chatQuery, [chatId]);
        if (chatResult.rows.length > 0) {
          currentChat = chatResult.rows[0];
          currentChat.isGroup = true;

          // Load messages for this group chat
          const messagesQuery = `
            SELECT 
              m."Id",
              m."Content",
              m."SenderId",
              m."CreatedAt",
              m."IsRead",
              COALESCE(u."UserName", u."Email") as "senderName",
              u."Avatar" as "senderAvatar",
              'bg-primary' as "senderColor"
            FROM "Messages" m
            JOIN "Users" u ON m."SenderId" = u."Id"
            WHERE m."GroupId" = $1
              AND m."IsDeleted" = false
            ORDER BY m."CreatedAt" ASC
            LIMIT 100
          `;
          const messagesResult = await query(messagesQuery, [chatId]);
          currentChat.messages = messagesResult.rows;
        }
      }
    }

    res.render('chat/index', {
      title: 'Chat',
      directChats: directChats.rows,
      groupChats: groupChats.rows,
      currentChat: currentChat,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.render('chat/index', {
      title: 'Chat',
      error: 'Không thể tải dữ liệu chat',
      directChats: [],
      groupChats: [],
      currentChat: null,
    });
  }
});

// Get chat details
router.get('/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;

    // TODO: Implement chat loading with messages

    res.json({ success: true, chat: {} });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send message with files
router.post(
  '/send-message-with-files',
  authenticateToken,
  upload.array('files', 10),
  async (req, res) => {
    try {
      const { chatId, chatType, content } = req.body;
      const files = req.files;

      console.log('Send message with files request:', {
        chatId,
        chatType,
        content: content?.substring(0, 50),
        filesCount: files?.length || 0,
        userId: req.user.Id,
      });

      if (!content && (!files || files.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Tin nhắn hoặc file không được để trống',
        });
      }

      let insertQuery;
      let params;
      const messageContent = content?.trim() || '';

      if (chatType === 'direct') {
        insertQuery = `
        INSERT INTO "Messages" 
          ("Content", "SenderId", "ReceiverId", "GroupId", "IsRead", "IsDeleted", "CreatedAt")
        VALUES ($1, $2, $3, NULL, false, false, NOW())
        RETURNING 
          "Id",
          "Content",
          "SenderId",
          "ReceiverId",
          "CreatedAt",
          "IsRead"
      `;
        params = [messageContent, req.user.Id, chatId];
      } else {
        insertQuery = `
        INSERT INTO "Messages" 
          ("Content", "SenderId", "ReceiverId", "GroupId", "IsRead", "IsDeleted", "CreatedAt")
        VALUES ($1, $2, NULL, $3, false, false, NOW())
        RETURNING 
          "Id",
          "Content",
          "SenderId",
          "GroupId",
          "CreatedAt",
          "IsRead"
      `;
        params = [messageContent, req.user.Id, chatId];
      }

      const result = await query(insertQuery, params);
      const message = result.rows[0];

      // Save file attachments if any
      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileUrl = `/uploads/chat/${file.filename}`;
          const fileType = file.mimetype.startsWith('image/')
            ? 'image'
            : 'file';

          // Save to MessageAttachments table
          const attachmentQuery = `
          INSERT INTO "MessageAttachments" 
            ("MessageId", "FileName", "FilePath", "FileType", "FileSize", "CreatedAt")
          VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING "Id", "FileName", "FilePath", "FileType", "FileSize"
        `;

          const attachmentResult = await query(attachmentQuery, [
            message.Id,
            file.originalname,
            fileUrl,
            fileType,
            file.size,
          ]);

          attachments.push({
            name: file.originalname,
            url: fileUrl,
            type: fileType,
            size: formatFileSize(file.size),
          });
        }
      }

      // Add sender info and attachments
      message.senderName = req.user.UserName || req.user.Email;
      message.senderAvatar = req.user.Avatar;
      message.senderColor = 'bg-primary';
      message.isMine = true;
      message.attachments = attachments;

      res.json({ success: true, message: message });
    } catch (error) {
      console.error('Send message with files error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Send message
router.post('/send-message', authenticateToken, async (req, res) => {
  try {
    const { chatId, chatType, content } = req.body;

    console.log('Send message request:', {
      chatId,
      chatType,
      content: content?.substring(0, 50),
      userId: req.user.Id,
    });

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống',
      });
    }

    let insertQuery;
    let params;

    if (chatType === 'direct') {
      // Direct message - ReceiverId is the chatId (other user's ID)
      insertQuery = `
        INSERT INTO "Messages" 
          ("Content", "SenderId", "ReceiverId", "GroupId", "IsRead", "IsDeleted", "CreatedAt")
        VALUES ($1, $2, $3, NULL, false, false, NOW())
        RETURNING 
          "Id",
          "Content",
          "SenderId",
          "ReceiverId",
          "CreatedAt",
          "IsRead"
      `;
      params = [content.trim(), req.user.Id, chatId];
      console.log('Direct message params:', params);
    } else {
      // Group message
      insertQuery = `
        INSERT INTO "Messages" 
          ("Content", "SenderId", "ReceiverId", "GroupId", "IsRead", "IsDeleted", "CreatedAt")
        VALUES ($1, $2, NULL, $3, false, false, NOW())
        RETURNING 
          "Id",
          "Content",
          "SenderId",
          "GroupId",
          "CreatedAt",
          "IsRead"
      `;
      params = [content.trim(), req.user.Id, chatId];
      console.log('Group message params:', params);
    }

    console.log('Executing query:', insertQuery);
    const result = await query(insertQuery, params);
    console.log('Insert result:', result.rows[0]);
    const message = result.rows[0];

    // Add sender info
    message.senderName = req.user.UserName || req.user.Email;
    message.senderAvatar = req.user.Avatar;
    message.senderColor = 'bg-primary';
    message.isMine = true;

    res.json({ success: true, message: message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search users
router.get('/search-users', authenticateToken, async (req, res) => {
  try {
    const searchQuery = req.query.q || '';

    const usersQuery = `
      SELECT 
        "Id" as id, 
        COALESCE("UserName", "Email") as name, 
        "Email" as email,
        "Avatar" as "AvatarPath",
        'bg-primary' as "AvatarColor"
      FROM "Users"
      WHERE ("UserName" ILIKE $1 OR "Email" ILIKE $1) 
        AND "Id" != $2
      ORDER BY "UserName"
      LIMIT 20
    `;

    const result = await query(usersQuery, [`%${searchQuery}%`, req.user.Id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json([]);
  }
});

// Start direct chat
router.post('/start-direct', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;

    console.log('Start direct chat - Current user:', req.user.Id);
    console.log('Start direct chat - Target user:', userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    // For direct chats, we don't need a Chats entry
    // Just return the userId as chatId to start messaging
    // Messages table will handle the conversation via SenderId/ReceiverId

    res.json({
      success: true,
      chatId: userId,
      chatType: 'direct',
    });
  } catch (error) {
    console.error('Start direct chat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create group
router.post('/create-group', authenticateToken, async (req, res) => {
  try {
    const { name, description, members } = req.body;

    // Create group
    const createGroupQuery = `
      INSERT INTO "ChatGroups" ("Name", "Description", "CreatedById", "CreatedAt")
      VALUES ($1, $2, $3, NOW())
      RETURNING "Id"
    `;
    const newGroup = await query(createGroupQuery, [
      name,
      description || '',
      req.user.Id,
    ]);
    const groupId = newGroup.rows[0].Id;

    // Add creator as admin
    await query(
      `
      INSERT INTO "ChatGroupMembers" ("GroupId", "UserId", "IsAdmin", "JoinedAt")
      VALUES ($1, $2, true, NOW())
    `,
      [groupId, req.user.Id]
    );

    // Add other members
    for (const memberId of members) {
      await query(
        `
        INSERT INTO "ChatGroupMembers" ("GroupId", "UserId", "IsAdmin", "JoinedAt")
        VALUES ($1, $2, false, NOW())
      `,
        [groupId, memberId]
      );
    }

    res.json({ success: true, groupId: groupId });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload file
router.post('/upload-file', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement file upload
    res.json({
      success: true,
      message: { id: Date.now(), content: 'File uploaded', isFile: true },
    });
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark messages as read
router.post('/:chatId/mark-read', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement mark as read
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear chat history
router.delete('/:chatId/clear', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement clear chat
    res.json({ success: true });
  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete chat
router.delete('/:chatId', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement delete chat
    res.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
