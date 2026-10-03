const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePhoneNumber,
  getC2bPayerPhone,
  phoneCandidates,
} = require('./c2bPhoneUtils.js');
const crypto = require('crypto');

test('normalizePhoneNumber accepts formatted phone numbers and rejects opaque identifiers', () => {
  assert.equal(normalizePhoneNumber('+254 712-345-678'), '+254712345678');
  assert.equal(normalizePhoneNumber('0712 345 678'), '0712345678');
  assert.equal(normalizePhoneNumber('c4a2ed444e3b5cfc'), null);
  assert.equal(normalizePhoneNumber(''), null);
});

test('getC2bPayerPhone reads direct and named callback metadata phone fields', async () => {
  assert.equal(await getC2bPayerPhone({ Body: { MSISDN: '254712345678' } }), '254712345678');
  assert.equal(await getC2bPayerPhone({
    MSISDN: 'opaque-value',
    CallbackMetadata: { Item: [{ Name: 'PhoneNumber', Value: 254700000000 }] },
  }), '254700000000');
  assert.equal(await getC2bPayerPhone({ MSISDN: 'opaque-value' }), null);
});

test('getC2bPayerPhone resolves a hashed MSISDN against stored user phone numbers', async () => {
  const targetPhone = '0740176944';
  const hash = crypto.createHash('sha256').update(targetPhone).digest('hex');
  const supabase = {
    from: () => ({
      select: () => ({
        not: () => ({
          range: async () => ({ data: [{ phone_number: targetPhone }], error: null }),
        }),
      }),
    }),
  };

  assert.equal(await getC2bPayerPhone({ Body: { MSISDN: hash } }, supabase), targetPhone);
});

test('phone hash lookup considers common Kenyan phone formats', () => {
  assert.deepEqual(phoneCandidates('0740 176 944').sort(), ['0740176944', '254740176944', '+0740176944'].sort());
});
