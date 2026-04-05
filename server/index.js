/**
 * Clariva API — leads, voice callbacks, call logs.
 * Run: cp .env.example .env && npm install && npm run dev
 */
import { randomUUID } from 'crypto';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 3000);
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  : null;

const memory = { leads: [], callbacks: [], calls: [] };

function corsOptions() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw === '*') {
    return { origin: true, credentials: true };
  }
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    origin(origin, cb) {
      if (!origin || list.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
}

const app = express();
app.use(cors(corsOptions()));
app.use(express.json({ limit: '512kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, db: Boolean(pool) });
});

async function insertLead({ email, clinic_name, clinic_id }) {
  if (pool) {
    const r = await pool.query(
      `INSERT INTO leads (email, clinic_name, clinic_id)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [email, clinic_name || null, clinic_id || null]
    );
    return r.rows[0];
  }
  const row = {
    id: randomUUID(),
    email,
    clinic_name: clinic_name || null,
    clinic_id: clinic_id || null,
    created_at: new Date().toISOString(),
  };
  memory.leads.push(row);
  return row;
}

async function insertCallback(body) {
  const payload = {
    clinic_id: body.clinicId,
    patient_name: body.patientName ?? body.name ?? null,
    phone: body.phone,
    urgency: body.urgency || 'normal',
    raw_payload: body,
  };
  if (pool) {
    const r = await pool.query(
      `INSERT INTO callbacks (clinic_id, patient_name, phone, urgency, raw_payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, created_at`,
      [
        payload.clinic_id,
        payload.patient_name,
        payload.phone,
        payload.urgency,
        JSON.stringify(payload.raw_payload),
      ]
    );
    return r.rows[0];
  }
  const row = {
    id: randomUUID(),
    ...payload,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  memory.callbacks.push(row);
  return row;
}

async function insertCallLog(body) {
  const row = {
    clinic_id: body.clinicId ?? null,
    clinic_name: body.clinicName ?? null,
    duration_seconds: body.durationSeconds ?? null,
    status: body.status || 'completed',
    transcript: body.transcript ?? null,
    vapi_call_id: body.vapiCallId ?? null,
    raw_payload: body,
  };
  if (pool) {
    const r = await pool.query(
      `INSERT INTO calls (clinic_id, clinic_name, duration_seconds, status, transcript, vapi_call_id, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, created_at`,
      [
        row.clinic_id,
        row.clinic_name,
        row.duration_seconds,
        row.status,
        row.transcript,
        row.vapi_call_id,
        JSON.stringify(row.raw_payload),
      ]
    );
    return r.rows[0];
  }
  const saved = {
    id: randomUUID(),
    ...row,
    created_at: new Date().toISOString(),
  };
  memory.calls.push(saved);
  return saved;
}

async function sendLeadEmailResend({ email, clinic_name, booking_url }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const teamInbox = process.env.TEAM_INBOX;
  if (!key || !from || !teamInbox) return;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [teamInbox],
      subject: `Clariva demo lead: ${clinic_name || 'Unknown practice'}`,
      html: `<p>New demo request</p><ul><li>Email: ${email}</li><li>Practice: ${clinic_name}</li><li>Booking: ${booking_url}</li></ul>`,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('[clariva-api] Resend team notify failed:', res.status, t);
  }

  const res2 = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your Clariva demo — book a time',
      html: `<p>Thanks for your interest in Clariva.</p><p>Practice: <strong>${clinic_name}</strong></p><p><a href="${booking_url}">Schedule your demo</a></p>`,
    }),
  });
  if (!res2.ok) {
    const t = await res2.text();
    console.error('[clariva-api] Resend visitor email failed:', res2.status, t);
  }
}

app.post('/api/leads', async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const clinic_name = (req.body.clinic_name || req.body.clinic || '').trim();
    const clinic_id = (req.body.clinic_id || '').trim() || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!clinic_name) {
      return res.status(400).json({ error: 'clinic_name required' });
    }

    const row = await insertLead({ email, clinic_name, clinic_id });
    const booking_url =
      req.body.booking_url ||
      `${req.protocol}://${req.get('host')}/book`;

    sendLeadEmailResend({ email, clinic_name, booking_url }).catch((e) =>
      console.error('[clariva-api] Resend async error:', e)
    );

    res.status(201).json({ id: row.id, created_at: row.created_at });
  } catch (e) {
    console.error('[clariva-api] /api/leads', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/callbacks', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.clinicId && !body.clinic_id) {
      return res.status(400).json({ error: 'clinicId required' });
    }
    if (!body.phone) {
      return res.status(400).json({ error: 'phone required' });
    }
    const normalized = {
      ...body,
      clinicId: body.clinicId || body.clinic_id,
    };
    const row = await insertCallback(normalized);
    res.status(201).json({ id: row.id, created_at: row.created_at });
  } catch (e) {
    console.error('[clariva-api] /api/callbacks', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/call-logs', async (req, res) => {
  try {
    const row = await insertCallLog(req.body || {});
    res.status(201).json({ id: row.id, created_at: row.created_at });
  } catch (e) {
    console.error('[clariva-api] /api/call-logs', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  console.log(`[clariva-api] http://localhost:${PORT}  db=${pool ? 'postgres' : 'memory'}`);
});
