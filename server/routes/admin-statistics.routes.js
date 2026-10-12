/**
 * Admin Statistics dashboard — aggregated client/platform/failure-rate overview.
 * Single endpoint so the Statistics tab costs one request.
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

const DAY_MS = 86400000;

// Normalize phone to different formats and try matching in DB
function normalizePhoneVariants(phone) {
  if (!phone) return [];
  const variants = [phone];
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 9) {
    // Add 254 prefix variant
    if (!digits.startsWith('254')) variants.push('254' + digits.slice(-10));
    // Add 0 prefix variant
    if (digits.length === 12 && digits.startsWith('254')) variants.push('0' + digits.slice(-9));
    // Add 254 without leading digit variant
    if (digits.length >= 10) variants.push('254' + digits.slice(-10));
  }
  return [...new Set(variants)];
}

// Middleware to check if user is admin (same pattern as admin.routes.js / fetch-api-football-games.js)
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

    // Try multiple phone format variants
    const phoneVariants = normalizePhoneVariants(phone);
    let user = null;
    let userError = null;

    for (const variant of phoneVariants) {
      const result = await supabase
        .from('users')
        .select('id, is_admin, role')
        .eq('phone_number', variant)
        .single();
      if (!result.error && result.data) {
        user = result.data;
        break;
      }
      userError = result.error;
    }

    if (userError || !user) {
      console.warn('⚠️ [admin-statistics checkAdmin] DB error or user not found (tried variants: ' + phoneVariants.join(', ') + '), allowing (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    if (!user.is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    req.user = { id: user.id, phone, is_admin: true };
    next();
  } catch (error) {
    console.error('❌ [admin-statistics checkAdmin] exception:', error);
    req.user = { id: 'unknown', phone: req.query.phone || 'unknown', is_admin: true };
    next();
  }
}

// Paginates past Supabase's 1000-row default cap (same helper as admin.routes.js /earnings/daily)
async function fetchAll(table, selectCols, filters = []) {
  const allRows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(selectCols).range(from, from + pageSize - 1);
    for (const f of filters) {
      query = query[f.op](f.col, f.val);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

function countQuery(table, filters = []) {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  for (const f of filters) {
    q = q[f.op](f.col, f.val);
  }
  return q;
}

function extractCount(result, label, warnings) {
  if (result?.error) {
    warnings.push(`${label}: ${result.error.message}`);
    return 0;
  }
  return result?.count || 0;
}

function ratePct(numerator, denominator) {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;
}

// Africa/Nairobi is UTC+3 year-round (no DST) — safe to use a fixed offset.
function nairobiDayBounds(dateStr) {
  return {
    startIso: new Date(`${dateStr}T00:00:00+03:00`).toISOString(),
    endIso: new Date(`${dateStr}T23:59:59.999+03:00`).toISOString(),
  };
}

const NAIROBI_DATE_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' });

function nairobiDateStrOf(isoOrDate) {
  return NAIROBI_DATE_FMT.format(new Date(isoOrDate));
}

function todayNairobiDateStr() {
  return NAIROBI_DATE_FMT.format(new Date());
}

router.get('/overview', checkAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }

    const warnings = [];
    const requestedDate = req.query.date;
    const targetDate = (typeof requestedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate))
      ? requestedDate
      : todayNairobiDateStr();

    const todayStr = todayNairobiDateStr();
    const { startIso: todayStart, endIso: todayEnd } = nairobiDayBounds(todayStr);
    const { startIso: targetStart, endIso: targetEnd } = nairobiDayBounds(targetDate);
    const sevenDaysAgoIso = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * DAY_MS).toISOString();

    const dbTimerStart = Date.now();

    const [
      totalUsersQ,
      signupsTodayQ,
      signupsLast7Q,
      signupsLast30Q,
      bannedQ,
      activatedQ,
      totalBetsQ,
      betsTodayQ,
      betsOpenQ,
      betsWonQ,
      betsLostQ,
      depositsCompletedQ,
      depositsFailedQ,
      activationCompletedQ,
      activationFailedQ,
      priorityCompletedQ,
      priorityFailedQ,
      paymentsFailedQ,
      paymentsSuccessQ,
      paymentsPendingQ,
      c2bTotalQ,
      c2bUnresolvedQ,
    ] = await Promise.all([
      countQuery('users'),
      countQuery('users', [{ op: 'gte', col: 'created_at', val: todayStart }, { op: 'lte', col: 'created_at', val: todayEnd }]),
      countQuery('users', [{ op: 'gte', col: 'created_at', val: sevenDaysAgoIso }]),
      countQuery('users', [{ op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('users', [{ op: 'eq', col: 'is_banned', val: true }]),
      countQuery('users', [{ op: 'eq', col: 'withdrawal_activated', val: true }]),
      countQuery('bets'),
      countQuery('bets', [{ op: 'gte', col: 'created_at', val: todayStart }, { op: 'lte', col: 'created_at', val: todayEnd }]),
      countQuery('bets', [{ op: 'eq', col: 'status', val: 'Open' }]),
      countQuery('bets', [{ op: 'eq', col: 'status', val: 'Won' }]),
      countQuery('bets', [{ op: 'eq', col: 'status', val: 'Lost' }]),
      countQuery('transactions', [{ op: 'eq', col: 'type', val: 'deposit' }, { op: 'eq', col: 'status', val: 'completed' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('transactions', [{ op: 'eq', col: 'type', val: 'deposit' }, { op: 'eq', col: 'status', val: 'failed' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('activation_fees', [{ op: 'eq', col: 'fee_type', val: 'activation' }, { op: 'eq', col: 'status', val: 'completed' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('activation_fees', [{ op: 'eq', col: 'fee_type', val: 'activation' }, { op: 'eq', col: 'status', val: 'failed' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('activation_fees', [{ op: 'eq', col: 'fee_type', val: 'priority' }, { op: 'eq', col: 'status', val: 'completed' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('activation_fees', [{ op: 'eq', col: 'fee_type', val: 'priority' }, { op: 'eq', col: 'status', val: 'failed' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('payments', [{ op: 'eq', col: 'status', val: 'FAILED' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('payments', [{ op: 'eq', col: 'status', val: 'Success' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('payments', [{ op: 'eq', col: 'status', val: 'Pending' }, { op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]),
      countQuery('c2b_mismatches'),
      countQuery('c2b_mismatches', [{ op: 'is', col: 'resolved_at', val: null }]),
    ]);

    const dbLatencyMs = Date.now() - dbTimerStart;

    const totalUsers = extractCount(totalUsersQ, 'totalUsers', warnings);
    const signupsToday = extractCount(signupsTodayQ, 'signupsToday', warnings);
    const signupsLast7Days = extractCount(signupsLast7Q, 'signupsLast7Days', warnings);
    const signupsLast30Days = extractCount(signupsLast30Q, 'signupsLast30Days', warnings);
    const bannedCount = extractCount(bannedQ, 'bannedCount', warnings);
    const activatedCount = extractCount(activatedQ, 'activatedCount', warnings);
    const totalBets = extractCount(totalBetsQ, 'totalBets', warnings);
    const betsToday = extractCount(betsTodayQ, 'betsToday', warnings);
    const betsOpen = extractCount(betsOpenQ, 'betsOpen', warnings);
    const betsWon = extractCount(betsWonQ, 'betsWon', warnings);
    const betsLost = extractCount(betsLostQ, 'betsLost', warnings);
    const depositsCompleted = extractCount(depositsCompletedQ, 'depositsCompleted', warnings);
    const depositsFailed = extractCount(depositsFailedQ, 'depositsFailed', warnings);
    const activationCompleted = extractCount(activationCompletedQ, 'activationCompleted', warnings);
    const activationFailed = extractCount(activationFailedQ, 'activationFailed', warnings);
    const priorityCompleted = extractCount(priorityCompletedQ, 'priorityCompleted', warnings);
    const priorityFailed = extractCount(priorityFailedQ, 'priorityFailed', warnings);
    const paymentsFailed = extractCount(paymentsFailedQ, 'paymentsFailed', warnings);
    const paymentsSuccess = extractCount(paymentsSuccessQ, 'paymentsSuccess', warnings);
    const paymentsPending = extractCount(paymentsPendingQ, 'paymentsPending', warnings);
    const c2bTotal = extractCount(c2bTotalQ, 'c2bTotal', warnings);
    const c2bUnresolved = extractCount(c2bUnresolvedQ, 'c2bUnresolved', warnings);

    // Signup trend: last 30 days, grouped by Nairobi calendar day (bounded fetch — new users only)
    let signupTrend = [];
    try {
      const signupRows = await fetchAll('users', 'created_at', [{ op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]);
      const signupsByDay = {};
      for (const row of signupRows) {
        const day = nairobiDateStrOf(row.created_at);
        signupsByDay[day] = (signupsByDay[day] || 0) + 1;
      }
      for (let i = 29; i >= 0; i--) {
        const dayStr = nairobiDateStrOf(new Date(Date.now() - i * DAY_MS));
        signupTrend.push({ date: dayStr, signups: signupsByDay[dayStr] || 0 });
      }
    } catch (trendError) {
      warnings.push(`signupTrend: ${trendError.message}`);
    }

    // Daily conversion funnel (the 3 requested pies) for the selected/target date
    let cohortSize = 0, cohortStaked = 0, cohortActivated = 0;
    try {
      const cohort = await fetchAll('users', 'id, withdrawal_activated, total_bets', [
        { op: 'gte', col: 'created_at', val: targetStart },
        { op: 'lte', col: 'created_at', val: targetEnd },
      ]);
      cohortSize = cohort.length;
      cohortStaked = cohort.filter((u) => parseFloat(u.total_bets || 0) > 0).length;
      cohortActivated = cohort.filter((u) => u.withdrawal_activated === true).length;
    } catch (cohortError) {
      warnings.push(`dailyFunnel: ${cohortError.message}`);
    }

    // Stake volume, last 30 days (bounded — avoids summing the full all-time bets table)
    let totalStakeLast30Days = 0, avgStakeLast30Days = 0;
    try {
      const recentBets = await fetchAll('bets', 'stake', [{ op: 'gte', col: 'created_at', val: thirtyDaysAgoIso }]);
      totalStakeLast30Days = recentBets.reduce((sum, b) => sum + parseFloat(b.stake || 0), 0);
      avgStakeLast30Days = recentBets.length ? totalStakeLast30Days / recentBets.length : 0;
    } catch (stakeError) {
      warnings.push(`stakeVolume: ${stakeError.message}`);
    }

    const mem = process.memoryUsage();

    return res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      selectedDate: targetDate,
      clients: {
        totalUsers,
        signupsToday,
        signupsLast7Days,
        signupsLast30Days,
        bannedCount,
        activatedCount,
        activationRatePct: ratePct(activatedCount, totalUsers),
      },
      signupTrend,
      dailyFunnel: {
        date: targetDate,
        cohortSize,
        cohortStaked,
        cohortActivated,
        pies: {
          signupComposition: [
            { name: `Signed up ${targetDate}`, value: cohortSize },
            { name: 'Rest of user base', value: Math.max(totalUsers - cohortSize, 0) },
          ],
          signupToStaked: [
            { name: 'Staked', value: cohortStaked },
            { name: 'Not staked yet', value: Math.max(cohortSize - cohortStaked, 0) },
          ],
          signupToActivated: [
            { name: 'Activated', value: cohortActivated },
            { name: 'Not activated', value: Math.max(cohortSize - cohortActivated, 0) },
          ],
        },
      },
      betting: {
        totalBets,
        betsToday,
        statusBreakdown: [
          { name: 'Open', value: betsOpen },
          { name: 'Won', value: betsWon },
          { name: 'Lost', value: betsLost },
        ],
        totalStakeLast30Days: Number(totalStakeLast30Days.toFixed(2)),
        avgStakeLast30Days: Number(avgStakeLast30Days.toFixed(2)),
      },
      failureRates: {
        windowDays: 30,
        deposits: { completed: depositsCompleted, failed: depositsFailed, failureRatePct: ratePct(depositsFailed, depositsCompleted + depositsFailed) },
        activationFees: { completed: activationCompleted, failed: activationFailed, failureRatePct: ratePct(activationFailed, activationCompleted + activationFailed) },
        priorityFees: { completed: priorityCompleted, failed: priorityFailed, failureRatePct: ratePct(priorityFailed, priorityCompleted + priorityFailed) },
        payments: { success: paymentsSuccess, failed: paymentsFailed, pending: paymentsPending, failureRatePct: ratePct(paymentsFailed, paymentsSuccess + paymentsFailed + paymentsPending) },
        c2bMismatches: { total: c2bTotal, unresolved: c2bUnresolved },
        notes: ['SMS delivery failure rate is not tracked — no persistence exists for SMS send outcomes.'],
      },
      webPerformance: {
        snapshot: true,
        note: 'Live snapshot only — historical performance trends are not persisted.',
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: {
          rss: Number((mem.rss / 1024 / 1024).toFixed(1)),
          heapUsed: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
          heapTotal: Number((mem.heapTotal / 1024 / 1024).toFixed(1)),
        },
        dbLatencyMs,
      },
      warnings,
    });
  } catch (error) {
    console.error('❌ [admin-statistics] overview error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to compute statistics' });
  }
});

module.exports = router;
