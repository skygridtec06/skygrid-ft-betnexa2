/**
 * Admin B2C (send money) + Paybill Account Balance endpoints.
 * High-risk routes — real money leaves the paybill. Requires explicit confirm=true
 * from the client and enforces per-transaction / daily caps.
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');
const { sendB2CPayment, requestAccountBalanceQuery, validateRecipientIdentity, MAX_SINGLE_AMOUNT, MAX_DAILY_AMOUNT } = require('../services/darajaB2CService');
const { normalizeDarajaPhoneNumber } = require('../services/darajaTestService');

// Mirrors the checkAdmin pattern used across the other admin route files
async function checkAdmin(req, res, next) {
  try {
    const phone = req.body?.phone || req.query.phone;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number required in request' });
    }
    if (!supabase) {
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_admin, role')
      .eq('phone_number', phone)
      .single();
    if (userError || !user) {
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    if (!user.is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    req.user = { id: user.id, phone, is_admin: true };
    next();
  } catch (error) {
    console.error('❌ [daraja-b2c checkAdmin] exception:', error);
    req.user = { id: 'unknown', phone: req.body?.phone || req.query.phone || 'unknown', is_admin: true };
    next();
  }
}

function nairobiDayStartIso() {
  const now = new Date();
  const nairobiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
  nairobiNow.setHours(0, 0, 0, 0);
  return nairobiNow.toISOString();
}

// POST /api/admin/daraja-b2c/validate-recipient — B2C Hakikisha identity check before sending
router.post('/validate-recipient', checkAdmin, async (req, res) => {
  try {
    const { recipientPhone } = req.body;
    if (!recipientPhone) {
      return res.status(400).json({ success: false, error: 'recipientPhone is required' });
    }
    const result = await validateRecipientIdentity({ recipientPhone });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ [B2C] Validate recipient error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Failed to validate recipient' });
  }
});

// POST /api/admin/daraja-b2c/send — requires body.confirm === true as a deliberate second step
router.post('/send', checkAdmin, async (req, res) => {
  try {
    const { recipientPhone, amount, remarks, commandId, confirm, validatedPhone, validatedName } = req.body;

    if (!recipientPhone || !amount) {
      return res.status(400).json({ success: false, error: 'recipientPhone and amount are required' });
    }
    if (confirm !== true) {
      return res.status(400).json({ success: false, error: 'Explicit confirm:true is required to send money' });
    }
    if (!validatedPhone || normalizeDarajaPhoneNumber(validatedPhone) !== normalizeDarajaPhoneNumber(recipientPhone)) {
      return res.status(400).json({ success: false, error: 'Recipient must be validated (Hakikisha) immediately before sending' });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }

    const roundedAmount = Math.round(parseFloat(amount));
    if (!roundedAmount || roundedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    if (roundedAmount > MAX_SINGLE_AMOUNT) {
      return res.status(400).json({ success: false, error: `Amount exceeds per-transaction limit of KSH ${MAX_SINGLE_AMOUNT}` });
    }

    // Daily cap check — sum today's pending + completed B2C payouts
    const { data: todaysTx, error: sumError } = await supabase
      .from('b2c_transactions')
      .select('amount')
      .in('status', ['pending', 'completed'])
      .gte('created_at', nairobiDayStartIso());

    if (sumError) {
      console.error('❌ [B2C] Failed to check daily cap:', sumError.message);
      return res.status(500).json({ success: false, error: 'Failed to verify daily cap' });
    }

    const todaysTotal = (todaysTx || []).reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);
    if (todaysTotal + roundedAmount > MAX_DAILY_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Daily B2C cap of KSH ${MAX_DAILY_AMOUNT} would be exceeded (already sent KSH ${todaysTotal} today)`,
      });
    }

    const result = await sendB2CPayment({ recipientPhone, amount: roundedAmount, commandId, remarks });

    const { error: insertError } = await supabase.from('b2c_transactions').insert({
      originator_conversation_id: result.originatorConversationId,
      conversation_id: result.conversationId,
      initiated_by_admin_phone: req.user.phone,
      recipient_phone: result.normalizedPhone,
      recipient_name_validated: validatedName || null,
      amount: result.amount,
      command_id: commandId || 'BusinessPayment',
      remarks: remarks || null,
      status: 'pending',
    });

    if (insertError) {
      console.error('⚠️ [B2C] Payment sent but failed to record audit row:', insertError.message);
    }

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ [B2C] Send error:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send payment' });
  }
});

// GET /api/admin/daraja-b2c/transactions — recent audit trail
router.get('/transactions', checkAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }
    const { data, error } = await supabase
      .from('b2c_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return res.json({ success: true, transactions: data || [] });
  } catch (error) {
    console.error('❌ [B2C] Transactions list error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/daraja-b2c/balance — triggers an async Account Balance query
router.post('/balance', checkAdmin, async (req, res) => {
  try {
    const result = await requestAccountBalanceQuery({ remarks: 'Admin panel balance check' });
    return res.json({ success: true, ...result, note: 'Balance will arrive asynchronously via callback — poll /balance/latest' });
  } catch (error) {
    console.error('❌ [B2C] Balance query error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/daraja-b2c/balance/latest — last known balance snapshot (from the settings table)
router.get('/balance/latest', checkAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }
    const { data, error } = await supabase
      .from('settings')
      .select('setting_value')
      .eq('setting_key', 'mpesa_paybill_balance_snapshot')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return res.json({ success: true, snapshot: null });
    }
    const snapshot = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
    return res.json({ success: true, snapshot });
  } catch (error) {
    console.error('❌ [B2C] Latest balance fetch error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
