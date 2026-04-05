/**
 * clinics.js
 * Central clinic configuration registry.
 *
 * Each entry represents one practice. The correct config is resolved at
 * runtime by resolveClinic() — based on ?clinic= URL param, subdomain, or
 * falling back to the default.
 *
 * To onboard a new clinic: add an entry here. No new Vapi assistant needed.
 *
 * calcom_url — public Cal.com booking link for this practice (create events at cal.com).
 * Falls back to DEFAULT_CALCOM_URL if omitted.
 */

/** Used when a clinic has no calcom_url or for unknown practice names. Replace with your team link. */
export const DEFAULT_CALCOM_URL = 'https://cal.com/clariva/demo';

export const clinics = {

  clinic_001: {
    clinicId:         'clinic_001',
    clinic_name:      'Green Valley Clinic',
    timezone:         'America/New_York',
    open_time:        '09:00',
    close_time:       '17:00',
    emergency_number: '911',
    callback_time:    'tomorrow morning',
    calcom_url:       'https://cal.com/clariva/green-valley',
  },

  clinic_002: {
    clinicId:         'clinic_002',
    clinic_name:      'Sunrise Medical Centre',
    timezone:         'America/Los_Angeles',
    open_time:        '08:00',
    close_time:       '18:00',
    emergency_number: '911',
    callback_time:    'tomorrow morning',
    calcom_url:       'https://cal.com/clariva/sunrise',
  },

  clinic_003: {
    clinicId:         'clinic_003',
    clinic_name:      'Clariva Demo Clinic',
    timezone:         'Europe/London',
    open_time:        '09:00',
    close_time:       '17:30',
    emergency_number: '999',
    callback_time:    'the next business day',
    calcom_url:       'https://cal.com/clariva/demo',
  },

};

/** Default clinic used when no match is found. */
export const DEFAULT_CLINIC_ID = 'clinic_001';

/**
 * Resolves the active clinic config using (in order of priority):
 *   1. ?clinic=<id> URL query parameter
 *   2. Subdomain, e.g. sunrise-medical.clariva.ai  → 'clinic_002'
 *      (looks for a match in clinic_name converted to slug)
 *   3. Falls back to DEFAULT_CLINIC_ID
 *
 * @returns {object} clinic config
 */
export function resolveClinic() {
  // 1. URL param: ?clinic=clinic_002
  const params   = new URLSearchParams(window.location.search);
  const paramId  = params.get('clinic');
  if (paramId && clinics[paramId]) return clinics[paramId];

  // 2. Subdomain match
  const subdomain = window.location.hostname.split('.')[0].toLowerCase();
  const bySubdomain = Object.values(clinics).find(c =>
    c.clinic_name.toLowerCase().replace(/\s+/g, '-') === subdomain
  );
  if (bySubdomain) return bySubdomain;

  // 3. Default
  return clinics[DEFAULT_CLINIC_ID];
}

/**
 * Cal.com link for emails and Vapi. If the visitor typed a practice name that matches a
 * registry clinic_name, uses that clinic’s calcom_url; otherwise uses ?clinic= / subdomain / default.
 */
export function resolveBookingUrl(typedPracticeName) {
  const trimmed = (typedPracticeName || '').trim();
  if (trimmed) {
    const match = Object.values(clinics).find(
      (c) => c.clinic_name.toLowerCase() === trimmed.toLowerCase()
    );
    if (match?.calcom_url) return match.calcom_url;
  }
  const resolved = resolveClinic();
  return resolved.calcom_url || DEFAULT_CALCOM_URL;
}

/** Cal.com link for the current page (?clinic= / subdomain), for the static “Schedule” link. */
export function resolveBookingUrlForPage() {
  return resolveClinic().calcom_url || DEFAULT_CALCOM_URL;
}
