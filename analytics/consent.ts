export type ConsentChoice = 'accepted' | 'rejected';
export type Consent = ConsentChoice | 'unknown';
export const CONSENT_KEY = 'laptiva-analytics-consent';
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function parseConsent(raw: string | null, now = Date.now()): Consent {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || value.version !== CONSENT_VERSION
      || !Number.isFinite(value.decidedAt) || value.decidedAt > now
      || now - value.decidedAt >= CONSENT_MAX_AGE_MS) return 'unknown';
    return value.choice === 'accepted' || value.choice === 'rejected' ? value.choice : 'unknown';
  } catch { return 'unknown'; }
}

export function readConsent(storage: ConsentStorage, now = Date.now()): Consent {
  try { return parseConsent(storage.getItem(CONSENT_KEY), now); }
  catch { return 'unknown'; }
}

export function consentRemainingMs(storage: ConsentStorage, now = Date.now()): number | null {
  try {
    const raw = storage.getItem(CONSENT_KEY);
    if (parseConsent(raw, now) === 'unknown') return null;
    return Math.max(0, JSON.parse(raw!).decidedAt + CONSENT_MAX_AGE_MS - now);
  } catch { return null; }
}

export function writeConsent(storage: ConsentStorage, choice: ConsentChoice, now = Date.now()): boolean {
  try {
    storage.setItem(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, choice, decidedAt: now }));
    return readConsent(storage, now) === choice;
  } catch { return false; }
}
