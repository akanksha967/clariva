import { startCall } from './vapi.js';

const DEMO_EMAIL = 'hello@clariva.ai';

/**
 * Validates that the supplied string is a well-formed email address.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Updates the CTA button to a "success" state.
 */
function showSuccess(btn, input, clinicInput) {
  const originalText = btn.textContent;
  btn.textContent = 'Voice Demo Starting...';
  btn.style.cssText =
    'background:#2d7a4f;border-color:#2d7a4f;color:white;cursor:default;' +
    'padding:15px 26px;font-size:12px;letter-spacing:.1em;';

  // Reset after a bit but keep the state
  setTimeout(() => {
    btn.textContent = 'Demo in Progress';
  }, 2000);
}

/**
 * Tracks the demo request (placeholder for CRM/API).
 */
function trackDemoRequest(email, clinic) {
  console.log('[Clariva] Demo Lead Captured:', { email, clinic, timestamp: new Date().toISOString() });
  // In a real app, you would POST this to /api/leads
}

export function initForm() {
  const btn = document.getElementById('ctaBtn');
  const emailInput = document.getElementById('emailInput');
  const clinicInput = document.getElementById('clinicInput');

  if (!btn || !emailInput) return;

  btn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const clinic = clinicInput ? clinicInput.value.trim() : '';

    if (!clinic) {
      alert('Please enter your clinic name.');
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

    // 1. Start the dynamic voice demo immediately
    console.log(`[Clariva] Starting dynamic demo for: ${clinic}`);
    startCall(clinic);

    // 2. Track the lead without disrupting the session
    trackDemoRequest(email, clinic);

    // 3. Update UI state
    showSuccess(btn, emailInput, clinicInput);
  });
}
