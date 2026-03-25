import emailjs from 'https://esm.sh/@emailjs/browser@4.4.1';

/** Where your team receives new demo leads (must match the “To” field in EmailJS team template). */
const TEAM_INBOX = 'hello@clariva.ai';

/**
 * EmailJS — https://www.emailjs.com/
 *
 * Team template: To = fixed inbox. Visitor template: To = {{user_email}}
 * Variables sent: user_email, clinic_name, reply_to (team only), team_email (team only)
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

/**
 * Sends (1) notification to TEAM_INBOX and (2) confirmation to the visitor.
 */
async function sendLeadEmails(userEmail, clinicName) {
  await emailjs.send(
    EMAILJS.serviceId,
    EMAILJS.templateTeam,
    {
      team_email: TEAM_INBOX,
      user_email: userEmail,
      clinic_name: clinicName,
      reply_to: userEmail,
    }
  );

  await emailjs.send(
    EMAILJS.serviceId,
    EMAILJS.templateVisitor,
    {
      user_email: userEmail,
      clinic_name: clinicName,
    }
  );
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
  const btn = document.getElementById('ctaBtn');
  const emailInput = document.getElementById('emailInput');
  const clinicInput = document.getElementById('clinicInput');

  if (!btn || !emailInput) return;

  const defaultBtnLabel = btn.textContent;

  if (isEmailJsConfigured()) {
    emailjs.init({ publicKey: EMAILJS.publicKey });
  }

  btn.addEventListener('click', async () => {
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
      console.error('[Clariva] Book demo email failed:', err);
      const detail = err?.text || err?.message || String(err);
      alert(
        'We could not send the emails. Please try again or write to ' +
          TEAM_INBOX +
          '.\n\nIf you are testing locally, add http://127.0.0.1 and http://localhost under EmailJS → Account → Security → Allowed domains.\n\n' +
          (detail ? `Details: ${detail}` : '')
      );
      btn.textContent = defaultBtnLabel;
    } finally {
      btn.disabled = false;
    }
  });
}
