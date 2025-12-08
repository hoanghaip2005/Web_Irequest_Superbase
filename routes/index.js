const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const Request = require('../models/Request');

// Trang chủ
router.get('/', (req, res) => {
  res.render('index', {
    title: 'iRequest - Hệ thống quản lý yêu cầu',
    user: req.session.user,
  });
});

// Dashboard (cần đăng nhập)
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Lấy dữ liệu dashboard từ Request model
    const stats = (await Request.getDashboardData)
      ? await Request.getDashboardData(req.user.Id)
      : {
          myRequests: 0,
          assignedToMe: 0,
          pendingRequests: 0,
          recentActivity: [],
        };

    res.render('dashboard', {
      title: 'Tổng quan',
      page: 'dashboard',
      layout: 'main',
      user: {
        ...req.user,
        userName: req.user.UserName || req.user.userName,
        department: 'Phòng IT', // Temporary, will get from DB later
      },
      stats,
      recentActivity: stats.recentActivity || [],
      unreadNotifications: 0, // Will implement notification system later
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', {
      title: 'Tổng quan',
      page: 'dashboard',
      layout: 'main',
      user: {
        ...req.user,
        userName: req.user.UserName || req.user.userName,
        department: 'Phòng IT',
      },
      stats: {
        myRequests: 0,
        assignedToMe: 0,
        pendingRequests: 0,
        recentActivity: [],
      },
      recentActivity: [],
      unreadNotifications: 0,
      error: 'Không thể tải dữ liệu dashboard',
    });
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'Về chúng tôi',
  });
});

// API để test database connection
router.get('/api/health', async (req, res) => {
  try {
    const { testConnection } = require('../config/database');
    const dbStatus = await testConnection();

    res.json({
      status: 'OK',
      database: dbStatus ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      message: error.message,
    });
  }
});

module.exports = router;
