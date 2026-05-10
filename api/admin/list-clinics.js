/**
 * GET /api/admin/list-clinics
 * Header: x-admin-secret: <ADMIN_SECRET>
 * Returns all clinics with a flag for whether Google Calendar is connected.
 */

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-admin-secret');
  if (req.method === 'OPTIONS') return sendJson(res, 200, {});
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return sendJson(res, 500, { error: 'Supabase not configured' });

  const [clinicsRes, integrationsRes] = await Promise.all([
    fetch(`${base}/rest/v1/clinics?select=*&order=created_at.desc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }),
    fetch(`${base}/rest/v1/clinic_integrations?select=clinic_id,google_calendar_id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }),
  ]);

  const clinics = await clinicsRes.json().catch(() => []);
  const integrations = integrationsRes.ok ? await integrationsRes.json().catch(() => []) : [];
  const connectedIds = new Set(integrations.map(i => i.clinic_id));

  const result = (Array.isArray(clinics) ? clinics : []).map(c => ({
    ...c,
    google_calendar_connected: connectedIds.has(c.id),
  }));

  return sendJson(res, 200, { clinics: result });
};
