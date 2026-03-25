import emailjs from 'https://esm.sh/@emailjs/browser@4.4.1';
import { startCall } from './vapi.js';

/** Where your team receives new demo leads (must match the “To” field in EmailJS team template). */
const TEAM_INBOX = 'hello@clariva.ai';

/**
 * EmailJS — https://www.emailjs.com/ (free tier works for low volume).
 *
 * 1. Create account → Email Services → connect Gmail or SMTP.
 * 2. Create two Email Templates:
 *
 *    Template A — “team” (to you):
 *      To email: hello@clariva.ai (fixed in template UI)
 *      Subject: New Clariva demo — {{clinic_name}}
 *      Content example:
 *        New demo request.
 *        Practice: {{clinic_name}}
 *        Contact email: {{user_email}}
 *      Reply-To: use {{reply_to}} if your provider supports it in advanced settings.
 *
 *    Template B — “visitor” (confirmation to them):
 *      To email: {{user_email}}  ← set “To” in template to this variable
 *      Subject: We received your Clariva demo request
 *      Content example:
 *        Hi,
 *        Thanks for your interest in Clariva. Someone from our team will reach out soon at this address.
 *        Practice you entered: {{clinic_name}}
 *        — Clariva
 *
 * 3. Copy Public Key, Service ID, and both Template IDs below.
 * 4. In EmailJS → Account → Security, restrict requests to your site’s domain.
 */
const EMAILJS = {
  publicKey: '',
  serviceId: '',
  templateTeam: '',
  templateVisitor: '',
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
  if (!isEmailJsConfigured()) {
    console.warn('[Clariva] EmailJS is not configured — no emails sent. Edit js/form.js (EMAILJS).');
    return;
  }

  await emailjs.send(
    EMAILJS.serviceId,
    EMAILJS.templateTeam,
    {
      team_email: TEAM_INBOX,
      user_email: userEmail,
      clinic_name: clinicName,
      reply_to: userEmail,
    },
    { publicKey: EMAILJS.publicKey }
  );

  await emailjs.send(
    EMAILJS.serviceId,
    EMAILJS.templateVisitor,
    {
      user_email: userEmail,
      clinic_name: clinicName,
    },
    { publicKey: EMAILJS.publicKey }
  );
}

/**
 * Validates that the supplied string is a well-formed email address.
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Updates the CTA button after a successful book + optional email send.
 */
function showBookDemoSuccess(btn) {
  btn.textContent = 'Thanks — check your email';
  btn.style.cssText =
    'background:#2d7a4f;border-color:#2d7a4f;color:white;cursor:default;' +
    'padding:15px 26px;font-size:12px;letter-spacing:.1em;';

  setTimeout(() => {
    btn.textContent = 'Voice demo started';
  }, 3500);
}

function trackDemoRequest(email, clinic) {
  console.log('[Clariva] Demo Lead Captured:', { email, clinic, timestamp: new Date().toISOString() });
}

export function initForm() {
  const btn = document.getElementById('ctaBtn');
  const emailInput = document.getElementById('emailInput');
  const clinicInput = document.getElementById('clinicInput');

  if (!btn || !emailInput) return;

  btn.addEventListener('click', async () => {
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

    const prevText = btn.textContent;
    btn.disabled = true;

    try {
      if (isEmailJsConfigured()) {
        btn.textContent = 'Sending…';
        await sendLeadEmails(email, clinic);
      }

      console.log(`[Clariva] Starting dynamic demo for: ${clinic}`);
      startCall(clinic);
      trackDemoRequest(email, clinic);
      showBookDemoSuccess(btn);
    } catch (err) {
      console.error('[Clariva] Book demo failed:', err);
      alert(
        'We could not send the confirmation emails. You can still try the voice demo, or write us at ' +
          TEAM_INBOX +
          '.'
      );
      startCall(clinic);
      trackDemoRequest(email, clinic);
      btn.textContent = prevText;
    } finally {
      btn.disabled = false;
    }
  });
}
