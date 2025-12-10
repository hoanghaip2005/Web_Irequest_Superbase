const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import database connection
const { testConnection, gracefulShutdown } = require('./config/database');

// Import routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const userRoutes = require('./routes/users');

// Initialize Express app
const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Tạm thời disable để dễ development
  })
);

// CORS middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? 'your-domain.com'
        : 'http://localhost:3000',
    credentials: true,
  })
);

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  })
);

// Handlebars configuration
const hbs = exphbs.create({
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  extname: '.hbs',
  helpers: {
    // Helper functions for templates
    ifEquals: function (arg1, arg2, options) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    },
    eq: function (arg1, arg2) {
      return arg1 == arg2;
    },
    json: function (context) {
      return JSON.stringify(context);
    },
    substring: function (str, start, length) {
      if (!str) return '';
      return str.substring(start, start + length);
    },
    gt: function (arg1, arg2) {
      return arg1 > arg2;
    },
    length: function (arr) {
      if (!arr) return 0;
      return arr.length || 0;
    },
    formatDate: function (date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString('vi-VN');
    },
    formatDateTime: function (date) {
      if (!date) return '';
      return new Date(date).toLocaleString('vi-VN');
    },
    formatTime: function (timestamp) {
      if (!timestamp) return '';

      // Parse timestamp and convert to Vietnam timezone (UTC+7)
      const date = new Date(timestamp);
      const now = new Date();

      if (isNaN(date.getTime())) return timestamp;

      // Calculate diff using local time
      const diff = now - date;

      // Just now (less than 1 minute)
      if (diff < 60000 && diff >= 0) return 'Vừa xong';

      // Minutes ago
      if (diff < 3600000 && diff >= 0) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} phút trước`;
      }

      // Hours ago (within 24 hours)
      if (diff < 86400000 && diff >= 0) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} giờ trước`;
      }

      // Format options for Vietnam timezone
      const vnOptions = { timeZone: 'Asia/Ho_Chi_Minh' };

      // Today - show time only
      const todayStr = now.toLocaleDateString('en-CA', vnOptions);
      const dateStr = date.toLocaleDateString('en-CA', vnOptions);

      if (dateStr === todayStr) {
        return date.toLocaleTimeString('vi-VN', {
          ...vnOptions,
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      // Yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('en-CA', vnOptions);

      if (dateStr === yesterdayStr) {
        return (
          'Hôm qua ' +
          date.toLocaleTimeString('vi-VN', {
            ...vnOptions,
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      }

      // This year - show date and time without year
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleString('vi-VN', {
          ...vnOptions,
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      // Different year - show full date
      return date.toLocaleString('vi-VN', {
        ...vnOptions,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    json: function (context) {
      return JSON.stringify(context);
    },
    substring: function (str, start, end) {
      if (!str) return '';
      return str.substring(start, end);
    },
    add: function (a, b) {
      return a + b;
    },
    subtract: function (a, b) {
      return a - b;
    },
    multiply: function (a, b) {
      return a * b;
    },
    gt: function (a, b) {
      return a > b;
    },
    lt: function (a, b) {
      return a < b;
    },
    gte: function (a, b) {
      return a >= b;
    },
    lte: function (a, b) {
      return a <= b;
    },
    for: function (from, to, incr, block) {
      let accum = '';
      for (let i = from; i <= to; i += incr || 1) {
        accum += block.fn(i);
      }
      return accum;
    },
    toLowerCase: function (str) {
      if (!str) return '';
      return str.toString().toLowerCase();
    },
    unless: function (conditional, options) {
      if (!conditional) {
        return options.fn(this);
      } else {
        return options.inverse(this);
      }
    },
    length: function (value) {
      if (!value) return 0;
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'string') return value.length;
      if (typeof value === 'object' && value.length !== undefined)
        return value.length;
      return 0;
    },
    lt: function (arg1, arg2) {
      return arg1 < arg2;
    },
    add: function (arg1, arg2) {
      return arg1 + arg2;
    },
    subtract: function (arg1, arg2) {
      return arg1 - arg2;
    },
    range: function (start, end) {
      const result = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    },
    // Helper for complex math operations (used in analytics)
    math: function (lvalue, operator, rvalue, operator2, rvalue2) {
      lvalue = parseFloat(lvalue);
      rvalue = parseFloat(rvalue);

      // Handle two operations (e.g., a * b / c)
      if (operator2 && rvalue2) {
        rvalue2 = parseFloat(rvalue2);
        let intermediate;
        switch (operator) {
          case '+':
            intermediate = lvalue + rvalue;
            break;
          case '-':
            intermediate = lvalue - rvalue;
            break;
          case '*':
            intermediate = lvalue * rvalue;
            break;
          case '/':
            intermediate = rvalue !== 0 ? lvalue / rvalue : 0;
            break;
          case '%':
            intermediate = lvalue % rvalue;
            break;
          default:
            return 0;
        }
        switch (operator2) {
          case '+':
            return intermediate + rvalue2;
          case '-':
            return intermediate - rvalue2;
          case '*':
            return intermediate * rvalue2;
          case '/':
            return rvalue2 !== 0 ? intermediate / rvalue2 : 0;
          case '%':
            return intermediate % rvalue2;
          default:
            return intermediate;
        }
      }

      // Handle single operation
      switch (operator) {
        case '+':
          return lvalue + rvalue;
        case '-':
          return lvalue - rvalue;
        case '*':
          return lvalue * rvalue;
        case '/':
          return rvalue !== 0 ? lvalue / rvalue : 0;
        case '%':
          return lvalue % rvalue;
        default:
          return 0;
      }
    },
  },
});

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware để pass user session tới views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  next();
});

// Routes
const notificationRoutes = require('./routes/notifications');
const settingsRoutes = require('./routes/settings');
const chatRoutes = require('./routes/chat');
const departmentRoutes = require('./routes/departments');
const workflowRoutes = require('./routes/workflows');
const employeeRoutes = require('./routes/employees');
const analyticsRoutes = require('./routes/analytics');
const reportsRoutes = require('./routes/reports');
const activityLogRoutes = require('./routes/activity-log');
const calendarRoutes = require('./routes/calendar');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/requests', requestRoutes);
app.use('/users', userRoutes);
app.use('/notifications', notificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/settings', settingsRoutes);
app.use('/chat', chatRoutes);
app.use('/departments', departmentRoutes);
app.use('/workflows', workflowRoutes);
app.use('/employees', employeeRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/reports', reportsRoutes);
app.use('/activity-log', activityLogRoutes);
app.use('/calendar', calendarRoutes);

// 404 Error handler
app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Trang không tồn tại',
    message: 'Xin lỗi, trang bạn tìm kiếm không tồn tại.',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' ? 'Đã có lỗi xảy ra!' : err.message;

  res.status(status).render('errors/500', {
    title: 'Lỗi hệ thống',
    message: message,
    error: process.env.NODE_ENV === 'production' ? {} : err,
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Test database connection
  console.log('🔗 Testing database connection...');
  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log('✅ Database connected successfully');
  } else {
    console.log('❌ Database connection failed');
  }

  console.log(`📊 Visit: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await gracefulShutdown();
  process.exit(0);
});

module.exports = app;
