/**
 * vapi.js
 * Vapi voice agent — scalable, multi-clinic architecture.
 *
 * One shared assistant handles every clinic. Clinic-specific behaviour
 * (name, hours, emergency number, greeting) is injected at call-start
 * via assistantOverrides.variableValues so the Vapi assistant prompt can
 * reference {{clinic_name}}, {{open_time}}, {{callback_time}}, {{emergency_number}},
 * {{greeting_message}}, {{clinic_open}}, and {{booking_url}} (Cal.com) as template variables.
 */

import Vapi from 'https://esm.sh/@vapi-ai/web@2.5.2';
import { resolveClinic, resolveBookingUrl } from './clinics.js';
import { getApiBase } from './config.js';

// ── Vapi credentials ─────────────────────────────────────────────────────────
const PUBLIC_KEY = '411e90c6-1592-4c89-ae98-8db5670506e3';
const ASSISTANT_ID = '03fd7c33-842b-4111-b115-686258d3a818';

// ── UI state labels ───────────────────────────────────────────────────────────
const STATES = {
  idle: { label: '🎙 Speak to Clariva — Live Demo', cls: '' },
  connecting: { label: 'Connecting…', cls: 'connecting' },
  active: { label: '⏹ End Call', cls: 'active' },
  speaking: { label: '◉ Clariva is speaking…', cls: 'speaking' },
  error: { label: '⚠ Could not connect — try again', cls: 'error' },
};

// ── Clinic helpers ────────────────────────────────────────────────────────────

/**
 * Returns true if the clinic is currently open based on local wall-clock hours.
 * @param {object} config
 */
function isClinicOpen(config) {
  const now = new Date();
  const currentHour = now.getHours();
  const openHour = parseInt(config.open_time.split(':')[0], 10);
  const closeHour = parseInt(config.close_time.split(':')[0], 10);
  return currentHour >= openHour && currentHour < closeHour;
}

/**
 * Generates a dynamic opening greeting based on current clinic status.
 * @param {object} config
 * @returns {string}
 */
function generateGreeting(config) {
  if (!isClinicOpen(config)) {
    return `Thank you for calling ${config.clinic_name}. Our office is currently closed, ` +
      `but I can take your information and make sure someone calls you back when we open. ` +
      `May I get your first name?`;
  }
  return `Thank you for calling ${config.clinic_name}. I'm Clariva and I can help you today. ` +
    `May I get your first name?`;
}

let vapiInstance = null;
let activeClinicConfig = null;
let isCallActive = false;
/** @type {{ role: string, text: string }[]} */
let transcriptBuffer = [];
let callStartedAt = null;

async function postToApi(path, body) {
  const base = getApiBase();
  if (!base) return;
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn('[Clariva] API', path, res.status, t);
    }
  } catch (e) {
    console.warn('[Clariva] API', path, e);
  }
}

/**
 * Builds the assistantOverrides payload injected into every call.
 */
function buildAssistantOverrides(config) {
  return {
    variableValues: {
      clinic_name: config.clinic_name,
      open_time: config.open_time,
      close_time: config.close_time,
      callback_time: config.callback_time,
      emergency_number: config.emergency_number,
      greeting_message: generateGreeting(config),
      clinic_open: isClinicOpen(config) ? 'yes' : 'no',
      booking_url: resolveBookingUrl(config.clinic_name),
    },
    maxDurationSeconds: 120,
  };
}

/**
 * Starts a Vapi call with the current or provided clinic name.
 * @param {string} [customClinicName]
 */
export async function startCall(customClinicName = null) {
  if (!vapiInstance) return;

  const config = customClinicName
    ? { ...activeClinicConfig, clinic_name: customClinicName }
    : activeClinicConfig;

  try {
    await vapiInstance.start(ASSISTANT_ID, buildAssistantOverrides(config));
  } catch (err) {
    console.error('[Clariva] Failed to start call:', err);
  }
}

/**
 * Stops the active Vapi call.
 */
export function stopCall() {
  if (vapiInstance && isCallActive) {
    vapiInstance.stop();
  }
}

/**
 * Processes tool-call payloads from the assistant requesting a patient callback.
 * Extend this to POST to your backend / CRM.
 * @param {{ name: string, phone: string, urgency: string }} data
 * @param {object} clinicConfig
 */
function handleCallbackRequest(data, clinicConfig) {
  const callbackRequest = {
    clinicId: clinicConfig.clinicId,
    clinicName: clinicConfig.clinic_name,
    patientName: data.name,
    phone: data.phone,
    urgency: data.urgency || 'normal',
    createdAt: new Date().toISOString(),
  };
  console.log('[Clariva] Callback request received:', callbackRequest);
  postToApi('/api/callbacks', callbackRequest);
}

// ── Main init ─────────────────────────────────────────────────────────────────
export function initVapi() {
  const btn = document.getElementById('vapiDemoBtn');
  if (!btn) return;

  // Bail out gracefully if the browser cannot access the mic
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    btn.textContent = 'Microphone not supported in this browser';
    btn.disabled = true;
    return;
  }

  // Resolve which clinic this page is serving
  activeClinicConfig = resolveClinic();
  vapiInstance = new Vapi(PUBLIC_KEY);

  // ── UI helper ───────────────────────────────────────────────────────────────
  function setState(key) {
    const s = STATES[key];
    btn.textContent = s.label;
    btn.className = 'vapi-btn ' + s.cls;
    btn.disabled = key === 'connecting';
  }

  // ── Vapi event listeners ────────────────────────────────────────────────────
  vapiInstance.on('call-start', () => {
    isCallActive = true;
    transcriptBuffer = [];
    callStartedAt = Date.now();
    setState('active');
    console.log('[Clariva] Call started');
  });

  vapiInstance.on('call-end', () => {
    const durationSeconds =
      callStartedAt != null ? Math.max(0, Math.round((Date.now() - callStartedAt) / 1000)) : null;
    const transcript =
      transcriptBuffer.length > 0
        ? transcriptBuffer.map((l) => `${l.role}: ${l.text}`).join('\n')
        : null;
    postToApi('/api/call-logs', {
      clinicId: activeClinicConfig?.clinicId,
      clinicName: activeClinicConfig?.clinic_name,
      durationSeconds,
      status: 'completed',
      transcript,
      endedAt: new Date().toISOString(),
    });
    isCallActive = false;
    callStartedAt = null;
    transcriptBuffer = [];
    setState('idle');
    console.log('[Clariva] Call ended');
  });

  vapiInstance.on('speech-start', () => {
    if (isCallActive) setState('speaking');
  });

  vapiInstance.on('speech-end', () => {
    if (isCallActive) setState('active');
  });

  vapiInstance.on('message', (message) => {
    if (message.type === 'transcript' && message.transcript) {
      console.log(`[Clariva transcript] ${message.role}: ${message.transcript}`);
      transcriptBuffer.push({
        role: message.role || 'unknown',
        text: String(message.transcript).trim(),
      });
    }
    if (message.type === 'function-call') {
      const { name, parameters } = message.functionCall;
      if (name === 'save_callback_request') {
        handleCallbackRequest(parameters, activeClinicConfig);
      }
    }
  });

  vapiInstance.on('error', (e) => {
    console.error('[Clariva] Vapi error:', e);
    isCallActive = false;
    setState('error');
    setTimeout(() => setState('idle'), 3000);
  });

  // ── Voice demo only (Book My Demo is handled in form.js — never calls startCall) ──
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isCallActive) {
      stopCall();
    } else {
      const input = document.getElementById('clinicInput');
      const name = input ? input.value.trim() : '';
      if (!name) {
        alert('Please enter your practice name so Clariva can use it on the call.');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      startCall(name);
    }
  });

  setState('idle');
}
