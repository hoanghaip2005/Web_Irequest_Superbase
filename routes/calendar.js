const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Get calendar page
router.get('/', authenticateToken, async (req, res) => {
  try {
    res.render('calendar/index', {
      title: 'Lịch làm việc',
      user: req.user,
    });
  } catch (error) {
    console.error('Calendar page error:', error);
    res.status(500).render('errors/500', {
      title: 'Lỗi',
      error: error.message,
    });
  }
});

// Get all events (API)
router.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const start = req.query.start;
    const end = req.query.end;

    let eventsQuery = `
      SELECT 
        e."EventID" as id,
        e."Title" as title,
        e."Description" as description,
        e."StartDate" as start,
        e."EndDate" as "end",
        e."AllDay" as "allDay",
        e."Location" as location,
        e."Color" as color,
        e."EventType" as "eventType",
        e."RelatedRequestID" as "relatedRequestID",
        e."Attendees" as attendees,
        e."ReminderMinutes" as "reminderMinutes",
        u."FullName" as "createdByName",
        u."Email" as "createdByEmail"
      FROM "Events" e
      LEFT JOIN "Users" u ON e."CreatedBy" = u."Id"
      WHERE e."IsActive" = true
        AND (e."CreatedBy" = $1 OR e."Attendees" LIKE '%' || $1 || '%')
    `;

    const params = [req.user.Id];

    if (start && end) {
      eventsQuery += ` AND e."StartDate" <= $3 AND e."EndDate" >= $2`;
      params.push(start, end);
    }

    eventsQuery += ` ORDER BY e."StartDate" ASC`;

    const result = await query(eventsQuery, params);

    const events = result.rows.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      backgroundColor: event.color,
      borderColor: event.color,
      extendedProps: {
        description: event.description,
        location: event.location,
        eventType: event.eventType,
        relatedRequestID: event.relatedRequestID,
        attendees: event.attendees,
        reminderMinutes: event.reminderMinutes,
        createdByName: event.createdByName,
        createdByEmail: event.createdByEmail,
      },
    }));

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách sự kiện: ' + error.message,
    });
  }
});

// Create new event (API)
router.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      start,
      end,
      allDay,
      location,
      color,
      eventType,
      relatedRequestID,
      attendees,
      reminderMinutes,
    } = req.body;

    if (!title || !start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Tiêu đề, ngày bắt đầu và ngày kết thúc là bắt buộc',
      });
    }

    const insertQuery = `
      INSERT INTO "Events" (
        "Title", "Description", "StartDate", "EndDate", "AllDay", 
        "Location", "Color", "CreatedBy", "EventType", "RelatedRequestID",
        "Attendees", "ReminderMinutes", "CreatedAt", "UpdatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await query(insertQuery, [
      title,
      description || null,
      start,
      end,
      allDay || false,
      location || null,
      color || '#3788d8',
      req.user.Id,
      eventType || null,
      relatedRequestID || null,
      attendees ? JSON.stringify(attendees) : null,
      reminderMinutes || null,
    ]);

    res.json({
      success: true,
      message: 'Tạo sự kiện thành công',
      event: result.rows[0],
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo sự kiện: ' + error.message,
    });
  }
});

// Update event (API)
router.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const {
      title,
      description,
      start,
      end,
      allDay,
      location,
      color,
      eventType,
      relatedRequestID,
      attendees,
      reminderMinutes,
    } = req.body;

    // Check if user owns this event
    const checkQuery = `SELECT * FROM "Events" WHERE "EventID" = $1 AND "CreatedBy" = $2`;
    const checkResult = await query(checkQuery, [eventId, req.user.Id]);

    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa sự kiện này',
      });
    }

    const updateQuery = `
      UPDATE "Events"
      SET 
        "Title" = $1,
        "Description" = $2,
        "StartDate" = $3,
        "EndDate" = $4,
        "AllDay" = $5,
        "Location" = $6,
        "Color" = $7,
        "EventType" = $8,
        "RelatedRequestID" = $9,
        "Attendees" = $10,
        "ReminderMinutes" = $11,
        "UpdatedAt" = CURRENT_TIMESTAMP
      WHERE "EventID" = $12
      RETURNING *
    `;

    const result = await query(updateQuery, [
      title,
      description || null,
      start,
      end,
      allDay || false,
      location || null,
      color || '#3788d8',
      eventType || null,
      relatedRequestID || null,
      attendees ? JSON.stringify(attendees) : null,
      reminderMinutes || null,
      eventId,
    ]);

    res.json({
      success: true,
      message: 'Cập nhật sự kiện thành công',
      event: result.rows[0],
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật sự kiện: ' + error.message,
    });
  }
});

// Delete event (API)
router.delete('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;

    // Check if user owns this event
    const checkQuery = `SELECT * FROM "Events" WHERE "EventID" = $1 AND "CreatedBy" = $2`;
    const checkResult = await query(checkQuery, [eventId, req.user.Id]);

    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa sự kiện này',
      });
    }

    // Soft delete
    const deleteQuery = `
      UPDATE "Events"
      SET "IsActive" = false, "UpdatedAt" = CURRENT_TIMESTAMP
      WHERE "EventID" = $1
    `;

    await query(deleteQuery, [eventId]);

    res.json({
      success: true,
      message: 'Xóa sự kiện thành công',
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa sự kiện: ' + error.message,
    });
  }
});

// Drag and drop event (update dates)
router.patch('/api/events/:id/move', authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { start, end, allDay } = req.body;

    // Check if user owns this event
    const checkQuery = `SELECT * FROM "Events" WHERE "EventID" = $1 AND "CreatedBy" = $2`;
    const checkResult = await query(checkQuery, [eventId, req.user.Id]);

    if (checkResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền di chuyển sự kiện này',
      });
    }

    const updateQuery = `
      UPDATE "Events"
      SET 
        "StartDate" = $1,
        "EndDate" = $2,
        "AllDay" = $3,
        "UpdatedAt" = CURRENT_TIMESTAMP
      WHERE "EventID" = $4
      RETURNING *
    `;

    const result = await query(updateQuery, [start, end, allDay, eventId]);

    res.json({
      success: true,
      message: 'Di chuyển sự kiện thành công',
      event: result.rows[0],
    });
  } catch (error) {
    console.error('Move event error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi di chuyển sự kiện: ' + error.message,
    });
  }
});

module.exports = router;
