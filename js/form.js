import emailjs from 'https://esm.sh/@emailjs/browser@4.4.1';

/** Where your team receives new demo leads (must match the “To” field in EmailJS team template). */
const TEAM_INBOX = 'hello@clariva.ai';

/**
 * EmailJS — https://www.emailjs.com/
 *
 * Team template: To = fixed inbox (e.g. hello@clariva.ai).
 * Visitor template: the “To email” field MUST be a variable, e.g. {{user_email}} or {{to_email}}
 *   (if it is blank or static, EmailJS returns 422 “recipients address is empty”).
 * Variables sent: user_email, to_email, email (same value), clinic_name, …
 *
 * Account → Security: allow your domain (and http://localhost for local testing).
 */
const EMAILJS = {
  publicKey: '7Tyhp7REciU6WR6Gf',
  serviceId: 'service_7junsyc',
  templateTeam: 'template_hru8of6',
  templateVisitor: 'template_q6w3tid',
};

function isEmailJsConfigured() {
  return Boolean(
    EMAILJS.publicKey &&
    EMAILJS.serviceId &&
    EMAILJS.templateTeam &&
    EMAILJS.templateVisitor
  );
}

/** Pass on every send — works even if init() runs late or fails silently. */
function emailJsOptions() {
  return { publicKey: EMAILJS.publicKey };
}

/**
 * EmailJS errors are often `{ status, text }`. Surfaces the real API message in the console.
 */
function formatEmailJsError(err) {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  const text = err.text ?? err.message;
  const status = err.status != null ? ` [${err.status}]` : '';
  if (text) return `${text}${status}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Sends (1) notification to TEAM_INBOX and (2) confirmation to the visitor.
 */
async function sendLeadEmails(userEmail, clinicName) {
  const opts = emailJsOptions();
  const teamParams = {
    team_email: TEAM_INBOX,
    user_email: userEmail,
    clinic_name: clinicName,
    reply_to: userEmail,
  };
  const visitorParams = {
    user_email: userEmail,
    to_email: userEmail,
    email: userEmail,
    clinic_name: clinicName,
  };

  try {
    const r1 = await emailjs.send(
      EMAILJS.serviceId,
      EMAILJS.templateTeam,
      teamParams,
      opts
    );
    console.log('[Clariva] EmailJS team template OK:', r1);
  } catch (err) {
    console.error('[Clariva] EmailJS team template failed:', err);
    throw new Error(`Team notification: ${formatEmailJsError(err)}`);
  }

  try {
    const r2 = await emailjs.send(
      EMAILJS.serviceId,
      EMAILJS.templateVisitor,
      visitorParams,
      opts
    );
    console.log('[Clariva] EmailJS visitor template OK:', r2);
  } catch (err) {
    console.error('[Clariva] EmailJS visitor template failed:', err);
    throw new Error(`Visitor confirmation: ${formatEmailJsError(err)}`);
  }
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

export function initForm() {
  const form = document.getElementById('bookDemoForm');
  const btn = document.getElementById('ctaBtn');
  const emailInput = document.getElementById('emailInput');
  const clinicInput = document.getElementById('clinicInput');

  if (!form || !btn || !emailInput) return;

  const defaultBtnLabel = btn.textContent;

  if (isEmailJsConfigured()) {
    emailjs.init({ publicKey: EMAILJS.publicKey });
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

    if (!isEmailJsConfigured()) {
      alert(
        'Email booking is not configured. Contact us at ' +
          TEAM_INBOX +
          ' or use the voice demo button above.'
      );
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      await sendLeadEmails(email, clinic);
      trackDemoRequest(email, clinic);
      showBookDemoSuccess(btn, defaultBtnLabel);
    } catch (err) {
      const detail = err instanceof Error ? err.message : formatEmailJsError(err);
      console.error('[Clariva] Book demo email failed:', detail, err);
      btn.textContent = defaultBtnLabel;
    } finally {
      btn.disabled = false;
    }
  });
}
