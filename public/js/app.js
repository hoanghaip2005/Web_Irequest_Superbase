// iRequest Application JavaScript

// Global app object
const iRequest = {
  // Configuration
  config: {
    apiBaseUrl: '/api',
    animationDuration: 300,
  },

  // Utility functions
  utils: {
    // Show loading spinner
    showLoading() {
      const spinner = document.createElement('div');
      spinner.className = 'spinner-overlay';
      spinner.id = 'loadingSpinner';
      spinner.innerHTML = `
                <div class="spinner-border spinner-border-lg text-light" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            `;
      document.body.appendChild(spinner);
    },

    // Hide loading spinner
    hideLoading() {
      const spinner = document.getElementById('loadingSpinner');
      if (spinner) {
        spinner.remove();
      }
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 5000) {
      const toastContainer = this.getToastContainer();
      const toastId = 'toast_' + Date.now();

      const toast = document.createElement('div');
      toast.className = `toast align-items-center text-white bg-${type} border-0`;
      toast.id = toastId;
      toast.setAttribute('role', 'alert');
      toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">
                        ${this.getIconForType(type)} ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            `;

      toastContainer.appendChild(toast);

      const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: duration,
      });

      bsToast.show();

      // Remove toast element after it's hidden
      toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
      });
    },

    // Get or create toast container
    getToastContainer() {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
      }
      return container;
    },

    // Get icon for notification type
    getIconForType(type) {
      const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-exclamation-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info: '<i class="fas fa-info-circle"></i>',
      };
      return icons[type] || icons.info;
    },

    // Format date for display
    formatDate(dateString, includeTime = false) {
      const date = new Date(dateString);
      const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(includeTime && {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      return date.toLocaleDateString('vi-VN', options);
    },

    // Debounce function
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Confirm dialog
    async confirm(message, title = 'Xác nhận') {
      return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p>${message}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button>
                                <button type="button" class="btn btn-primary" id="confirmBtn">Xác nhận</button>
                            </div>
                        </div>
                    </div>
                `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);

        modal.querySelector('#confirmBtn').addEventListener('click', () => {
          resolve(true);
          bsModal.hide();
        });

        modal.addEventListener('hidden.bs.modal', () => {
          modal.remove();
          resolve(false);
        });

        bsModal.show();
      });
    },
  },

  // API functions
  api: {
    async request(url, options = {}) {
      const defaultOptions = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const config = { ...defaultOptions, ...options };

      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ message: 'Network error' }));
          throw new Error(error.message || 'Request failed');
        }

        return await response.json();
      } catch (error) {
        console.error('API Request Error:', error);
        throw error;
      }
    },

    async get(endpoint) {
      return this.request(iRequest.config.apiBaseUrl + endpoint);
    },

    async post(endpoint, data) {
      return this.request(iRequest.config.apiBaseUrl + endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async put(endpoint, data) {
      return this.request(iRequest.config.apiBaseUrl + endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async delete(endpoint) {
      return this.request(iRequest.config.apiBaseUrl + endpoint, {
        method: 'DELETE',
      });
    },
  },

  // Form helpers
  forms: {
    // Handle form submission with loading state
    handleSubmit(form, callback) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2"></span>Đang xử lý...';

        try {
          await callback(new FormData(form));
        } catch (error) {
          iRequest.utils.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      });
    },

    // Validate form field
    validateField(field, rules) {
      const value = field.value.trim();
      let isValid = true;
      let message = '';

      if (rules.required && !value) {
        isValid = false;
        message = 'Trường này là bắt buộc';
      } else if (rules.minLength && value.length < rules.minLength) {
        isValid = false;
        message = `Tối thiểu ${rules.minLength} ký tự`;
      } else if (rules.email && value && !this.isValidEmail(value)) {
        isValid = false;
        message = 'Email không hợp lệ';
      }

      this.showFieldValidation(field, isValid, message);
      return isValid;
    },

    // Show field validation result
    showFieldValidation(field, isValid, message = '') {
      const feedback =
        field.parentNode.querySelector('.invalid-feedback') ||
        field.parentNode.querySelector('.valid-feedback');

      if (feedback) {
        feedback.remove();
      }

      field.classList.remove('is-valid', 'is-invalid');

      if (message) {
        field.classList.add(isValid ? 'is-valid' : 'is-invalid');

        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = isValid ? 'valid-feedback' : 'invalid-feedback';
        feedbackDiv.textContent = message;
        field.parentNode.appendChild(feedbackDiv);
      }
    },

    // Email validation
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
  },

  // Initialize application
  init() {
    console.log('iRequest Application initialized');

    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach((tooltip) => new bootstrap.Tooltip(tooltip));

    // Initialize popovers
    const popovers = document.querySelectorAll('[data-bs-toggle="popover"]');
    popovers.forEach((popover) => new bootstrap.Popover(popover));

    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert:not(.alert-permanent)');
    alerts.forEach((alert) => {
      setTimeout(() => {
        if (alert.parentNode) {
          alert.classList.add('fade');
          setTimeout(() => alert.remove(), 300);
        }
      }, 5000);
    });

    // Handle AJAX form submissions
    const ajaxForms = document.querySelectorAll('[data-ajax="true"]');
    ajaxForms.forEach((form) => {
      this.forms.handleSubmit(form, async (formData) => {
        const url = form.action || window.location.href;
        const method = form.method || 'POST';

        const response = await fetch(url, {
          method,
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          this.utils.showToast(result.message || 'Thành công!', 'success');

          // Redirect if specified
          if (result.redirectUrl) {
            window.location.href = result.redirectUrl;
          }
        } else {
          const error = await response.json();
          throw new Error(error.message || 'Có lỗi xảy ra');
        }
      });
    });

    // Search functionality
    const searchInputs = document.querySelectorAll('[data-search="true"]');
    searchInputs.forEach((input) => {
      const debouncedSearch = this.utils.debounce((value) => {
        this.handleSearch(input, value);
      }, 300);

      input.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
      });
    });
  },

  // Handle search functionality
  async handleSearch(input, query) {
    const target = input.dataset.searchTarget;
    if (!target) return;

    try {
      const response = await this.api.get(
        `/search?q=${encodeURIComponent(query)}&target=${target}`
      );
      this.renderSearchResults(target, response.results);
    } catch (error) {
      console.error('Search error:', error);
    }
  },

  // Render search results
  renderSearchResults(target, results) {
    const container = document.getElementById(target);
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <p class="text-muted">Không tìm thấy kết quả nào</p>
                </div>
            `;
      return;
    }

    // This would be customized based on the specific search target
    container.innerHTML = results
      .map(
        (item) => `
            <div class="card mb-2">
                <div class="card-body">
                    <h6 class="card-title">${item.title}</h6>
                    <p class="card-text">${item.description || ''}</p>
                </div>
            </div>
        `
      )
      .join('');
  },
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  iRequest.init();
});

// Make iRequest available globally
window.iRequest = iRequest;
