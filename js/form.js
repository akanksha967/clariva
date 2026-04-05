import { resolveBookingUrl, resolveBookingUrlForPage, clinics } from './clinics.js';
import { getApiBase } from './config.js';

function clinicIdFromPracticeName(name) {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  const found = Object.values(clinics).find((c) => c.clinic_name.toLowerCase() === n);
  return found ? found.clinicId : null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showBookDemoSuccess(btn, originalLabel) {
  btn.textContent = 'Thanks — check your email';
  btn.style.cssText =
    'background:#2d7a4f;border-color:#2d7a4f;color:white;cursor:default;' +
    'padding:15px 26px;font-size:12px;letter-spacing:.1em;';

  setTimeout(() => {
    btn.textContent = originalLabel;
    btn.style.cssText = '';
  }, 5000);
}

function trackDemoRequest(email, clinic) {
  console.log('[Clariva] Demo Lead Captured:', { email, clinic, timestamp: new Date().toISOString() });
}

async function submitLeadToApi(email, clinicName) {
  const base = getApiBase();
  if (!base) {
    throw new Error(
      'API not configured: set window.CLARIVA_API_BASE to your Clariva API origin (see index.html).'
    );
  }
  const booking_url = resolveBookingUrl(clinicName);
  const clinic_id = clinicIdFromPracticeName(clinicName);
  const res = await fetch(`${base}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      clinic_name: clinicName,
      clinic_id,
      booking_url,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Lead save failed (${res.status})`);
  }
  return data;
}

export function initForm() {
  const form = document.getElementById('bookDemoForm');
  const btn = document.getElementById('ctaBtn');
  const emailInput = document.getElementById('emailInput');
  const clinicInput = document.getElementById('clinicInput');

  if (!form || !btn || !emailInput) return;

  const defaultBtnLabel = btn.textContent;

  const calLink = document.getElementById('calcomLink');
  if (calLink) {
    calLink.href = resolveBookingUrlForPage();
  }

  /** Email booking only — never starts the Vapi voice demo (that is `#vapiDemoBtn` in vapi.js). */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const email = emailInput.value.trim();
    const clinic = clinicInput ? clinicInput.value.trim() : '';

    if (!clinic) {
      alert('Please enter your practice name.');
      if (clinicInput) clinicInput.focus();
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
      await submitLeadToApi(email, clinic);
      trackDemoRequest(email, clinic);
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
