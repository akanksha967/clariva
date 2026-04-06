import { getApiBase } from './config.js';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showBookDemoSuccess(btn, originalLabel) {
  btn.textContent = "Thanks — we'll be in touch";
  btn.style.cssText =
    'background:#2d7a4f;border-color:#2d7a4f;color:white;cursor:default;' +
    'padding:15px 26px;font-size:12px;letter-spacing:.1em;';

  setTimeout(() => {
    btn.textContent = originalLabel;
    btn.style.cssText = '';
  }, 5000);
}

async function submitLeadToApi(email, clinic_name) {
  const base = getApiBase();
  const url = `${base}/api/book-demo`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, clinic_name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function initForm() {
  const form = document.getElementById('bookDemoForm');
  const btn = document.getElementById('ctaBtn');
  const emailInput = document.getElementById('emailInput');
  const clinicInput = document.getElementById('clinicNameInput');

  if (!form || !btn || !emailInput || !clinicInput) return;

  const defaultBtnLabel = btn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const email = emailInput.value.trim();
    const clinic_name = clinicInput.value.trim();

    if (!clinic_name) {
      alert('Please enter your practice name.');
      clinicInput.focus();
      return;
    }

    if (!email) {
      alert('Please enter your email address.');
      emailInput.focus();
      return;
    }

    if (!isValidEmail(email)) {
      alert('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await submitLeadToApi(email, clinic_name);
      showBookDemoSuccess(btn, defaultBtnLabel);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[Clariva] Book demo failed:', detail, err);
      alert(detail);
      btn.textContent = defaultBtnLabel;
    } finally {
      btn.disabled = false;
    }
  });
}
