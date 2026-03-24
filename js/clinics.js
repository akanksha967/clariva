/**
 * clinics.js
 * Central clinic configuration registry.
 *
 * Each entry represents one practice. The correct config is resolved at
 * runtime by resolveClinic() — based on ?clinic= URL param, subdomain, or
 * falling back to the default.
 *
 * To onboard a new clinic: add an entry here. No new Vapi assistant needed.
 */

export const clinics = {

  clinic_001: {
    clinicId:         'clinic_001',
    clinic_name:      'Green Valley Clinic',
    timezone:         'America/New_York',
    open_time:        '09:00',
    close_time:       '17:00',
    emergency_number: '911',
    callback_time:    'tomorrow morning',
  },

  clinic_002: {
    clinicId:         'clinic_002',
    clinic_name:      'Sunrise Medical Centre',
    timezone:         'America/Los_Angeles',
    open_time:        '08:00',
    close_time:       '18:00',
    emergency_number: '911',
    callback_time:    'tomorrow morning',
  },

  clinic_003: {
    clinicId:         'clinic_003',
    clinic_name:      'Clariva Demo Clinic',
    timezone:         'Europe/London',
    open_time:        '09:00',
    close_time:       '17:30',
    emergency_number: '999',
    callback_time:    'the next business day',
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
