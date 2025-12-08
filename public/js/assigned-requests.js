// Assigned Requests JavaScript Functions

document.addEventListener('DOMContentLoaded', function () {
  // Initialize tooltips
  var tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize modals
  window.approveModal = new bootstrap.Modal(
    document.getElementById('approveModal')
  );
  window.rejectModal = new bootstrap.Modal(
    document.getElementById('rejectModal')
  );

  // Auto-refresh every 30 seconds
  setInterval(function () {
    if (!document.hidden) {
      refreshStats();
    }
  }, 30000);
});

// Show approve modal
function showApproveModal(requestId, title) {
  document.getElementById('approveRequestId').value = requestId;
  document.getElementById('approveTitle').textContent = title;
  window.approveModal.show();
}

// Show reject modal
function showRejectModal(requestId, title) {
  document.getElementById('rejectRequestId').value = requestId;
  document.getElementById('rejectTitle').textContent = title;
  window.rejectModal.show();
}

// Start processing request
async function startProcessing(requestId) {
  if (!confirm('Bắt đầu xử lý yêu cầu này?')) return;

  try {
    const button = document.querySelector(`button[onclick*="${requestId}"]`);
    button.disabled = true;
    button.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i>Đang xử lý...';

    const response = await fetch(`/requests/${requestId}/start-processing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.success) {
      showAlert('success', 'Đã bắt đầu xử lý yêu cầu thành công!');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showAlert('danger', data.error || 'Có lỗi xảy ra khi bắt đầu xử lý');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('danger', 'Có lỗi xảy ra. Vui lòng thử lại.');
  }
}

// Handle approve form submission
document
  .getElementById('approveForm')
  .addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const requestId = formData.get('requestId');
    const comment = formData.get('comment');

    try {
      const response = await fetch(`/requests/${requestId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      });

      const data = await response.json();

      if (data.success) {
        window.approveModal.hide();
        showAlert('success', 'Yêu cầu đã được phê duyệt thành công!');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showAlert('danger', data.error || 'Có lỗi xảy ra khi phê duyệt');
      }
    } catch (error) {
      console.error('Error:', error);
      showAlert('danger', 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  });

// Handle reject form submission
document
  .getElementById('rejectForm')
  .addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const requestId = formData.get('requestId');
    const reason = formData.get('reason');

    if (!reason.trim()) {
      showAlert('warning', 'Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      const response = await fetch(`/requests/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (data.success) {
        window.rejectModal.hide();
        showAlert('success', 'Yêu cầu đã được từ chối!');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showAlert('danger', data.error || 'Có lỗi xảy ra khi từ chối');
      }
    } catch (error) {
      console.error('Error:', error);
      showAlert('danger', 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  });

// Show alert messages
function showAlert(type, message) {
  const alertContainer = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show`;
  alert.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  alertContainer.appendChild(alert);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (alert.parentNode) {
      alert.remove();
    }
  }, 5000);
}

// Refresh statistics
async function refreshStats() {
  try {
    const response = await fetch('/requests/assigned-stats');
    const data = await response.json();

    if (data.success) {
      document.getElementById('totalCount').textContent = data.stats.total || 0;
      document.getElementById('pendingCount').textContent =
        data.stats.pending || 0;
      document.getElementById('processingCount').textContent =
        data.stats.processing || 0;
      document.getElementById('completedTodayCount').textContent =
        data.stats.completedToday || 0;
    }
  } catch (error) {
    console.error('Error refreshing stats:', error);
  }
}

// Filter functions
function applyFilters() {
  const form = document.getElementById('filterForm');
  const formData = new FormData(form);
  const params = new URLSearchParams();

  for (let [key, value] of formData.entries()) {
    if (value) params.append(key, value);
  }

  window.location.search = params.toString();
}

function clearFilters() {
  window.location.href = '/requests/assigned';
}

// Mark all as viewed (for notifications)
function markAllAsViewed() {
  fetch('/notifications/mark-all-read', { method: 'PUT' })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showAlert('success', 'Đã đánh dấu tất cả thông báo là đã xem');
      }
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

// Export functions
function exportToExcel() {
  const params = new URLSearchParams(window.location.search);
  params.append('export', 'excel');
  window.open(`/requests/assigned?${params.toString()}`, '_blank');
}

function exportToPDF() {
  const params = new URLSearchParams(window.location.search);
  params.append('export', 'pdf');
  window.open(`/requests/assigned?${params.toString()}`, '_blank');
}

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  // Ctrl/Cmd + R = Refresh
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    window.location.reload();
  }

  // Ctrl/Cmd + F = Focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput) {
      searchInput.focus();
    }
  }
});
