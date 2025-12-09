// Analytics Charts and Interactions
document.addEventListener('DOMContentLoaded', function () {
  const chartColors = {
    blue: '#0052CC',
    green: '#36B37E',
    orange: '#FF991F',
    purple: '#6554C0',
    red: '#FF5630',
    gray: '#6B778C',
  };

  // Get period from URL or default to month
  const urlParams = new URLSearchParams(window.location.search);
  let currentPeriod = urlParams.get('period') || 'month';

  // Initialize all charts
  initAllCharts(currentPeriod);

  // Period filter change handler
  const periodFilter = document.getElementById('periodFilter');
  if (periodFilter) {
    periodFilter.value = currentPeriod;
    periodFilter.addEventListener('change', function () {
      currentPeriod = this.value;
      window.location.href = `/analytics?period=${currentPeriod}`;
    });
  }

  // Export buttons
  const exportExcelBtn = document.getElementById('exportExcel');
  const exportPdfBtn = document.getElementById('exportPdf');

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', function () {
      window.location.href = `/analytics/export/excel?period=${currentPeriod}`;
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', function () {
      window.location.href = `/analytics/export/pdf?period=${currentPeriod}`;
    });
  }

  // Initialize all charts
  function initAllCharts(period) {
    initTrendChart(period);
    initStatusChart(period);
    initPriorityChart(period);
    initDepartmentChart(period);
  }

  // Trend Chart
  function initTrendChart(period) {
    const ctx = document.getElementById('analyticsTrendChart');
    if (!ctx) return;

    fetchChartData('trend', period).then((data) => {
      if (!data || !data.data) return;

      const labels = data.data.map((item) => {
        const date = new Date(item.date);
        return date.toLocaleDateString('vi-VN', {
          month: 'short',
          day: 'numeric',
        });
      });

      const createdData = data.data.map((item) => parseInt(item.created));
      const completedData = data.data.map((item) => parseInt(item.completed));

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Yêu cầu tạo mới',
              data: createdData,
              borderColor: chartColors.blue,
              backgroundColor: chartColors.blue + '20',
              fill: true,
              tension: 0.4,
            },
            {
              label: 'Yêu cầu hoàn thành',
              data: completedData,
              borderColor: chartColors.green,
              backgroundColor: chartColors.green + '20',
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Xu hướng yêu cầu theo thời gian',
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
              },
            },
          },
        },
      });
    });
  }

  // Status Distribution Chart
  function initStatusChart(period) {
    const ctx = document.getElementById('analyticsStatusChart');
    if (!ctx) return;

    fetchChartData('status', period).then((data) => {
      if (!data || !data.data) return;

      const labels = data.data.map((item) => item.status);
      const counts = data.data.map((item) => parseInt(item.count));

      const backgroundColors = [
        chartColors.blue,
        chartColors.green,
        chartColors.orange,
        chartColors.purple,
        chartColors.red,
        chartColors.gray,
      ];

      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [
            {
              data: counts,
              backgroundColor: backgroundColors.slice(0, labels.length),
              borderWidth: 2,
              borderColor: '#fff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Phân bố theo trạng thái',
            },
          },
        },
      });
    });
  }

  // Priority Distribution Chart
  function initPriorityChart(period) {
    const ctx = document.getElementById('analyticsPriorityChart');
    if (!ctx) return;

    fetchChartData('priority', period).then((data) => {
      if (!data || !data.data) return;

      const labels = data.data.map((item) => item.priority);
      const counts = data.data.map((item) => parseInt(item.count));

      const backgroundColors = labels.map((label) => {
        switch (label) {
          case 'Cao':
            return chartColors.red;
          case 'Trung bình':
            return chartColors.orange;
          case 'Thấp':
            return chartColors.green;
          default:
            return chartColors.gray;
        }
      });

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Số lượng',
              data: counts,
              backgroundColor: backgroundColors,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: 'Phân bố theo mức độ ưu tiên',
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
              },
            },
          },
        },
      });
    });
  }

  // Department Distribution Chart
  function initDepartmentChart(period) {
    const ctx = document.getElementById('analyticsDepartmentChart');
    if (!ctx) return;

    fetchChartData('department', period).then((data) => {
      if (!data || !data.data) return;

      const labels = data.data.map((item) => item.department);
      const counts = data.data.map((item) => parseInt(item.count));

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Số lượng yêu cầu',
              data: counts,
              backgroundColor: chartColors.purple,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: true,
              text: 'Phân bố theo phòng ban',
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
              },
            },
          },
        },
      });
    });
  }

  // Fetch chart data from API
  async function fetchChartData(type, period) {
    try {
      const response = await fetch(
        `/analytics/api/chart-data?type=${type}&period=${period}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching chart data:', error);
      return null;
    }
  }
});
