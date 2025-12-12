/**
 * ==========================================
 * NOTIFICATIONS MANAGEMENT
 * ==========================================
 */

// Global state
let notificationsData = [];
let unreadCount = 0;

/**
 * Initialize notifications on page load
 */
document.addEventListener('DOMContentLoaded', function () {
  console.log('🔔 Notifications system initializing...');
  loadNotifications();

  // Auto-refresh every 30 seconds
  setInterval(loadNotifications, 30000);
});

/**
 * Load notifications from server
 */
async function loadNotifications(silent = false) {
  try {
    if (!silent) {
      showNotificationsLoading();
    }

    const response = await fetch('/api/notifications/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📬 Notifications loaded:', data);

    notificationsData = data.notifications || [];
    unreadCount = data.unreadCount || 0;

    updateNotificationsBadge();
    renderNotifications();
  } catch (error) {
    console.error('❌ Error loading notifications:', error);
    if (!silent) {
      showNotificationsError();
    }
  }
}

/**
 * Render notifications list
 */
function renderNotifications() {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  // Show empty state if no notifications
  if (notificationsData.length === 0) {
    container.innerHTML = `
            <div class="notifications-empty">
                <i class="fas fa-bell-slash"></i>
                <h6>Không có thông báo</h6>
                <p>Bạn đã xem tất cả thông báo</p>
            </div>
        `;
    return;
  }

  // Render each notification
  notificationsData.forEach((notification) => {
    const item = createNotificationItem(notification);
    container.appendChild(item);
  });
}

/**
 * Create notification item element
 */
function createNotificationItem(notification) {
  const div = document.createElement('a');
  div.className = `notification-item ${notification.IsRead ? '' : 'unread'}`;
  div.href = notification.Link || '#';
  div.onclick = (e) => handleNotificationClick(e, notification);

  // Determine icon and color based on type
  const iconConfig = getNotificationIcon(notification.Type);

  div.innerHTML = `
        <div class="notification-icon-wrapper ${iconConfig.color}">
            <i class="${iconConfig.icon}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${escapeHtml(notification.Title)}</div>
            <div class="notification-message">${escapeHtml(notification.Content)}</div>
            <div class="notification-time">
                <i class="far fa-clock"></i>
                ${formatNotificationTime(notification.CreatedAt)}
            </div>
        </div>
    `;

  return div;
}

/**
 * Get icon configuration based on notification type
 */
function getNotificationIcon(type) {
  const icons = {
    request: { icon: 'fas fa-file-alt', color: 'info' },
    comment: { icon: 'fas fa-comment', color: 'info' },
    approval: { icon: 'fas fa-check-circle', color: 'success' },
    rejection: { icon: 'fas fa-times-circle', color: 'danger' },
    assignment: { icon: 'fas fa-user-tag', color: 'warning' },
    mention: { icon: 'fas fa-at', color: 'info' },
    system: { icon: 'fas fa-cog', color: 'warning' },
    default: { icon: 'fas fa-bell', color: 'info' },
  };

  return icons[type] || icons['default'];
}

/**
 * Format notification time
 */
function formatNotificationTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now - time) / 1000); // seconds

  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;

  // Format as date if older than a week
  return time.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Handle notification click
 */
async function handleNotificationClick(event, notification) {
  event.preventDefault();

  // Mark as read if unread
  if (!notification.IsRead) {
    await markNotificationAsRead(notification.Id);
  }

  // Navigate to link
  if (notification.Link) {
    window.location.href = notification.Link;
  }
}

/**
 * Mark single notification as read
 */
async function markNotificationAsRead(notificationId) {
  try {
    const response = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log(`✅ Notification ${notificationId} marked as read`);

    // Update local state
    const notification = notificationsData.find((n) => n.Id === notificationId);
    if (notification) {
      notification.IsRead = true;
      unreadCount = Math.max(0, unreadCount - 1);
      updateNotificationsBadge();
      renderNotifications();
    }
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
  }
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(event) {
  // Prevent default only if event exists (when called from event listener)
  if (event && event.preventDefault) {
    event.preventDefault();
  }

  if (unreadCount === 0) {
    showToast('Không có thông báo chưa đọc', 'info');
    return;
  }

  // Confirm before marking all
  if (!confirm(`Đánh dấu tất cả ${unreadCount} thông báo là đã đọc?`)) {
    return;
  }

  try {
    const response = await fetch('/notifications/mark-all-read', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ All notifications marked as read:', data);

    // Update local state for dropdown
    notificationsData.forEach((n) => (n.IsRead = true));
    unreadCount = 0;
    updateNotificationsBadge();
    renderNotifications();

    // Update table UI if on notifications page
    if (window.location.pathname === '/notifications') {
      // Update all unread rows in table
      const unreadRows = document.querySelectorAll('.table-row-unread');
      unreadRows.forEach((row) => {
        // Remove unread styling
        row.classList.remove('table-row-unread');

        // Update status badge
        const statusCell = row.querySelector('td:nth-child(5)');
        if (statusCell) {
          statusCell.innerHTML = `
            <span class="table-status-badge status-success">
              <i class="fas fa-check"></i>
              Đã đọc
            </span>
          `;
        }

        // Remove "mark as read" button
        const markButton = row.querySelector('button[onclick*="markAsRead"]');
        if (markButton) {
          markButton.remove();
        }
      });

      // Update stats if exists
      const unreadStat = document.querySelector(
        '.card-body .fs-5.fw-bold.text-warning'
      );
      if (unreadStat) {
        unreadStat.textContent = '0';
      }
    }

    // Show success feedback
    showToast(data.message || 'Đã đánh dấu tất cả là đã đọc', 'success');
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    showToast('Có lỗi xảy ra', 'danger');
  }
}

/**
 * Update notification badge count
 */
function updateNotificationsBadge() {
  const badge = document.querySelector('.notification-badge');
  if (!badge) return;

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Show loading state
 */
function showNotificationsLoading() {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  container.innerHTML = `
        <div class="notification-loading text-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Đang tải...</span>
            </div>
            <p class="mt-2 text-muted small mb-0">Đang tải thông báo...</p>
        </div>
    `;
}

/**
 * Show error state
 */
function showNotificationsError() {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  container.innerHTML = `
        <div class="notifications-empty">
            <i class="fas fa-exclamation-triangle text-warning"></i>
            <h6>Không thể tải thông báo</h6>
            <p>Vui lòng thử lại sau</p>
            <button class="btn btn-sm btn-primary mt-2" onclick="loadNotifications()">
                <i class="fas fa-redo"></i> Thử lại
            </button>
        </div>
    `;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }

  // Create toast
  const toastId = `toast-${Date.now()}`;
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `toast align-items-center text-bg-${type} border-0`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

  toastContainer.appendChild(toast);

  // Show toast
  const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
  bsToast.show();

  // Remove after hidden
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle dropdown show event
 */
document.addEventListener('shown.bs.dropdown', function (event) {
  const dropdown = event.target.closest('.notifications-dropdown');
  if (dropdown) {
    console.log('🔔 Notifications dropdown opened');
    // Refresh notifications when dropdown opens
    loadNotifications(true);
  }
});

// Export functions for global access
window.markAllAsRead = markAllAsRead;
window.loadNotifications = loadNotifications;
