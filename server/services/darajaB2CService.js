/**
 * Daraja B2C (send money) + Account Balance query service.
 * Reuses the same production consumer key/secret and access token as darajaTestService.
 */

const https = require('https');
const crypto = require('crypto');
const { getAccessToken, normalizeDarajaPhoneNumber } = require('./darajaTestService');

const DARAJA_HOST = 'api.safaricom.co.ke';
const darajaHttpsAgent = new https.Agent({ keepAlive: true });

// Safety caps — override via env if the business wants different limits
const MAX_SINGLE_AMOUNT = parseFloat(process.env.DARAJA_B2C_MAX_AMOUNT || '50000');
const MAX_DAILY_AMOUNT = parseFloat(process.env.DARAJA_B2C_DAILY_CAP || '200000');

function getB2CConfig() {
  const clean = (value) => (typeof value === 'string' ? value.replace(/[\r\n\s]+/g, '').trim() : value);
  const cleanUrl = (value) => (typeof value === 'string' ? value.replace(/[\r\n]+/g, '').trim() : value);
  const config = {
    initiatorName: clean(process.env.DARAJA_INITIATOR_NAME),
    securityCredential: clean(process.env.DARAJA_SECURITY_CREDENTIAL),
    shortCode: clean(process.env.DARAJA_B2C_SHORT_CODE) || clean(process.env.DARAJA_TEST_SHORT_CODE) || '4320291',
    callbackBaseUrl: cleanUrl(process.env.DARAJA_TEST_CALLBACK_BASE_URL || process.env.SERVER_PUBLIC_URL || 'https://www.betnexabackend.co.ke').replace(/\/$/, ''),
  };

  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing Daraja B2C configuration: ${missing.join(', ')}`);
  }

  return config;
}

function performJsonRequest({ method, path, headers }, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;

    const req = https.request(
      {
        hostname: DARAJA_HOST,
        port: 443,
        path,
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
          ...headers,
        },
        agent: darajaHttpsAgent,
        timeout: 30000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (error) {
            reject(new Error(`Failed to parse Daraja response: ${error.message}`));
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
            return;
          }
          console.error('[Daraja B2C] HTTP', res.statusCode, 'Response:', JSON.stringify(parsed));
          reject(new Error(parsed.errorMessage || parsed.ResponseDescription || `Daraja request failed with status ${res.statusCode}`));
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Daraja request timed out'));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function callDaraja(path, payload) {
  const accessToken = await getAccessToken();
  return performJsonRequest(
    { method: 'POST', path, headers: { Authorization: `Bearer ${accessToken}` } },
    payload
  );
}

/**
 * Send money from the paybill to a customer's phone number (B2C).
 * Throws if amount exceeds the configured per-transaction cap.
 */
async function sendB2CPayment({ recipientPhone, amount, commandId, remarks, occasion }) {
  const config = getB2CConfig();
  const normalizedPhone = normalizeDarajaPhoneNumber(recipientPhone);
  const roundedAmount = Math.round(parseFloat(amount));

  if (!roundedAmount || roundedAmount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  if (roundedAmount > MAX_SINGLE_AMOUNT) {
    throw new Error(`Amount exceeds the per-transaction limit of KSH ${MAX_SINGLE_AMOUNT}`);
  }

  const originatorConversationId = `B2C-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const payload = {
    OriginatorConversationID: originatorConversationId,
    InitiatorName: config.initiatorName,
    SecurityCredential: config.securityCredential,
    CommandID: commandId || 'BusinessPayment',
    Amount: roundedAmount,
    PartyA: config.shortCode,
    PartyB: normalizedPhone,
    Remarks: (remarks || 'Payout').substring(0, 100),
    QueueTimeOutURL: `${config.callbackBaseUrl}/api/callbacks/b2c/timeout`,
    ResultURL: `${config.callbackBaseUrl}/api/callbacks/b2c/result`,
    Occassion: (occasion || '').substring(0, 100),
  };

  console.log('[Daraja B2C] Request:', JSON.stringify({ ...payload, SecurityCredential: '***REDACTED***' }));

  const response = await callDaraja('/mpesa/b2c/v3/paymentrequest', payload);

  if (`${response.ResponseCode || ''}` !== '0') {
    throw new Error(response.ResponseDescription || 'B2C payment initiation failed');
  }

  return {
    originatorConversationId,
    conversationId: response.ConversationID,
    responseCode: response.ResponseCode,
    responseDescription: response.ResponseDescription,
    normalizedPhone,
    amount: roundedAmount,
  };
}

/**
 * Trigger an Account Balance query. Result arrives asynchronously via the ResultURL callback.
 */
async function requestAccountBalanceQuery({ remarks } = {}) {
  const config = getB2CConfig();
  const originatorConversationId = `BAL-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const payload = {
    Initiator: config.initiatorName,
    SecurityCredential: config.securityCredential,
    CommandID: 'AccountBalance',
    PartyA: config.shortCode,
    IdentifierType: '4',
    Remarks: (remarks || 'Balance check').substring(0, 100),
    QueueTimeOutURL: `${config.callbackBaseUrl}/api/callbacks/accountbalance/timeout`,
    ResultURL: `${config.callbackBaseUrl}/api/callbacks/accountbalance/result`,
  };

  const response = await callDaraja('/mpesa/accountbalance/v1/query', payload);

  if (`${response.ResponseCode || ''}` !== '0') {
    throw new Error(response.ResponseDescription || 'Account balance query failed');
  }

  return {
    originatorConversationId,
    conversationId: response.ConversationID,
    responseCode: response.ResponseCode,
    responseDescription: response.ResponseDescription,
  };
}

/**
 * Validate a recipient number before a payout.
 * Daraja returns the registered receiver name asynchronously in the B2C result callback.
 */
async function validateRecipientIdentity({ recipientPhone }) {
  const normalizedPhone = normalizeDarajaPhoneNumber(recipientPhone);
  return {
    normalizedPhone,
    name: null,
    nameAvailableAfterPayout: true,
  };
/*

  const payload = {
    header: {
      requestID: crypto.randomUUID(),
      timestamp: Math.floor(Date.now() / 1000).toString(),
    },
    body: {
      msisdn: normalizedPhone,
      shortcode: config.shortCode,
    },
  };

  const accessToken = await getAccessToken();
  const response = await performJsonRequest(
    { method: 'POST', path: '/mpesa/b2c/hakikisha/v1/hakikisha', headers: { Authorization: `Bearer ${accessToken}` } },
    payload
  );

  if (`${response.header?.status || ''}` !== '200') {
    throw new Error(response.body?.message || response.header?.message || 'Identity validation failed');
  }

  const { firstName, middleName, lastName } = response.body || {};
  const name = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

  return { normalizedPhone, name };
*/
}

module.exports = {
  sendB2CPayment,
  requestAccountBalanceQuery,
  validateRecipientIdentity,
  getB2CConfig,
  MAX_SINGLE_AMOUNT,
  MAX_DAILY_AMOUNT,
};
