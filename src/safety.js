import { EMERGENCY_SITUATIONS, CRITICAL_SIGNS, HELPLINES } from './catalog.js';

/**
 * Deterministic safety floor. The model's judgement can raise urgency but
 * never lower it below what these rules require.
 */

const CRISIS_PATTERNS = [
  /\b(kill|hurt|harm)\s+(myself|me)\b/i,
  /\bsuicid/i,
  /\b(end|take)\s+my\s+(own\s+)?life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\boverdos/i,
  /\bnot\s+breathing\b/i,
  /\bwon'?t\s+wake\s+up\b/i,
  /\bunconscious\b/i,
];

export function hasCrisisLanguage(text = '') {
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

export function requiredUrgency({ situation, signs = [] }) {
  if (signs.some((s) => CRITICAL_SIGNS.has(s))) return 'emergency';
  if (EMERGENCY_SITUATIONS.has(situation)) return 'emergency';
  return 'support';
}

const URGENCY_RANK = { support: 0, urgent: 1, emergency: 2 };
const RISK_RANK = { low: 0, moderate: 1, high: 2, crisis: 3 };

export const maxUrgency = (a, b) => (URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b);
export const maxRisk = (a, b) => (RISK_RANK[a] >= RISK_RANK[b] ? a : b);

export function helplinesFor(country) {
  return HELPLINES[country] ?? HELPLINES.IN;
}
