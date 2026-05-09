/**
 * GET /api/auth/google-callback?code=<code>&state=<clinic_id>
 * Google redirects here after the clinic owner grants calendar access.
 * Exchanges the code for a refresh token and saves it to clinic_integrations.
 * Set GOOGLE_OAUTH_REDIRECT_URI to https://yourdomain.com/api/auth/google-callback
 */

module.exports = async function handler(req, res) {
  const { code, state: clinic_id, error } = req.query;

  if (error) {
    res.statusCode = 400;
    return res.end(`Google OAuth error: ${error}`);
  }

  if (!code || !clinic_id) {
    res.statusCode = 400;
    return res.end('Missing code or clinic_id (state)');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    res.statusCode = 500;
    return res.end('Google OAuth env vars not configured');
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokens.refresh_token) {
    res.statusCode = 400;
    return res.end(`Failed to get refresh token: ${tokens.error_description || tokens.error || 'unknown error'}`);
  }

  // Save refresh token to Supabase
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    res.statusCode = 500;
    return res.end('Supabase not configured');
  }

  const upsertRes = await fetch(`${base}/rest/v1/clinic_integrations`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      clinic_id,
      google_refresh_token: tokens.refresh_token,
      google_calendar_id: 'primary',
      updated_at: new Date().toISOString(),
    }),
  });

  if (!upsertRes.ok) {
    const err = await upsertRes.text();
    res.statusCode = 500;
    return res.end(`Supabase save failed: ${err}`);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>Connected</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f4f1;}
    .box{text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);}
    h2{color:#4a7c59;margin-bottom:.5rem;} p{color:#666;}</style>
    </head>
    <body>
    <div class="box">
      <h2>✓ Google Calendar Connected</h2>
      <p>Clinic <strong>${clinic_id}</strong> is now connected.</p>
      <p>You can close this window.</p>
    </div>
    </body>
    </html>
  `);
};
