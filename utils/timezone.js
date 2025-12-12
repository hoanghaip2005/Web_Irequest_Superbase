/**
 * Timezone Utility Functions
 * Xử lý tất cả các thao tác liên quan đến múi giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7)
 */

const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy thời gian hiện tại theo múi giờ Việt Nam
 * @returns {Date} Date object
 */
function getCurrentVietnamTime() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: VIETNAM_TIMEZONE })
  );
}

/**
 * Chuyển đổi date sang múi giờ Việt Nam
 * @param {Date|string} date - Date object hoặc date string
 * @returns {Date} Date object đã convert sang VN timezone
 */
function toVietnamTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return new Date(d.toLocaleString('en-US', { timeZone: VIETNAM_TIMEZONE }));
}

/**
 * Format date theo định dạng Việt Nam
 * @param {Date|string} date - Date object hoặc date string
 * @param {Object} options - Format options
 * @returns {string} Formatted date string
 */
function formatVietnamDate(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  const defaultOptions = {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  };
  return d.toLocaleDateString('vi-VN', defaultOptions);
}

/**
 * Format datetime theo định dạng Việt Nam
 * @param {Date|string} date - Date object hoặc date string
 * @param {Object} options - Format options
 * @returns {string} Formatted datetime string
 */
function formatVietnamDateTime(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  const defaultOptions = {
    timeZone: VIETNAM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  };
  return d.toLocaleString('vi-VN', defaultOptions);
}

/**
 * Format time theo định dạng Việt Nam
 * @param {Date|string} date - Date object hoặc date string
 * @param {Object} options - Format options
 * @returns {string} Formatted time string
 */
function formatVietnamTime(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  const defaultOptions = {
    timeZone: VIETNAM_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...options,
  };
  return d.toLocaleTimeString('vi-VN', defaultOptions);
}

/**
 * Lấy timestamp hiện tại của Việt Nam
 * @returns {number} Unix timestamp in milliseconds
 */
function getVietnamTimestamp() {
  return getCurrentVietnamTime().getTime();
}

/**
 * Tính khoảng thời gian từ quá khứ đến hiện tại (relative time)
 * @param {Date|string} date - Date object hoặc date string
 * @returns {string} Relative time string (ví dụ: "5 phút trước", "2 giờ trước")
 */
function getRelativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = getCurrentVietnamTime();
  const diff = now - d;

  // Just now (less than 1 minute)
  if (diff < 60000) return 'Vừa xong';

  // Minutes ago
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} phút trước`;
  }

  // Hours ago
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} giờ trước`;
  }

  // Days ago
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} ngày trước`;
  }

  // Weeks ago
  if (diff < 2592000000) {
    const weeks = Math.floor(diff / 604800000);
    return `${weeks} tuần trước`;
  }

  // Months ago
  if (diff < 31536000000) {
    const months = Math.floor(diff / 2592000000);
    return `${months} tháng trước`;
  }

  // Years ago
  const years = Math.floor(diff / 31536000000);
  return `${years} năm trước`;
}

/**
 * Kiểm tra xem date có phải là hôm nay không (theo VN timezone)
 * @param {Date|string} date - Date object hoặc date string
 * @returns {boolean}
 */
function isToday(date) {
  const d = toVietnamTime(date);
  const today = getCurrentVietnamTime();
  return d.toDateString() === today.toDateString();
}

/**
 * Kiểm tra xem date có phải là hôm qua không (theo VN timezone)
 * @param {Date|string} date - Date object hoặc date string
 * @returns {boolean}
 */
function isYesterday(date) {
  const d = toVietnamTime(date);
  const yesterday = getCurrentVietnamTime();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.toDateString() === yesterday.toDateString();
}

/**
 * Lấy start of day theo VN timezone
 * @param {Date|string} date - Date object hoặc date string
 * @returns {Date}
 */
function getStartOfDay(date) {
  const d = toVietnamTime(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Lấy end of day theo VN timezone
 * @param {Date|string} date - Date object hoặc date string
 * @returns {Date}
 */
function getEndOfDay(date) {
  const d = toVietnamTime(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Thêm days vào date
 * @param {Date|string} date - Date object hoặc date string
 * @param {number} days - Số ngày cần thêm
 * @returns {Date}
 */
function addDays(date, days) {
  const d = toVietnamTime(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Format date cho SQL query (YYYY-MM-DD HH:mm:ss)
 * @param {Date|string} date - Date object hoặc date string
 * @returns {string}
 */
function toSQLDateTime(date) {
  const d = toVietnamTime(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Parse date string với VN timezone
 * @param {string} dateString - Date string
 * @returns {Date}
 */
function parseVietnamDate(dateString) {
  return new Date(dateString + ' GMT+0700');
}

module.exports = {
  VIETNAM_TIMEZONE,
  getCurrentVietnamTime,
  toVietnamTime,
  formatVietnamDate,
  formatVietnamDateTime,
  formatVietnamTime,
  getVietnamTimestamp,
  getRelativeTime,
  isToday,
  isYesterday,
  getStartOfDay,
  getEndOfDay,
  addDays,
  toSQLDateTime,
  parseVietnamDate,
};
