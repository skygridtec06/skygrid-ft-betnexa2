export function normalizeKenyanPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  if (/^0[17]\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^254[17]\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  return null;
}

export function isCanonicalKenyanPhone(phone: string): boolean {
  return /^(07|01)\d{8}$/.test(phone);
}
