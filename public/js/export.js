/**
 * Export utilities for iRequest System
 * Handles Excel and PDF export functionality
 */

/**
 * Export data to Excel
 * @param {string} view - View type: 'all', 'my', or 'assigned'
 * @param {Object} filters - Filter parameters (status, priority, workflow, search)
 */
function exportToExcel(view = 'all', filters = {}) {
  try {
    // Show loading toast
    showToast('Đang chuẩn bị file Excel...', 'info');

    // Build query params
    const params = new URLSearchParams();
    params.append('view', view);

    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.workflow) params.append('workflow', filters.workflow);
    if (filters.search) params.append('search', filters.search);

    // Create download URL
    const url = `/requests/export/excel?${params.toString()}`;

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `yeu-cau-${view}-${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Success message
    setTimeout(() => {
      showToast('Xuất Excel thành công!', 'success');
    }, 500);
  } catch (error) {
    console.error('Export Excel error:', error);
    showToast('Lỗi khi xuất Excel: ' + error.message, 'error');
  }
}

/**
 * Export data to PDF
 * @param {string} view - View type: 'all', 'my', or 'assigned'
 * @param {Object} filters - Filter parameters (status, priority, workflow, search)
 */
function exportToPDF(view = 'all', filters = {}) {
  try {
    // Show loading toast
    showToast('Đang chuẩn bị file PDF...', 'info');

    // Build query params
    const params = new URLSearchParams();
    params.append('view', view);

    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.workflow) params.append('workflow', filters.workflow);
    if (filters.search) params.append('search', filters.search);

    // Create download URL
    const url = `/requests/export/pdf?${params.toString()}`;

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `yeu-cau-${view}-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Success message
    setTimeout(() => {
      showToast('Xuất PDF thành công!', 'success');
    }, 500);
  } catch (error) {
    console.error('Export PDF error:', error);
    showToast('Lỗi khi xuất PDF: ' + error.message, 'error');
  }
}

/**
 * Print current page with custom styling
 */
function printRequests() {
  try {
    // Add print-specific styles
    const printStyles = `
      @media print {
        /* Hide unnecessary elements */
        .table-filter-bar,
        .table-actions,
        .content-actions,
        .table-action-btn,
        .table-checkbox,
        nav,
        .sidebar,
        footer {
          display: none !important;
        }

        /* Optimize table for print */
        .modern-table {
          font-size: 10pt;
        }

        .modern-table th,
        .modern-table td {
          padding: 4px 6px !important;
        }

        /* Page breaks */
        tr {
          page-break-inside: avoid;
        }

        /* Print header */
        body::before {
          content: "DANH SÁCH YÊU CẦU - " attr(data-print-date);
          display: block;
          text-align: center;
          font-size: 16pt;
          font-weight: bold;
          margin-bottom: 20px;
        }
      }
    `;

    // Add print date to body
    document.body.setAttribute(
      'data-print-date',
      new Date().toLocaleString('vi-VN')
    );

    // Inject print styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = printStyles;
    document.head.appendChild(styleSheet);

    // Trigger print
    window.print();

    // Remove print styles after printing
    setTimeout(() => {
      document.head.removeChild(styleSheet);
      document.body.removeAttribute('data-print-date');
    }, 1000);
  } catch (error) {
    console.error('Print error:', error);
    showToast('Lỗi khi in: ' + error.message, 'error');
  }
}

/**
 * Get current filter values from page
 * @returns {Object} Filter object with current values
 */
function getCurrentFilters() {
  const filters = {};

  const statusFilter = document.getElementById('statusFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const workflowFilter = document.getElementById('workflowFilter');
  const searchInput = document.getElementById('tableSearch');

  if (statusFilter && statusFilter.value) {
    filters.status = statusFilter.value;
  }

  if (priorityFilter && priorityFilter.value) {
    filters.priority = priorityFilter.value;
  }

  if (workflowFilter && workflowFilter.value) {
    filters.workflow = workflowFilter.value;
  }

  if (searchInput && searchInput.value.trim()) {
    filters.search = searchInput.value.trim();
  }

  return filters;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'info', 'warning'
 */
function showToast(message, type = 'info') {
  // Try to use existing toast function if available
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }

  // Fallback: Create simple toast
  const toast = document.createElement('div');
  toast.className = `alert alert-${type === 'error' ? 'danger' : type} position-fixed top-0 end-0 m-3`;
  toast.style.zIndex = '9999';
  toast.style.minWidth = '300px';
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    exportToExcel,
    exportToPDF,
    printRequests,
    getCurrentFilters,
  };
}
