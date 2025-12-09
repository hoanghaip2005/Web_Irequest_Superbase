// Dashboard Charts using Chart.js
document.addEventListener('DOMContentLoaded', function () {
  // Chart configurations
  const chartColors = {
    blue: '#0052CC',
    green: '#36B37E',
    orange: '#FF991F',
    purple: '#6554C0',
    red: '#FF5630',
    gray: '#6B778C',
  };

  // Initialize charts
  initTrendChart();
  initStatusChart();
  initPriorityChart();

  // Trend Chart - Requests created vs completed over time
  function initTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    fetchChartData(7).then((data) => {
      const labels = data.trend.map((item) => {
        const date = new Date(item.date);
        return date.toLocaleDateString('vi-VN', {
          month: 'short',
          day: 'numeric',
        });
      });

      const createdData = data.trend.map((item) => parseInt(item.created));
      const completedData = data.trend.map((item) => parseInt(item.completed));

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
              text: 'Xu hướng yêu cầu (7 ngày qua)',
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
  function initStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    fetchChartData(30).then((data) => {
      const labels = data.status.map((item) => item.status);
      const counts = data.status.map((item) => parseInt(item.count));

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
  function initPriorityChart() {
    const ctx = document.getElementById('priorityChart');
    if (!ctx) return;

    fetchChartData(30).then((data) => {
      const labels = data.priority.map((item) => item.priority);
      const counts = data.priority.map((item) => parseInt(item.count));

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

  // Fetch chart data from API
  async function fetchChartData(days = 7) {
    try {
      const response = await fetch(`/api/dashboard/chart-data?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching chart data:', error);
      return {
        trend: [],
        status: [],
        priority: [],
      };
    }
  }

  // Auto-refresh charts every 5 minutes
  setInterval(() => {
    location.reload();
  }, 300000);
});
