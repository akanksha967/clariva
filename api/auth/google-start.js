/**
 * GET /api/auth/google-start?clinic_id=<id>&secret=<ADMIN_SECRET>
 * Redirects to Google OAuth consent screen.
 * After consent, Google redirects to /api/auth/google-callback?state=<clinic_id>
 */

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

module.exports = function handler(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.query.secret !== secret) {
    res.statusCode = 401;
    return res.end('Unauthorized');
  }

  const clinic_id = req.query.clinic_id;
  if (!clinic_id) {
    res.statusCode = 400;
    return res.end('clinic_id is required');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    res.statusCode = 500;
    return res.end('Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_OAUTH_REDIRECT_URI missing)');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: clinic_id,
  });

  res.statusCode = 302;
  res.setHeader('Location', `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.end();
};
