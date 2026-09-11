function normalizeKenyanPhone(phoneNumber) {
  const digits = String(phoneNumber || '').replace(/\D/g, '');

  if (/^0[17]\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^254[17]\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  return null;
}

module.exports = { normalizeKenyanPhone };
