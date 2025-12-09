// Reports page interactions
document.addEventListener('DOMContentLoaded', function () {
  // Export buttons
  const exportExcelBtn = document.getElementById('exportExcelReport');
  const exportPdfBtn = document.getElementById('exportPdfReport');

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', function () {
      const params = new URLSearchParams(window.location.search);
      window.location.href = `/reports/export/excel?${params.toString()}`;
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', function () {
      const params = new URLSearchParams(window.location.search);
      window.location.href = `/reports/export/pdf?${params.toString()}`;
    });
  }

  // Date range picker
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');

  if (startDateInput && endDateInput) {
    // Set max date to today
    const today = new Date().toISOString().split('T')[0];
    endDateInput.setAttribute('max', today);

    // Validate date range
    startDateInput.addEventListener('change', function () {
      endDateInput.setAttribute('min', this.value);
    });

    endDateInput.addEventListener('change', function () {
      if (startDateInput.value && this.value < startDateInput.value) {
        alert('Ngày kết thúc phải sau ngày bắt đầu');
        this.value = '';
      }
    });
  }

  // Filter form submission
  const filterForm = document.getElementById('reportFilterForm');
  if (filterForm) {
    filterForm.addEventListener('submit', function (e) {
      // Remove empty inputs before submit
      const inputs = this.querySelectorAll('input, select');
      inputs.forEach((input) => {
        if (!input.value) {
          input.removeAttribute('name');
        }
      });
    });
  }

  // Clear filters button
  const clearFiltersBtn = document.getElementById('clearFilters');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function () {
      window.location.href = '/reports';
    });
  }
});
