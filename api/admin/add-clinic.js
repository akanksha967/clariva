/**
 * POST /api/admin/add-clinic
 * Body: { id, name, inbound_phone, open_time, close_time, emergency_number, timezone, calcom_url }
 * Header: x-admin-secret: <ADMIN_SECRET env var>
 */

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

function normalizeE164(raw) {
  const s = String(raw || '').replace(/\s/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  if (/^\d{10,15}$/.test(s)) return `+${s}`;
  return s;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-secret');
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const body = parseBody(req);
  const { id, name, inbound_phone, open_time, close_time, emergency_number, timezone, calcom_url } = body;

  if (!id || !name || !inbound_phone) {
    return sendJson(res, 400, { error: 'id, name, and inbound_phone are required' });
  }

  const phone = normalizeE164(inbound_phone);
  if (!phone) return sendJson(res, 400, { error: 'Invalid phone number format' });

  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return sendJson(res, 500, { error: 'Supabase not configured' });

  const row = {
    id: id.trim().toLowerCase().replace(/\s+/g, '-'),
    name: name.trim(),
    inbound_phone_e164: phone,
    open_time: open_time || '09:00',
    close_time: close_time || '17:00',
    emergency_number: emergency_number || '911',
    timezone: timezone || 'America/New_York',
    calcom_url: calcom_url || null,
  };

  const r = await fetch(`${base}/rest/v1/clinics`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) return sendJson(res, 400, { error: data?.message || 'Supabase insert failed', detail: data });

  return sendJson(res, 200, { ok: true, clinic: Array.isArray(data) ? data[0] : data });
};
