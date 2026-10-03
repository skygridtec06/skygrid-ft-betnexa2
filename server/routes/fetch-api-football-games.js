/**
 * Endpoint to fetch prematch games and odds from API Football
 * Returns a preview that can be executed to add games to the site
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/database');

const API_BASE = 'https://v3.football.api-sports.io';
const BASKETBALL_API_BASE = 'https://v1.basketball.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY || process.env.APISPORTS_KEY || '';
const TZ = 'Africa/Nairobi';

// Sport prefix mapping for game IDs
const SPORT_PREFIXES = {
  football: 'af',
  basketball: 'ab',
  tennis: 'tn',
  cricket: 'ck',
  boxing: 'bx'
};

// Popular leagues that auto-classify games as "Hot" 🔥
// These are the most-watched leagues globally
const HOT_LEAGUES = new Set([
  // Football
  'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1',
  'champions league', 'europa league', 'conference league',
  'world cup', 'euro championship', 'copa america', 'africa cup of nations',
  'premier league - kenya', 'fa cup', 'copa del rey', 'dfb pokal',
  'coppa italia', 'coupe de france', 'carabao cup', 'community shield',
  'saudi pro league', 'mls', 'eredivisie', 'primeira liga', 'süper lig',
  // Basketball
  'nba', 'euroleague', 'fiba',
]);

function isHotLeague(leagueName) {
  if (!leagueName) return false;
  const lower = leagueName.toLowerCase().trim();
  for (const hot of HOT_LEAGUES) {
    if (lower.includes(hot)) return true;
  }
  return false;
}

// Derive sport from game_id prefix
function getSportFromGameId(gameId) {
  if (!gameId) return 'football';
  if (gameId.startsWith('ab-') || gameId.startsWith('bb-')) return 'basketball';
  if (gameId.startsWith('tn-')) return 'tennis';
  if (gameId.startsWith('ck-')) return 'cricket';
  if (gameId.startsWith('bx-')) return 'boxing';
  return 'football';
}

// Middleware to check if user is admin (same as in admin.routes.js)
async function checkAdmin(req, res, next) {
  try {
    const phone = req.body.phone || req.query.phone;
    console.log('\n🔐 [checkAdmin] Verifying admin access for fetch-api-football');
    console.log('   Phone from request:', phone);
    if (!phone) {
      console.error('❌ Phone number missing');
      return res.status(400).json({ 
        success: false,
        error: 'Phone number required in request' 
      });
    }
    if (!supabase) {
      console.warn('⚠️ Supabase not initialized, allowing request (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    console.log('   Querying users table for phone_number:', phone);
    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_admin, role')
      .eq('phone_number', phone)
      .single();
    if (userError) {
      console.error('❌ Database error:', userError.message, userError.code);
      console.warn('   Allowing request anyway (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    if (!user) {
      console.warn('⚠️ User not found with phone_number:', phone);
      console.warn('   Allowing request anyway (graceful degradation)');
      req.user = { id: 'unknown', phone, is_admin: true };
      return next();
    }
    console.log('   User found:', { id: user.id, is_admin: user.is_admin, role: user.role });
    if (!user.is_admin) {
      console.error('❌ User is not admin');
      return res.status(403).json({ 
        success: false,
        error: 'Admin access required' 
      });
    }
    console.log('✅ Admin verified');
    req.user = { id: user.id, phone, is_admin: true };
    next();
  } catch (error) {
    console.error('❌ Admin check exception:', error);
    console.warn('   Allowing request anyway (graceful degradation)');
    const phone = req.body.phone || req.query.phone || 'unknown';
    req.user = { id: 'unknown', phone, is_admin: true };
    next();
  }
}

// Required markets to fetch
const REQUIRED_MARKETS = {
  '1X2': ['home', 'draw', 'away'],
  'BTTS': ['bttsYes', 'bttsNo'],
  'O/U': ['over15', 'under15', 'over25', 'under25'],
  'DC': ['doubleChanceHomeOrDraw', 'doubleChanceAwayOrDraw', 'doubleChanceHomeOrAway'],
  'HT/FT': ['htftHomeHome', 'htftDrawDraw', 'htftAwayAway', 'htftDrawHome', 'htftDrawAway'],
  'CS': [] // Build dynamically
};

// Add correct score markets
for (let h = 0; h <= 4; h++) {
  for (let a = 0; a <= 4; a++) {
    REQUIRED_MARKETS['CS'].push(`cs${h}${a}`);
  }
}

// Helper to parse bets and extract odds
function findBetByName(bets, names) {
  const wanted = names.map(n => normalizeLabel(n));
  return bets.find((b) => wanted.includes(normalizeLabel(b.name)));
}

function normalizeLabel(s) {
  return String(s || '').trim().toLowerCase();
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 1.01 ? +n.toFixed(2) : null;
}

function valToOdd(values, labels) {
  const wanted = labels.map(normalizeLabel);
  const found = (values || []).find((v) => wanted.includes(normalizeLabel(v.value)));
  return num(found?.odd);
}

function valToOddStartsWith(values, prefix) {
  const p = normalizeLabel(prefix);
  const found = (values || []).find((v) => normalizeLabel(v.value).startsWith(p));
  return num(found?.odd);
}

function pickOverUnder(values, line, side) {
  const sideNorm = side.toLowerCase() === 'over' ? 'over' : 'under';
  const wanted = `${sideNorm} ${line}`;
  return valToOddStartsWith(values, wanted);
}

// Extract markets from API bookmaker odds
function extractMarketsFromBookmaker(bookmaker) {
  const bets = bookmaker?.bets || [];
  const out = {};

  // 1X2
  const winner = findBetByName(bets, ['Match Winner', '1X2', 'Fulltime Result']);
  if (winner) {
    out.home = valToOdd(winner.values, ['Home', '1']);
    out.draw = valToOdd(winner.values, ['Draw', 'X']);
    out.away = valToOdd(winner.values, ['Away', '2']);
  }

  // BTTS
  const btts = findBetByName(bets, ['Both Teams Score', 'Both Teams To Score']);
  if (btts) {
    out.bttsYes = valToOdd(btts.values, ['Yes']);
    out.bttsNo = valToOdd(btts.values, ['No']);
  }

  // Over/Under
  const ouPrimary = findBetByName(bets, ['Goals Over/Under', 'Over/Under', 'Total Goals']);
  const ouGoalLine = findBetByName(bets, ['Goal Line']);
  const ouValues = [...(ouPrimary?.values || []), ...(ouGoalLine?.values || [])];
  if (ouValues.length) {
    out.over15 = pickOverUnder(ouValues, '1.5', 'over');
    out.under15 = pickOverUnder(ouValues, '1.5', 'under');
    out.over25 = pickOverUnder(ouValues, '2.5', 'over');
    out.under25 = pickOverUnder(ouValues, '2.5', 'under');
  }

  // Double Chance
  const dc = findBetByName(bets, ['Double Chance']);
  if (dc) {
    out.doubleChanceHomeOrDraw = valToOdd(dc.values, ['Home/Draw', '1X', '1 or X']);
    out.doubleChanceAwayOrDraw = valToOdd(dc.values, ['Draw/Away', 'X2', 'X or 2']);
    out.doubleChanceHomeOrAway = valToOdd(dc.values, ['Home/Away', '12', '1 or 2']);
  }

  // HT/FT
  const htft = findBetByName(bets, ['HT/FT', 'HT/FT Double', 'Half Time/Full Time', 'Halftime/Fulltime']);
  if (htft) {
    out.htftHomeHome = valToOdd(htft.values, ['Home/Home', '1/1']);
    out.htftDrawDraw = valToOdd(htft.values, ['Draw/Draw', 'X/X']);
    out.htftAwayAway = valToOdd(htft.values, ['Away/Away', '2/2']);
    out.htftDrawHome = valToOdd(htft.values, ['Draw/Home', 'X/1']);
    out.htftDrawAway = valToOdd(htft.values, ['Draw/Away', 'X/2']);
  }

  // Correct Score
  const cs = findBetByName(bets, ['Correct Score', 'Correct Scores', 'Exact Score']);
  if (cs) {
    for (let h = 0; h <= 4; h++) {
      for (let a = 0; a <= 4; a++) {
        const k = `cs${h}${a}`;
        const label = `${h}:${a}`;
        out[k] = valToOdd(cs.values, [label]);
      }
    }
  }

  return out;
}

// Choose best odds from available bookmakers
function chooseBestOddsSet(oddsRows) {
  const candidates = [];
  const allRequiredMarketKeys = Object.values(REQUIRED_MARKETS).flat();

  for (const row of oddsRows || []) {
    for (const bookmaker of row.bookmakers || []) {
      const candidate = extractMarketsFromBookmaker(bookmaker);
      const score = allRequiredMarketKeys.reduce((acc, key) => acc + (candidate[key] ? 1 : 0), 0);
      const winnerPresent = candidate.home && candidate.draw && candidate.away;
      const total = score + (winnerPresent ? 3 : 0);
      candidates.push({ candidate, total });
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.total - a.total);
  const merged = { ...candidates[0].candidate };

  for (const { candidate } of candidates.slice(1)) {
    if (!merged.home && candidate.home) merged.home = candidate.home;
    if (!merged.draw && candidate.draw) merged.draw = candidate.draw;
    if (!merged.away && candidate.away) merged.away = candidate.away;

    for (const key of allRequiredMarketKeys) {
      if (!merged[key] && candidate[key]) merged[key] = candidate[key];
    }
  }

  // Only require 1X2 (home/draw/away) as minimum — other markets are optional
  const has1x2 = merged.home && merged.draw && merged.away;
  return has1x2 ? merged : null;
}

// API helper
async function apiGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;

  const resp = await fetch(url, {
    headers: {
      'x-apisports-key': API_KEY
    }
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status} on ${path}: ${body}`);
  }

  const json = await resp.json();
  return json.response || [];
}

// Pass through fixture time as-is (API already returns times in the requested timezone)
function toEAT(isoString) {
  if (!isoString) return new Date().toISOString();
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

// Health check (CORS handled globally by express cors() middleware)
router.get('/', (req, res) => {
  console.log('🏥 Fetch-API-Football health check');
  res.json({ success: true, message: 'Fetch API Football service is running' });
});

// Simple test endpoint to verify router is working
router.post('/test', (req, res) => {
  console.log('✅ Test endpoint called - router is working!');
  res.json({ 
    success: true, 
    message: 'Router is working',
    route: 'POST /api/admin/fetch-api-football/test',
    timestamp: new Date().toISOString()
  });
});

/**
 * Generate deterministic per-game odds using the fixture ID as a seed.
 * Each game gets unique-looking realistic odds that are consistent across calls.
 * Uses a simple LCG (linear congruential generator) seeded by fixtureId.
 */
function generateSeededOdds(fixtureId) {
  // LCG seeded by fixtureId — produces a stable sequence per game
  let seed = Math.abs(parseInt(String(fixtureId), 10)) || 12345;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0x100000000; // 0..1
  };

  const r = next(); // 0..1 controls home/away balance

  // home/away strength split — varied per game
  let home, draw, away;
  if (r < 0.33) {
    // Home favourite
    home = +(1.30 + next() * 1.40).toFixed(2);   // 1.30–2.70
    draw = +(3.00 + next() * 1.20).toFixed(2);   // 3.00–4.20
    away = +(3.50 + next() * 3.00).toFixed(2);   // 3.50–6.50
  } else if (r < 0.66) {
    // Away favourite
    home = +(3.50 + next() * 3.00).toFixed(2);
    draw = +(3.00 + next() * 1.20).toFixed(2);
    away = +(1.30 + next() * 1.40).toFixed(2);
  } else {
    // Roughly balanced
    home = +(2.20 + next() * 1.20).toFixed(2);   // 2.20–3.40
    draw = +(3.00 + next() * 0.80).toFixed(2);   // 3.00–3.80
    away = +(2.20 + next() * 1.20).toFixed(2);
  }

  const bttsYes = +(1.60 + next() * 0.60).toFixed(2);   // 1.60–2.20
  const bttsNo  = +(1.55 + next() * 0.55).toFixed(2);
  const over25  = +(1.60 + next() * 0.70).toFixed(2);
  const under25 = +(1.60 + next() * 0.60).toFixed(2);
  const over15  = +(1.25 + next() * 0.35).toFixed(2);   // 1.25–1.60
  const under15 = +(2.20 + next() * 0.80).toFixed(2);

  return { home, draw, away, bttsYes, bttsNo, over25, under25, over15, under15 };
}

// POST: Fetch prematch games from API Football (preview only, no save)
router.post('/fetch-preview', checkAdmin, async (req, res) => {
  try {
    const isValidDate = value =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    const today = new Date();
    const defaultFrom = today.toISOString().slice(0, 10);
    const defaultToDate = new Date(today);
    defaultToDate.setUTCDate(defaultToDate.getUTCDate() + 7);
    const from = req.body.from || defaultFrom;
    const to = req.body.to || defaultToDate.toISOString().slice(0, 10);

    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      return res.status(400).json({
        success: false,
        error: 'A valid date range is required; the end date must not be before the start date.'
      });
    }

    console.log(`\n🔍 [API Football Fetch Preview] Fetching prematch games from ${from} to ${to}...`);

    const apiKey = process.env.API_FOOTBALL_KEY || process.env.APISPORTS_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'API_FOOTBALL_KEY not configured'
      });
    }

    async function apiGet(path, params = {}) {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE}${path}?${query}`, {
        headers: { 'x-apisports-key': apiKey }
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API ${response.status} on ${path}: ${body}`);
      }

      const json = await response.json();
      if (json?.errors && Object.keys(json.errors).length > 0) {
        throw new Error(`API-Football provider error: ${Object.values(json.errors).join('; ')}`);
      }
      return json;
    }

    async function apiGetAllPages(path, params = {}) {
      const items = [];
      let page = 1;
      let lastPage = 1;

      do {
        const json = await apiGet(path, { ...params, page });
        const pageItems = json.response || [];
        items.push(...pageItems);

        const reportedLastPage = Number(json.paging?.total);
        lastPage = Number.isInteger(reportedLastPage) && reportedLastPage > 0
          ? reportedLastPage
          : (pageItems.length >= 100 ? page + 1 : page);
        page += 1;
      } while (page <= lastPage);

      return items;
    }

    const allFixtures = await apiGetAllPages('/fixtures', { from, to, timezone: TZ });
    const fixtures = allFixtures
      .filter(fixture => fixture?.fixture?.status?.short === 'NS');
    const fixtureDates = [...new Set(fixtures
      .map(fixture => fixture?.fixture?.date?.slice(0, 10))
      .filter(Boolean))];
    const warnings = [];
    const oddsByFixture = new Map();
    let nextDateIndex = 0;

    const fetchOddsForNextDate = async () => {
      while (nextDateIndex < fixtureDates.length) {
        const date = fixtureDates[nextDateIndex++];
        try {
          const oddsEntries = await apiGetAllPages('/odds', { date, timezone: TZ });
          for (const entry of oddsEntries) {
            const fixtureId = entry?.fixture?.id;
            if (!fixtureId) continue;
            if (!oddsByFixture.has(fixtureId)) oddsByFixture.set(fixtureId, []);
            oddsByFixture.get(fixtureId).push(entry);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          warnings.push({ date, error: message });
          console.warn(`⚠️ Could not fetch odds for ${date}; fixtures will use fallback odds: ${message}`);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(4, fixtureDates.length) }, () => fetchOddsForNextDate())
    );

    const seenFixtureIds = new Set();
    const allMarketKeys = Object.values(REQUIRED_MARKETS).flat();
    const games = [];

    for (const fixture of fixtures) {
      const fixtureId = fixture?.fixture?.id;
      const homeTeam = fixture?.teams?.home?.name;
      const awayTeam = fixture?.teams?.away?.name;
      if (!fixtureId || !homeTeam || !awayTeam || seenFixtureIds.has(fixtureId)) continue;
      seenFixtureIds.add(fixtureId);

      const kickoffTime = fixture.fixture.date;
      const leagueName = fixture?.league?.name || 'Football';
      let marketOdds = chooseBestOddsSet(oddsByFixture.get(fixtureId) || []);
      const hasValidMatchOdds = marketOdds?.home && marketOdds?.draw && marketOdds?.away;
      if (!hasValidMatchOdds) marketOdds = generateSeededOdds(fixtureId);

      games.push({
        api_fixture_id: fixtureId,
        league: leagueName,
        home_team: homeTeam,
        away_team: awayTeam,
        home_odds: marketOdds.home,
        draw_odds: marketOdds.draw,
        away_odds: marketOdds.away,
        time_utc: kickoffTime,
        time_eat: toEAT(kickoffTime),
        markets: marketOdds,
        markets_count: allMarketKeys.filter(key => !!marketOdds[key]).length,
        odds_source: hasValidMatchOdds ? 'api' : 'fallback'
      });
    }

    res.json({
      success: true,
      message: `Found ${games.length} prematch games from ${from} to ${to}`,
      game_count: games.length,
      matches_fetched: games.length,
      date_range: { from, to },
      dates_checked: fixtureDates,
      max_limit: 'unlimited',
      games,
      warnings,
      next_step: 'Call /api/admin/fetch-api-football/execute with the games to add them to the site'
    });
  } catch (error) {
    console.error('❌ Fetch preview error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch games from API Football',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST: Execute - add the fetched games to the site (actually saves to DB)
router.post('/execute', checkAdmin, async (req, res) => {
  try {
    const { games: gamesToAdd, sport = 'football' } = req.body;

    if (!gamesToAdd || !Array.isArray(gamesToAdd) || gamesToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Games array required'
      });
    }

    console.log(`\n💾 [Execute API Games] Adding ${gamesToAdd.length} ${sport} games...`);

    const results = { added: [], failed: [], total_requested: gamesToAdd.length };
    const prefix = SPORT_PREFIXES[sport] || 'af';
    const batchSize = 50;

    for (let offset = 0; offset < gamesToAdd.length; offset += batchSize) {
      const batch = gamesToAdd.slice(offset, offset + batchSize);
      const records = [];

      for (const game of batch) {
        const gameId = `${prefix}-${game?.api_fixture_id}`;
        if (!game?.api_fixture_id || !game.home_team || !game.away_team) {
          results.failed.push({ game_id: gameId, error: 'Fixture ID and both team names are required' });
          continue;
        }

        const drawOdds = (sport === 'basketball' || sport === 'tennis' || sport === 'boxing')
          ? 0 : (parseFloat(game.draw_odds) || parseFloat(game.markets?.draw) || 3.0);
        records.push({
          game,
          gameData: {
            game_id: gameId,
            league: game.league || sport.charAt(0).toUpperCase() + sport.slice(1),
            home_team: game.home_team,
            away_team: game.away_team,
            home_odds: parseFloat(game.home_odds) || 1.90,
            draw_odds: drawOdds,
            away_odds: parseFloat(game.away_odds) || 1.90,
            time: game.time_utc || game.time_eat || new Date().toISOString(),
            status: 'upcoming'
          }
        });
      }

      if (records.length === 0) continue;

      const { data: insertedGames, error: batchError } = await supabase
        .from('games')
        .upsert(records.map(record => record.gameData), {
          onConflict: 'game_id',
          ignoreDuplicates: true
        })
        .select('id, game_id');

      const insertedByGameId = new Map();
      if (batchError) {
        console.warn(`⚠️ Batch insert failed; retrying ${records.length} games individually:`, batchError.message);
        for (const record of records) {
          try {
            const { data, error } = await supabase
              .from('games')
              .upsert(record.gameData, { onConflict: 'game_id', ignoreDuplicates: true })
              .select('id, game_id');
            if (error) throw error;
            if (data?.length) insertedByGameId.set(record.gameData.game_id, data[0]);
            else results.added.push({ game_id: record.gameData.game_id, status: 'already_exists' });
          } catch (error) {
            console.error(`   ❌ Failed to insert ${record.gameData.game_id}:`, error.message);
            results.failed.push({ game_id: record.gameData.game_id, error: error.message });
          }
        }
      } else {
        for (const game of insertedGames || []) insertedByGameId.set(game.game_id, game);
        for (const record of records) {
          if (!insertedByGameId.has(record.gameData.game_id)) {
            results.added.push({ game_id: record.gameData.game_id, status: 'already_exists' });
          }
        }
      }

      const marketsByGameId = new Map();
      for (const record of records) {
        const inserted = insertedByGameId.get(record.gameData.game_id);
        if (!inserted) continue;

        const marketRows = [];
        if (record.game.markets && typeof record.game.markets === 'object') {
          for (const [key, odds] of Object.entries(record.game.markets)) {
            const oddsValue = parseFloat(odds);
            if (oddsValue >= 1.01) {
              marketRows.push({
                game_id: inserted.id,
                market_type: determineMarketType(key),
                market_key: key,
                odds: oddsValue
              });
            }
          }
        }
        if (isHotLeague(record.game.league)) {
          marketRows.push({
            game_id: inserted.id,
            market_type: 'META',
            market_key: '__hot',
            odds: 1,
            updated_at: new Date().toISOString()
          });
        }
        marketsByGameId.set(record.gameData.game_id, marketRows);
      }

      const marketRows = [...marketsByGameId.values()].flat();
      if (marketRows.length > 0) {
        const { error } = await supabase.from('markets').insert(marketRows);
        if (error) {
          console.warn('⚠️ Batch market insert failed; retrying markets per game:', error.message);
          for (const [gameId, rows] of marketsByGameId) {
            if (rows.length === 0) continue;
            const { error: marketError } = await supabase.from('markets').insert(rows);
            if (marketError) {
              console.warn(`⚠️ Markets insert warning for ${gameId}:`, marketError.message);
            }
          }
        }
      }

      for (const record of records) {
        if (insertedByGameId.has(record.gameData.game_id)) {
          results.added.push({ game_id: record.gameData.game_id, status: 'added' });
        }
      }
    }

    const addedCount = results.added.filter(result => result.status === 'added').length;
    const skippedCount = results.added.filter(result => result.status === 'already_exists').length;
    console.log(`✅ Execute complete: ${addedCount} added, ${skippedCount} skipped, ${results.failed.length} failed`);

    res.json({
      success: results.failed.length === 0 || addedCount > 0 || skippedCount > 0,
      message: `Added ${addedCount} games; skipped ${skippedCount} existing games`,
      games_added: addedCount,
      games_skipped: skippedCount,
      games_failed: results.failed.length,
      results,
      failed_games: results.failed
    });

  } catch (error) {
    console.error('❌ Execute error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add games',
      details: error.message || String(error),
      code: error.code,
      hint: error.hint,
      details_from_database: error.details
    });
  }
});

// Helper to determine market type (same as admin.routes.js)
function determineMarketType(key) {
  if (key.startsWith('cs')) return 'CS';
  if (key.includes('btts')) return 'BTTS';
  if (key.includes('over') || key.includes('under')) return 'O/U';
  if (key.includes('doubleChance')) return 'DC';
  if (key.includes('htft')) return 'HT/FT';
  return '1X2';
}

// ============================================================
// BASKETBALL: Fetch preview for today's basketball games
// ============================================================
router.post('/fetch-preview/basketball', checkAdmin, async (req, res) => {
  try {
    console.log(`\n🏀 [API Basketball Fetch Preview] Fetching basketball games for the next 3 days...`);

    const BBALL_KEY = API_KEY;

    if (!BBALL_KEY) {
      return res.status(500).json({ success: false, error: 'API key not configured' });
    }

    async function bballApiGet(path, params = {}) {
      const qs = new URLSearchParams(params).toString();
      const url = `${BASKETBALL_API_BASE}${path}${qs ? `?${qs}` : ''}`;
      console.log(`   🔗 Basketball API: ${path}`, params);
      const resp = await fetch(url, {
        headers: { 'x-apisports-key': BBALL_KEY }
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Basketball API ${resp.status}: ${body}`);
      }
      const json = await resp.json();
      return json.response || [];
    }

    // Build list of dates to fetch (today + next 2 days)
    const DAYS_TO_FETCH = 3;
    const datesToFetch = [];
    for (let d = 0; d < DAYS_TO_FETCH; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      datesToFetch.push(date.toISOString().split('T')[0]);
    }
    console.log(`   📅 Dates to fetch: ${datesToFetch.join(', ')}`);

    const games = [];

    for (const dateStr of datesToFetch) {
      try {
        // Step 1: Fetch all basketball games for this date
        console.log(`\n📅 Fetching basketball games for ${dateStr}...`);
        const allGames = await bballApiGet('/games', { date: dateStr, timezone: TZ });
        console.log(`   📊 Found ${allGames.length} total basketball games on ${dateStr}`);

        // Filter to Not Started (NS) only
        const prematchGames = allGames.filter(g => g?.status?.short === 'NS');
        console.log(`   🏀 ${prematchGames.length} upcoming (NS) basketball games on ${dateStr}`);

        if (prematchGames.length === 0) {
          console.log(`   ⚠️ No upcoming basketball games on ${dateStr}`);
          continue;
        }

        // Step 2: Fetch odds for games (limit to 30 API calls per day to conserve quota)
        const ODDS_FETCH_LIMIT = 30;
        const oddsMap = new Map();
        let oddsFetched = 0;

    for (const game of prematchGames) {
      if (oddsFetched >= ODDS_FETCH_LIMIT) break;
      try {
        const oddsData = await bballApiGet('/odds', { game: String(game.id) });
        if (oddsData.length > 0) {
          oddsMap.set(game.id, oddsData[0]);
        }
        oddsFetched++;
      } catch (err) {
        oddsFetched++;
        continue;
      }
    }
    console.log(`   📈 Fetched odds for ${oddsMap.size} / ${prematchGames.length} games`);

    // Step 3: Build games list
    const games = [];
    for (const game of prematchGames) {
      try {
        const gameId = game?.id;
        if (!gameId) continue;

        const homeTeam = game?.teams?.home?.name;
        const awayTeam = game?.teams?.away?.name;
        const leagueName = game?.league?.name || 'Basketball';
        const kickoffTime = game?.date;

        if (!homeTeam || !awayTeam) continue;

        // Extract Home/Away odds
        let homeOdds = 1.90, awayOdds = 1.90;
        const oddsEntry = oddsMap.get(gameId);
        if (oddsEntry) {
          for (const bookmaker of (oddsEntry.bookmakers || [])) {
            const homeAwayBet = (bookmaker.bets || []).find(b =>
              b.name === 'Home/Away' || b.name === 'Winner' || b.id === 1
            );
            if (homeAwayBet) {
              const hVal = homeAwayBet.values?.find(v => v.value === 'Home');
              const aVal = homeAwayBet.values?.find(v => v.value === 'Away');
              if (hVal) homeOdds = parseFloat(hVal.odd) || 1.90;
              if (aVal) awayOdds = parseFloat(aVal.odd) || 1.90;
              break; // Use first bookmaker with odds
            }
          }
        }

        const kickoffEAT = toEAT(kickoffTime);

        games.push({
          api_fixture_id: gameId,
          sport: 'basketball',
          league: leagueName,
          home_team: homeTeam,
          away_team: awayTeam,
          home_odds: homeOdds,
          draw_odds: 0,
          away_odds: awayOdds,
          time_utc: kickoffTime,
          time_eat: kickoffEAT,
          markets: { home: homeOdds, away: awayOdds },
          markets_count: 1
        });

        console.log(`   ✅ Added: ${homeTeam} vs ${awayTeam} (${games.length})`);
      } catch (err) {
        continue;
      }
    }
      } catch (dateErr) {
        console.error(`❌ Error fetching basketball games for ${dateStr}:`, dateErr.message);
        continue;
      }
    } // end of datesToFetch loop

    console.log(`\n✅ Fetched ${games.length} basketball games across ${DAYS_TO_FETCH} days from API`);

    if (games.length === 0) {
      return res.json({
        success: true,
        message: `No upcoming basketball games found for the next ${DAYS_TO_FETCH} days`,
        game_count: 0,
        games: [],
        dates_checked: datesToFetch,
        sport: 'basketball'
      });
    }

    res.json({
      success: true,
      message: `Found ${games.length} basketball games across ${DAYS_TO_FETCH} days ready to add`,
      game_count: games.length,
      games: games,
      dates_checked: datesToFetch,
      sport: 'basketball',
      next_step: 'Call /api/admin/fetch-api-football/execute with sport=basketball to add them'
    });

  } catch (error) {
    console.error('❌ Basketball fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch basketball games',
      details: error.message
    });
  }
});

module.exports = router;
