/**
 * Vapi Server URL — one HTTPS endpoint for your Vercel project.
 *
 * In Vapi: Phone Number (or Assistant) → Server URL → https://YOUR_DOMAIN/api/vapi-server
 * Add Server authentication (Bearer) using the same value as VAPI_SERVER_SECRET below.
 *
 * ── Production call flow ───────────────────────────────────────────────────────
 * 1. Patient dials clinic DID (number you bought in Vapi or port from Twilio into Vapi).
 * 2. Vapi sends POST { message: { type: "assistant-request", call, phoneNumber? } }.
 * 3. This handler resolves clinic from the DIALED number, returns assistantId +
 *    assistantOverrides.variableValues (name, hours, clinic_id for tools, etc.).
 * 4. During the call, the model calls your tool `book_google_calendar`; Vapi sends
 *    { message: { type: "tool-calls", toolCallList: [...] } }.
 * 5. We insert a Google Calendar event and return { results: [...] } (HTTP 200 always).
 *
 * ── Env (Vercel) ──────────────────────────────────────────────────────────────
 *   VAPI_SERVER_SECRET          Bearer token / X-Vapi-Secret (match Vapi credential)
 *   VAPI_ASSISTANT_ID           Shared assistant UUID (same as web demo assistant)
 *
 *   Supabase (recommended)
 *     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *     Table public.clinics: clinic_id, clinic_name, inbound_phone_e164 (+E.164),
 *       open_time, close_time, callback_time, emergency_number, timezone
 *     Table public.clinic_integrations: clinic_id PK/FK, google_refresh_token,
 *       google_calendar_id (default primary)
 *     Run: supabase/migrations/20260407120000_voice_clinics.sql (or paste in SQL editor)
 *
 *   PHONE_CLINIC_MAP            Optional JSON fallback if Supabase has no row for that number
 *
 *   Google (all clinics share one OAuth app; each clinic has its own refresh token in DB)
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI
 *   Optional fallback if a clinic has no integration row yet:
 *   GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID
 *
 * ── Vapi assistant tool (add in dashboard) ────────────────────────────────────
 *   name: book_google_calendar
 *   description: Book an appointment on the clinic calendar when the patient agrees
 *     to a specific date and time. Use clinic timezone. Always pass clinic_id from context.
 *   parameters (JSON Schema): required clinic_id, start_iso, end_iso, summary
 *     optional: description (string)
 *   server.url: same as this endpoint OR inherit org server URL
 *   maxTokens: 500, strict: true
 */

const { google } = require('googleapis');

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return {};
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function verifyVapiAuth(req) {
  const secret = process.env.VAPI_SERVER_SECRET;
  if (!secret) return false;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) return true;
  if ((req.headers['x-vapi-secret'] || '') === secret) return true;
  return false;
}

/** Dialed (clinic) number from inbound call — field names vary by transport. */
function getDialedNumber(message) {
  const n =
    message?.phoneNumber?.number ||
    message?.call?.phoneNumber?.number ||
    message?.call?.phoneNumberNumber ||
    message?.call?.assistantOverrides?.variableValues?.phone;
  return n ? String(n).trim() : '';
}

function normalizeE164(raw) {
  const s = String(raw || '').replace(/\s/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  if (/^\d{10,15}$/.test(s)) return `+${s}`;
  return s;
}

async function resolveClinicFromSupabase(dialedRaw) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dialed = normalizeE164(dialedRaw);
  if (!base || !key || !dialed) return null;

  const q =
    `inbound_phone_e164=eq.${encodeURIComponent(dialed)}` +
    '&select=id,name,open_time,close_time,emergency_number,timezone,calcom_url' +
    '&limit=1';
  const r = await fetch(`${base}/rest/v1/clinics?${q}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  const row = rows[0] && typeof rows[0] === 'object' ? rows[0] : null;
  if (!row) return null;
  // normalize to the field names the rest of the code expects
  return {
    clinic_id: row.id,
    clinic_name: row.name,
    open_time: row.open_time,
    close_time: row.close_time,
    emergency_number: row.emergency_number,
    timezone: row.timezone,
    calcom_url: row.calcom_url,
  };
}

function resolveClinicFromEnvMap(dialedRaw) {
  const dialed = normalizeE164(dialedRaw);
  const mapJson = process.env.PHONE_CLINIC_MAP || '{}';
  let map = {};
  try {
    map = JSON.parse(mapJson);
  } catch {
    return null;
  }
  const hit = map[dialed] || map[dialed.replace(/^\+/, '')];
  return hit && typeof hit === 'object' ? hit : null;
}

async function resolveClinicFromPhone(dialedRaw) {
  const fromDb = await resolveClinicFromSupabase(dialedRaw);
  if (fromDb) return fromDb;
  return resolveClinicFromEnvMap(dialedRaw);
}

function isClinicOpen(clinic) {
  const now = new Date();
  const h = now.getHours();
  const openH = parseInt(String(clinic.open_time || '9:00').split(':')[0], 10);
  const closeH = parseInt(String(clinic.close_time || '17:00').split(':')[0], 10);
  return h >= openH && h < closeH;
}

function greetingFor(clinic) {
  const name = clinic.clinic_name || 'the clinic';
  if (!isClinicOpen(clinic)) {
    return (
      `Thank you for calling ${name}. Our office is currently closed, ` +
      `but I can take your information and make sure someone calls you back when we open. ` +
      `May I get your first name?`
    );
  }
  return (
    `Thank you for calling ${name}. I'm Clariva and I can help you today. ` +
    `May I get your first name?`
  );
}

function variableValuesFor(clinic) {
  const tz = clinic.timezone || 'America/New_York';
  return {
    clinic_id: String(clinic.clinic_id || ''),
    clinic_name: String(clinic.clinic_name || ''),
    open_time: String(clinic.open_time || ''),
    close_time: String(clinic.close_time || ''),
    callback_time: String(clinic.callback_time || 'the next business day'),
    emergency_number: String(clinic.emergency_number || '911'),
    timezone: tz,
    greeting_message: greetingFor(clinic),
    clinic_open: isClinicOpen(clinic) ? 'yes' : 'no',
  };
}

async function getGoogleCredentialsForClinic(clinicId) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && clinicId) {
    const base = url.replace(/\/$/, '');
    const q = `clinic_id=eq.${encodeURIComponent(clinicId)}&select=google_refresh_token,google_calendar_id`;
    const r = await fetch(`${base}/rest/v1/clinic_integrations?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      const row = rows[0];
      if (row?.google_refresh_token) {
        return {
          refresh_token: row.google_refresh_token,
          calendar_id: row.google_calendar_id || 'primary',
        };
      }
    }
  }
  return {
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
    calendar_id: process.env.GOOGLE_CALENDAR_ID || 'primary',
  };
}

async function insertGoogleEvent({ refresh_token, calendar_id }, { start_iso, end_iso, summary, description }) {
  if (!refresh_token) {
    throw new Error('Google Calendar not configured (refresh token missing for this clinic)');
  }
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI || 'https://localhost'
  );
  oauth2.setCredentials({ refresh_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  const res = await calendar.events.insert({
    calendarId: calendar_id || 'primary',
    requestBody: {
      summary: summary || 'Clariva — appointment',
      description: description || 'Booked via Clariva voice agent.',
      start: { dateTime: start_iso },
      end: { dateTime: end_iso },
    },
  });
  return { eventId: res.data.id, htmlLink: res.data.htmlLink };
}

function oneLineJson(obj) {
  return JSON.stringify(obj).replace(/\n/g, ' ');
}

async function handleToolCalls(message) {
  const list = message.toolCallList || [];
  const results = [];

  for (const tc of list) {
    const toolCallId = tc.id;
    const name = tc.name;
    const params = tc.parameters || {};

    if (name !== 'book_google_calendar') {
      results.push({
        name,
        toolCallId,
        result: oneLineJson({ skipped: true, note: 'unknown tool' }),
      });
      continue;
    }

    try {
      const clinic_id = String(params.clinic_id || '').trim();
      const start_iso = String(params.start_iso || '').trim();
      const end_iso = String(params.end_iso || '').trim();
      const summary = String(params.summary || 'Appointment').trim();
      const description = String(params.description || '').trim();

      if (!clinic_id || !start_iso || !end_iso) {
        throw new Error('clinic_id, start_iso, and end_iso are required');
      }

      const creds = await getGoogleCredentialsForClinic(clinic_id);
      const event = await insertGoogleEvent(creds, { start_iso, end_iso, summary, description });
      results.push({
        name,
        toolCallId,
        result: oneLineJson({ ok: true, ...event }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        name: tc.name,
        toolCallId,
        error: msg.replace(/\n/g, ' '),
      });
    }
  }

  return { results };
}

async function handleAssistantRequest(message) {
  const dialed = getDialedNumber(message);
  const clinic = await resolveClinicFromPhone(dialed);
  const assistantId = process.env.VAPI_ASSISTANT_ID;

  if (!assistantId) {
    return { error: 'Server missing VAPI_ASSISTANT_ID.' };
  }

  if (!clinic) {
    return {
      error:
        `No clinic for dialed number ${dialed || '(unknown)'}. ` +
        'Add a row in Supabase public.clinics (inbound_phone_e164) or set PHONE_CLINIC_MAP.',
    };
  }

  return {
    assistantId,
    assistantOverrides: {
      variableValues: variableValuesFor(clinic),
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (!verifyVapiAuth(req)) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const body = parseJsonBody(req);
  const message = body.message || body;

  if (!message || typeof message.type !== 'string') {
    return sendJson(res, 200, {});
  }

  const type = message.type;

  if (type === 'assistant-request') {
    const out = await handleAssistantRequest(message);
    return sendJson(res, 200, out);
  }

  if (type === 'tool-calls') {
    const out = await handleToolCalls(message);
    return sendJson(res, 200, out);
  }

  return sendJson(res, 200, {});
};
