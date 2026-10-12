const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY env var is required');
const supabase = createClient(
  'https://eaqogmybihiqzivuwyav.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function testMarketUpdate() {
  // Step 1: Find a manual game (g-prefixed game_id)
  console.log('\n=== Step 1: Find a manual game ===');
  const { data: games, error: gamesErr } = await supabase
    .from('games')
    .select('id, game_id, home_team, away_team')
    .like('game_id', 'g%')
    .limit(5);

  if (gamesErr) {
    console.error('Error fetching games:', gamesErr.message);
    return;
  }

  console.log('Manual games found:', games?.length);
  if (!games || games.length === 0) {
    console.log('No manual games found');
    return;
  }

  const game = games[0];
  console.log(`Using game: ${game.game_id} (UUID: ${game.id}) - ${game.home_team} vs ${game.away_team}`);

  // Step 2: Check current markets for this game
  console.log('\n=== Step 2: Current markets ===');
  const { data: currentMarkets, error: mktsErr } = await supabase
    .from('markets')
    .select('*')
    .eq('game_id', game.id);

  if (mktsErr) {
    console.error('Error fetching markets:', mktsErr.message);
    return;
  }

  console.log(`Current markets count: ${currentMarkets?.length || 0}`);
  if (currentMarkets && currentMarkets.length > 0) {
    currentMarkets.forEach(m => {
      console.log(`  ${m.market_key}: ${m.odds} (type: ${m.market_type})`);
    });
  }

  // Step 3: Try to delete a market and re-insert with a different value
  const testKey = currentMarkets && currentMarkets.length > 0 
    ? currentMarkets[0].market_key 
    : 'bttsYes';
  const testOldOdds = currentMarkets?.find(m => m.market_key === testKey)?.odds || 1.5;
  const testNewOdds = parseFloat(testOldOdds) === 99.99 ? 88.88 : 99.99; // Use a distinctive test value
  
  console.log(`\n=== Step 3: Test update ${testKey} from ${testOldOdds} to ${testNewOdds} ===`);

  // Delete old entry
  console.log(`  Deleting old entry for ${testKey}...`);
  const { error: delErr, count: delCount } = await supabase
    .from('markets')
    .delete()
    .eq('game_id', game.id)
    .eq('market_key', testKey);

  if (delErr) {
    console.error('  DELETE error:', delErr.message, delErr.code, delErr.details);
  } else {
    console.log(`  DELETE success`);
  }

  // Insert new entry WITH manually_edited_at (should fail if column doesn't exist)
  console.log(`  Inserting with manually_edited_at...`);
  const nowIso = new Date().toISOString();
  const { error: insErr1 } = await supabase.from('markets').insert({
    game_id: game.id,
    market_type: 'BTTS',
    market_key: testKey,
    odds: testNewOdds,
    updated_at: nowIso,
    manually_edited_at: nowIso,
  });

  if (insErr1) {
    console.log(`  First insert error: ${insErr1.message}`);
    console.log(`  Error code: ${insErr1.code}`);
    
    // Check if it's the manually_edited_at error
    const isColumnError = /manually_edited_at|column .* does not exist/i.test(insErr1.message || '');
    console.log(`  Is column missing error: ${isColumnError}`);

    // Try without manually_edited_at
    console.log(`  Retrying without manually_edited_at...`);
    const { error: insErr2 } = await supabase.from('markets').insert({
      game_id: game.id,
      market_type: 'BTTS',
      market_key: testKey,
      odds: testNewOdds,
      updated_at: nowIso,
    });

    if (insErr2) {
      console.error('  Second insert error:', insErr2.message, insErr2.code, insErr2.details);
    } else {
      console.log('  Second insert SUCCESS');
    }
  } else {
    console.log('  First insert SUCCESS (manually_edited_at column exists!)');
  }

  // Step 4: Verify the market was updated
  console.log('\n=== Step 4: Verify update ===');
  const { data: verifyMarkets, error: verifyErr } = await supabase
    .from('markets')
    .select('*')
    .eq('game_id', game.id)
    .eq('market_key', testKey);

  if (verifyErr) {
    console.error('Verify error:', verifyErr.message);
  } else {
    console.log(`Verified markets for ${testKey}:`, verifyMarkets);
    if (verifyMarkets && verifyMarkets.length > 0) {
      const savedOdds = parseFloat(verifyMarkets[0].odds);
      console.log(`\n  Expected: ${testNewOdds}`);
      console.log(`  Actual:   ${savedOdds}`);
      console.log(`  Match:    ${Math.abs(savedOdds - testNewOdds) < 0.01 ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('  ❌ No market found after insert!');
    }
  }

  // Step 5: Restore original value
  console.log('\n=== Step 5: Restore original value ===');
  await supabase
    .from('markets')
    .delete()
    .eq('game_id', game.id)
    .eq('market_key', testKey);
  
  if (parseFloat(testOldOdds) > 0) {
    await supabase.from('markets').insert({
      game_id: game.id,
      market_type: currentMarkets?.find(m => m.market_key === testKey)?.market_type || 'BTTS',
      market_key: testKey,
      odds: parseFloat(testOldOdds),
      updated_at: nowIso,
    });
    console.log(`Restored ${testKey} to ${testOldOdds}`);
  }
  
  console.log('\n=== Test complete ===');
}

testMarketUpdate().catch(console.error);
