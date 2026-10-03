const crypto = require('crypto');

const PHONE_HASH_CACHE_TTL_MS = 15 * 60 * 1000;
let phoneHashIndex = null;
let phoneHashIndexExpiresAt = 0;
let phoneHashIndexPromise = null;

function normalizePhoneNumber(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const raw = String(value).trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;

  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15
    ? `${raw.startsWith('+') ? '+' : ''}${digits}`
    : null;
}

function getC2bPayerPhoneValue(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload.Body && typeof payload.Body === 'object' ? payload.Body : payload;
  const candidates = [
    body.MSISDN,
    body.Msisdn,
    body.msisdn,
    body.PhoneNumber,
    body.phoneNumber,
    body.phone_number,
  ];

  const metadata = body.CallbackMetadata?.Item || body.callbackMetadata?.Item;
  if (Array.isArray(metadata)) {
    for (const item of metadata) {
      if (/^(msisdn|phone(number)?|payerphone)$/i.test(String(item?.Name || '').replace(/[\s_-]/g, ''))) {
        candidates.push(item.Value);
      }
    }
  }

  for (const candidate of candidates) {
    const phone = normalizePhoneNumber(candidate);
    if (phone) return phone;
  }
  return null;
}

function getC2bPayerPhoneHash(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload.Body && typeof payload.Body === 'object' ? payload.Body : payload;
  const candidates = [body.MSISDN, body.Msisdn, body.msisdn, body.PhoneNumber, body.phoneNumber, body.phone_number];
  const metadata = body.CallbackMetadata?.Item || body.callbackMetadata?.Item;
  if (Array.isArray(metadata)) {
    for (const item of metadata) {
      if (/^(msisdn|phone(number)?|payerphone)$/i.test(String(item?.Name || '').replace(/[\s_-]/g, ''))) {
        candidates.push(item.Value);
      }
    }
  }

  return candidates.find((candidate) => (
    typeof candidate === 'string' && /^[a-f\d]{64}$/i.test(candidate.trim())
  ))?.trim().toLowerCase() || null;
}

function phoneCandidates(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return [];
  const digits = normalized.replace(/\D/g, '');
  const candidates = new Set([normalized, digits, `+${digits}`]);
  if (digits.startsWith('254')) candidates.add(`0${digits.slice(3)}`);
  if (digits.startsWith('0')) candidates.add(`254${digits.slice(1)}`);
  return Array.from(candidates);
}

async function loadPhoneHashIndex(supabase) {
  if (phoneHashIndex && Date.now() < phoneHashIndexExpiresAt) return phoneHashIndex;
  if (phoneHashIndexPromise) return phoneHashIndexPromise;
  if (!supabase) throw new Error('Database is not initialized for C2B payer phone lookup');

  phoneHashIndexPromise = (async () => {
    const index = new Map();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('users')
        .select('phone_number')
        .not('phone_number', 'is', null)
        .range(from, from + pageSize - 1);
      if (error) throw error;

      for (const user of data || []) {
        for (const candidate of phoneCandidates(user.phone_number)) {
          const hash = crypto.createHash('sha256').update(candidate).digest('hex');
          if (!index.has(hash)) index.set(hash, normalizePhoneNumber(user.phone_number));
        }
      }

      if (!data || data.length < pageSize) break;
    }

    phoneHashIndex = index;
    phoneHashIndexExpiresAt = Date.now() + PHONE_HASH_CACHE_TTL_MS;
    return index;
  })();

  try {
    return await phoneHashIndexPromise;
  } finally {
    phoneHashIndexPromise = null;
  }
}

async function getC2bPayerPhone(payload, supabase) {
  const directPhone = getC2bPayerPhoneValue(payload);
  if (directPhone) return directPhone;

  const phoneHash = getC2bPayerPhoneHash(payload);
  if (!phoneHash) return null;

  const index = await loadPhoneHashIndex(supabase);
  return index.get(phoneHash) || null;
}

module.exports = {
  normalizePhoneNumber,
  getC2bPayerPhone,
  getC2bPayerPhoneHash,
  phoneCandidates,
};
