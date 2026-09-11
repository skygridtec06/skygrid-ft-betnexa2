function isCanonicalKenyanPhone(phoneNumber) {
  return /^(07|01)\d{8}$/.test(String(phoneNumber || ''));
}

module.exports = { isCanonicalKenyanPhone };
