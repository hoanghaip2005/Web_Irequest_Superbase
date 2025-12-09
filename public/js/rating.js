// Star Rating Component and Functionality
document.addEventListener('DOMContentLoaded', function () {
  // Initialize all rating components
  initRatingStars();
  initRatingForm();

  function initRatingStars() {
    const ratingContainers = document.querySelectorAll('.star-rating');

    ratingContainers.forEach((container) => {
      const stars = container.querySelectorAll('.star');
      const input = container.querySelector('input[type="hidden"]');
      const isReadOnly = container.classList.contains('read-only');

      if (isReadOnly) return;

      stars.forEach((star, index) => {
        // Hover effect
        star.addEventListener('mouseenter', function () {
          highlightStars(stars, index);
        });

        // Click to select
        star.addEventListener('click', function () {
          const rating = index + 1;
          if (input) {
            input.value = rating;
          }
          selectStars(stars, index);
          container.setAttribute('data-rating', rating);
        });
      });

      // Reset on mouse leave
      container.addEventListener('mouseleave', function () {
        const currentRating =
          parseInt(container.getAttribute('data-rating')) || 0;
        if (currentRating > 0) {
          selectStars(stars, currentRating - 1);
        } else {
          resetStars(stars);
        }
      });
    });
  }

  function highlightStars(stars, index) {
    stars.forEach((star, i) => {
      if (i <= index) {
        star.classList.add('hover');
      } else {
        star.classList.remove('hover');
      }
    });
  }

  function selectStars(stars, index) {
    stars.forEach((star, i) => {
      if (i <= index) {
        star.classList.add('selected');
        star.classList.remove('hover');
      } else {
        star.classList.remove('selected', 'hover');
      }
    });
  }

  function resetStars(stars) {
    stars.forEach((star) => {
      star.classList.remove('selected', 'hover');
    });
  }

  function initRatingForm() {
    const ratingForm = document.getElementById('ratingForm');
    if (!ratingForm) return;

    ratingForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());

      // Validation
      if (!data.overallRating || data.overallRating === '0') {
        alert('Vui lòng đánh giá số sao');
        return;
      }

      try {
        const requestId = this.getAttribute('data-request-id');
        const response = await fetch(`/requests/${requestId}/rate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
          // Close modal
          const modal = bootstrap.Modal.getInstance(
            document.getElementById('ratingModal')
          );
          if (modal) modal.hide();

          // Show success message
          alert('Cảm ơn bạn đã đánh giá!');

          // Reload page to show rating
          window.location.reload();
        } else {
          alert(result.error || 'Có lỗi xảy ra khi đánh giá');
        }
      } catch (error) {
        console.error('Rating submission error:', error);
        alert('Không thể gửi đánh giá. Vui lòng thử lại');
      }
    });
  }

  // Open rating modal
  window.openRatingModal = function (requestId) {
    const modal = new bootstrap.Modal(document.getElementById('ratingModal'));
    const form = document.getElementById('ratingForm');
    if (form) {
      form.setAttribute('data-request-id', requestId);
      form.reset();
      // Reset stars
      const stars = form.querySelectorAll('.star');
      stars.forEach((star) => star.classList.remove('selected', 'hover'));
    }
    modal.show();
  };
});
