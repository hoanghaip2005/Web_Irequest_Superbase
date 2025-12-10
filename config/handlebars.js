const Handlebars = require('express-handlebars');

// Register Handlebars helpers
const hbs = Handlebars.create({
  defaultLayout: 'main',
  extname: '.hbs',
  helpers: {
    // Helper to compare two values for equality
    ifEquals: function (arg1, arg2, options) {
      return arg1 == arg2 ? options.fn(this) : options.inverse(this);
    },

    // Helper for inline equality check
    eq: function (arg1, arg2) {
      return arg1 == arg2;
    },

    // Helper to check if value exists in array
    ifIn: function (elem, list, options) {
      if (list && list.indexOf(elem) > -1) {
        return options.fn(this);
      }
      return options.inverse(this);
    },

    // Helper for formatting dates
    formatDate: function (date) {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('vi-VN');
    },

    // Helper for formatting datetime
    formatDateTime: function (date) {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleString('vi-VN');
    },

    // Helper for formatting time (for chat messages)
    formatTime: function (timestamp) {
      if (!timestamp) return '';

      const date = new Date(timestamp);
      const now = new Date();

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return timestamp;
      }

      const diff = now - date;

      // Just now (less than 1 minute)
      if (diff < 60000 && diff >= 0) return 'Vừa xong';

      // Minutes ago
      if (diff < 3600000 && diff >= 0) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} phút trước`;
      }

      // Hours ago (same day)
      if (diff < 86400000 && diff >= 0) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} giờ trước`;
      }

      // Today - show time only
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      // Yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return (
          'Hôm qua ' +
          date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      }

      // This year - show date and time without year
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleString('vi-VN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      // Different year - show full date
      return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },

    // Helper to get substring
    substring: function (str, start, length) {
      if (!str) return '';
      return str.substring(start, start + length);
    },

    // Helper for mathematical operations
    add: function (a, b) {
      return a + b;
    },

    subtract: function (a, b) {
      return a - b;
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

    // Helper to check if number is greater than
    gt: function (a, b) {
      return a > b;
    },

    // Helper to check if number is less than
    lt: function (a, b) {
      return a < b;
    },

    // Helper to convert to lowercase
    toLowerCase: function (str) {
      if (!str) return '';
      return str.toLowerCase();
    },

    // Helper to get array/string length
    length: function (value) {
      if (!value) return 0;
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'string') return value.length;
      if (typeof value === 'object' && value.length !== undefined)
        return value.length;
      return 0;
    },

    // Helper for pagination
    pagination: function (currentPage, totalPages) {
      const pages = [];
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, currentPage + 2);

      for (let i = startPage; i <= endPage; i++) {
        pages.push({
          number: i,
          active: i === currentPage,
        });
      }

      return pages;
    },
  },
});

module.exports = hbs;
