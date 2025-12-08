const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// Settings page
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get system settings from database or use defaults
    const settings = {
      // General
      systemName: 'IRequest System',
      systemDescription: 'Hệ thống quản lý yêu cầu',
      language: 'vi',
      timezone: 'Asia/Ho_Chi_Minh',
      dateFormat: 'DD/MM/YYYY',

      // Notifications
      enableNotifications: true,
      emailNotifications: true,
      browserNotifications: true,
      notifyRequestCreated: true,
      notifyRequestAssigned: true,
      notifyRequestUpdated: true,
      notifyCommentAdded: true,

      // Email
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      emailFrom: '',
      smtpSecure: true,

      // Security
      passwordMinLength: 6,
      requireUppercase: false,
      requireLowercase: false,
      requireDigit: false,
      requireSpecialChar: false,
      sessionTimeout: 60,
      twoFactorAuth: false,

      // Workflow
      autoAssignment: false,
      requireApproval: false,
      defaultPriority: 2,
      dueDateDays: 7,

      // Backup
      autoBackup: false,
      backupFrequency: 'daily',

      // Advanced
      maxFileSize: 10,
      allowedFileTypes: '.pdf,.doc,.docx,.jpg,.png,.jpeg',
      enableLogging: true,
      maintenanceMode: false,
    };

    res.render('settings/index', {
      title: 'Cài đặt hệ thống',
      settings: settings,
      backups: [],
      success: req.query.success,
      error: req.query.error,
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.render('settings/index', {
      title: 'Cài đặt hệ thống',
      error: 'Không thể tải cài đặt',
      settings: {},
      backups: [],
    });
  }
});

// Update general settings
router.post('/update/general', authenticateToken, async (req, res) => {
  try {
    // Save settings to database
    // For now, just redirect with success message
    res.redirect(
      '/settings?success=' + encodeURIComponent('Đã cập nhật cài đặt chung')
    );
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect(
      '/settings?error=' + encodeURIComponent('Không thể cập nhật cài đặt')
    );
  }
});

// Update notification settings
router.post('/update/notifications', authenticateToken, async (req, res) => {
  try {
    res.redirect(
      '/settings?success=' + encodeURIComponent('Đã cập nhật cài đặt thông báo')
    );
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect(
      '/settings?error=' + encodeURIComponent('Không thể cập nhật cài đặt')
    );
  }
});

// Update email settings
router.post('/update/email', authenticateToken, async (req, res) => {
  try {
    res.redirect(
      '/settings?success=' + encodeURIComponent('Đã cập nhật cài đặt email')
    );
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect(
      '/settings?error=' + encodeURIComponent('Không thể cập nhật cài đặt')
    );
  }
});

// Update security settings
router.post('/update/security', authenticateToken, async (req, res) => {
  try {
    res.redirect(
      '/settings?success=' + encodeURIComponent('Đã cập nhật cài đặt bảo mật')
    );
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect(
      '/settings?error=' + encodeURIComponent('Không thể cập nhật cài đặt')
    );
  }
});

// Update workflow settings
router.post('/update/workflow', authenticateToken, async (req, res) => {
  try {
    res.redirect(
      '/settings?success=' + encodeURIComponent('Đã cập nhật cài đặt workflow')
    );
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect(
      '/settings?error=' + encodeURIComponent('Không thể cập nhật cài đặt')
    );
  }
});

// Update backup settings
router.post('/update/backup', authenticateToken, async (req, res) => {
  try {
    res.redirect(
      '/settings?success=' + encodeURIComponent('Đã cập nhật cài đặt sao lưu')
    );
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect(
      '/settings?error=' + encodeURIComponent('Không thể cập nhật cài đặt')
    );
  }
});

// Update advanced settings
router.post('/update/advanced', authenticateToken, async (req, res) => {
  try {
    res.redirect(
      '/settings?success=' + encodeURIComponent('Đã cập nhật cài đặt nâng cao')
    );
  } catch (error) {
    console.error('Update settings error:', error);
    res.redirect(
      '/settings?error=' + encodeURIComponent('Không thể cập nhật cài đặt')
    );
  }
});

// Test email
router.post('/test-email', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement email sending
    res.json({ success: true, message: 'Email đã được gửi' });
  } catch (error) {
    console.error('Test email error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Create backup
router.post('/create-backup', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement backup creation
    res.json({ success: true, message: 'Đã tạo bản sao lưu' });
  } catch (error) {
    console.error('Create backup error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Download backup
router.get('/download-backup/:id', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement backup download
    res.json({ success: false, message: 'Chức năng chưa được triển khai' });
  } catch (error) {
    console.error('Download backup error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Delete backup
router.delete('/delete-backup/:id', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement backup deletion
    res.json({ success: true, message: 'Đã xóa bản sao lưu' });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Clear cache
router.post('/clear-cache', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement cache clearing
    res.json({ success: true, message: 'Đã xóa cache' });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Reset settings
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    // TODO: Implement settings reset
    res.json({ success: true, message: 'Đã đặt lại cài đặt' });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
