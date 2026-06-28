document.addEventListener('DOMContentLoaded', function () {
  const nameInput = document.getElementById('name');
  const mobileInput = document.getElementById('mobile_number');
  const emailInput = document.getElementById('email');
  const form = document.getElementById('feedback-form');

  const nameError = document.getElementById('name-error');
  const mobileError = document.getElementById('mobile-error');
  const emailError = document.getElementById('email-error');
  const mobileChecking = document.getElementById('mobile-checking');

  const existingSection = document.getElementById('existing-feedback-section');
  const existingTableBody = document.querySelector('#existing-feedback-table tbody');

  let lookupTimer = null;

  // ----- Mobile number: numeric-only input + live validation + lookup -----
  mobileInput.addEventListener('input', function () {
    // Strip non-digit characters as the user types
    this.value = this.value.replace(/\D/g, '').slice(0, 10);

    if (this.value.length > 0 && this.value.length < 10) {
      mobileError.textContent = 'Mobile number must be 10 digits.';
    } else {
      mobileError.textContent = '';
    }

    // Debounce the lookup call so we don't hit the server on every keystroke
    clearTimeout(lookupTimer);
    existingSection.style.display = 'none';

    if (this.value.length === 10) {
      mobileChecking.style.display = 'inline';
      lookupTimer = setTimeout(() => lookupMobile(this.value), 400);
    } else {
      mobileChecking.style.display = 'none';
    }
  });

  function lookupMobile(mobile) {
    fetch(`/api/lookup-mobile/${mobile}`)
      .then(res => res.json())
      .then(data => {
        mobileChecking.style.display = 'none';

        if (data.exists && data.entries && data.entries.length > 0) {
          existingTableBody.innerHTML = '';
          data.entries.forEach(entry => {
            const row = document.createElement('tr');
            const date = new Date(entry.submitted_at).toLocaleDateString();
            row.innerHTML = `
              <td>${date}</td>
              <td>${escapeHtml(entry.category_name || '—')}</td>
              <td>${escapeHtml(entry.model || '—')}</td>
              <td>${escapeHtml(entry.bill_number)}</td>
              <td>₹${Number(entry.amount).toFixed(2)}</td>
              <td>${entry.satisfaction_rating}/10</td>
              <td>${escapeHtml(entry.feedback_text || '—')}</td>
            `;
            existingTableBody.appendChild(row);
          });
          existingSection.style.display = 'block';
        } else {
          existingSection.style.display = 'none';
        }
      })
      .catch(() => {
        mobileChecking.style.display = 'none';
      });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ----- Name validation -----
  nameInput.addEventListener('blur', function () {
    nameError.textContent = this.value.trim().length < 2 ? 'Please enter your name.' : '';
  });

  // ----- Email validation -----
  emailInput.addEventListener('blur', function () {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    emailError.textContent = emailPattern.test(this.value) ? '' : 'Please enter a valid email address.';
  });

  // ----- Final check before submit -----
  form.addEventListener('submit', function (e) {
    let valid = true;

    if (nameInput.value.trim().length < 2) {
      nameError.textContent = 'Please enter your name.';
      valid = false;
    }
    if (!/^\d{10}$/.test(mobileInput.value)) {
      mobileError.textContent = 'Mobile number must be exactly 10 digits.';
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
      emailError.textContent = 'Please enter a valid email address.';
      valid = false;
    }

    if (!valid) {
      e.preventDefault();
    }
  });
});
