/**
 * POST /api/book-demo
 * Body: { "email": "…", "clinic_name": "…" }
 *
 * ── EmailJS (two templates — same variable names in both) ─────────────────────
 * Template params sent:  clinic_name, user_email
 * Create two templates in EmailJS and paste their IDs below.
 *
 *   EMAILJS_SERVICE_ID
 *   EMAILJS_PUBLIC_KEY       (Public Key — same as user_id in REST API)
 *   EMAILJS_PRIVATE_KEY      (Private Key — Account → API keys; server-only)
 *   EMAILJS_TEMPLATE_TEAM    → email to YOU: "New demo request… Practice / Email …"
 *   EMAILJS_TEMPLATE_VISITOR → email to THEM: "Thanks for your interest… {{clinic_name}} …"
 *
 * In each template, use {{clinic_name}} and {{user_email}} where you need them.
 * Set each template’s “To” field in EmailJS: visitor template → dynamic (e.g. {{user_email}});
 *   team template → your Clariva inbox, or use EmailJS “Send to” fixed address.
 *
 * ── Resend (optional alternative — set RESEND_API_KEY; skips EmailJS) ─────────
 *   RESEND_API_KEY, EMAIL_FROM, NOTIFY_EMAIL (internal inbox)
 *   Sends a plain internal + a plain thank-you to the visitor.
 *
 * ── Supabase (optional) ───────────────────────────────────────────────────────
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_LEADS_TABLE (default: demo_leads)
 */

const EMAILJS_SEND = 'https://api.emailjs.com/api/v1.0/email/send';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function emailJsParams(clinic_name, user_email) {
  return {
    clinic_name,
    user_email,
  };
}

async function sendEmailJSOne(service_id, template_id, user_id, accessToken, template_params) {
  const r = await fetch(EMAILJS_SEND, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id,
      template_id,
      user_id,
      accessToken,
      template_params,
    }),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`EmailJS (${template_id}): ${r.status} ${text}`);
  }
}

async function sendEmailJSDual({ clinic_name, user_email }) {
  const service_id = process.env.EMAILJS_SERVICE_ID;
  const user_id = process.env.EMAILJS_PUBLIC_KEY;
  const accessToken = process.env.EMAILJS_PRIVATE_KEY;
  const template_team = process.env.EMAILJS_TEMPLATE_TEAM;
  const template_visitor = process.env.EMAILJS_TEMPLATE_VISITOR;

  if (!service_id || !user_id || !accessToken || !template_team || !template_visitor) {
    throw new Error(
      'EmailJS env incomplete: need SERVICE_ID, PUBLIC_KEY, PRIVATE_KEY, TEMPLATE_TEAM, TEMPLATE_VISITOR'
    );
  }

  const params = emailJsParams(clinic_name, user_email);

  // Internal lead first, then visitor thank-you (same {{clinic_name}} / {{user_email}} in both)
  await sendEmailJSOne(service_id, template_team, user_id, accessToken, params);
  await sendEmailJSOne(service_id, template_visitor, user_id, accessToken, params);
}

async function sendResendDual({ clinic_name, user_email }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const notify = process.env.NOTIFY_EMAIL;
  if (!key || !from || !notify) {
    throw new Error('Resend env incomplete (RESEND_API_KEY, EMAIL_FROM, NOTIFY_EMAIL)');
  }

  const internal = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [notify],
      reply_to: user_email,
      subject: 'New demo request — Clariva site',
      text:
        `You have a new demo request from the Clariva site.\n\n` +
        `Practice\t${clinic_name}\nEmail\t${user_email}\n` +
        `You can reply to them at ${user_email}.\n\n` +
        'Sent from the Clariva website lead form.',
    }),
  });
  const internalData = await internal.json().catch(() => ({}));
  if (!internal.ok) {
    throw new Error(internalData.message || `Resend (internal): ${internal.status}`);
  }

  const thanks = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [user_email],
      subject: 'Thanks for your interest in Clariva',
      text:
        'Hi,\n\nThanks for your interest in Clariva.\n\n' +
        `We've received your demo request for ${clinic_name}. Someone from our team will reach out soon at this email address.\n\n` +
        "If you started the voice demo on our site, you can keep going in your browser — you don't need to reply here unless you have a question.\n\n" +
        'Best,\nThe Clariva team',
    }),
  });
  const thanksData = await thanks.json().catch(() => ({}));
  if (!thanks.ok) {
    throw new Error(thanksData.message || `Resend (visitor): ${thanks.status}`);
  }
}

async function insertSupabaseLead({ email, clinic_name }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_LEADS_TABLE || 'demo_leads';
  if (!url || !key) return { skipped: true };

  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      email,
      clinic_name,
      created_at: new Date().toISOString(),
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    console.error('[book-demo] Supabase insert failed:', r.status, t);
    throw new Error(t || 'Supabase insert failed');
  }
  return { skipped: false };
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  let body = {};
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    body = req.body;
  } else if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body || '{}');
    } catch {
      return json(res, 400, { error: 'Invalid JSON' });
    }
  }

  const user_email = String(body.email || '').trim();
  const clinic_name = String(body.clinic_name || '').trim();

  if (!user_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
    return json(res, 400, { error: 'Valid email required' });
  }
  if (!clinic_name) {
    return json(res, 400, { error: 'Practice name required' });
  }

  const payload = { user_email, clinic_name, email: user_email };

  try {
    if (process.env.RESEND_API_KEY) {
      await sendResendDual({ clinic_name, user_email });
    } else {
      await sendEmailJSDual({ clinic_name, user_email });
    }
  } catch (e) {
    console.error('[book-demo] email:', e);
    return json(res, 502, { error: e instanceof Error ? e.message : 'Email failed' });
  }

  try {
    await insertSupabaseLead({ email: user_email, clinic_name });
  } catch (e) {
    console.warn('[book-demo] Supabase (non-fatal):', e);
  }

  return json(res, 200, { ok: true });
}

module.exports = handler;
