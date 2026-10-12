const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Lc8dQIzND4_qyIbN2EuQrQ_0Ma0OINQ';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_KEY env var is required');

console.log('\n🔍 SUPABASE HEALTH DIAGNOSTIC REPORT');
console.log('═'.repeat(50));
console.log(`📍 Project URL: ${supabaseUrl}`);
console.log('═'.repeat(50) + '\n');

// Test 1: Connection with anon key
console.log('🧪 TEST 1: Anon Key Connection');
console.log('─'.repeat(50));
const supabaseAnon = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    const { data, error, status } = await supabaseAnon
      .from('users')
      .select('id', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log('❌ ANON KEY: Connection failed');
      console.log(`   Status: ${status}`);
      console.log(`   Error: ${error.message}`);
    } else {
      console.log('✅ ANON KEY: Connection successful');
      console.log(`   Status: ${status}`);
      console.log(`   Data retrieved: ${data ? data.length + ' record(s)' : 'none'}`);
    }
  } catch (err) {
    console.log('❌ ANON KEY: Exception occurred');
    console.log(`   Error: ${err.message}`);
  }

  console.log('');

  // Test 2: Connection with service role key
  console.log('🧪 TEST 2: Service Role Key Connection');
  console.log('─'.repeat(50));
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error, status } = await supabaseService
      .from('users')
      .select('id', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log('❌ SERVICE KEY: Connection failed');
      console.log(`   Status: ${status}`);
      console.log(`   Error: ${error.message}`);
    } else {
      console.log('✅ SERVICE KEY: Connection successful');
      console.log(`   Status: ${status}`);
      console.log(`   Data retrieved: ${data ? data.length + ' record(s)' : 'none'}`);
    }
  } catch (err) {
    console.log('❌ SERVICE KEY: Exception occurred');
    console.log(`   Error: ${err.message}`);
  }

  console.log('');

  // Test 3: Check table access
  console.log('🧪 TEST 3: Database Table Access');
  console.log('─'.repeat(50));
  
  const tablesToCheck = ['users', 'games', 'matches', 'bets'];
  let tableAccessCount = 0;

  for (const table of tablesToCheck) {
    try {
      const { data, error, status } = await supabaseService
        .from(table)
        .select('count()', { count: 'exact', head: true });
      
      if (error) {
        console.log(`⚠️  Table '${table}': ${error.message}`);
      } else {
        console.log(`✅ Table '${table}': Accessible`);
        tableAccessCount++;
      }
    } catch (err) {
      console.log(`❌ Table '${table}': Exception - ${err.message}`);
    }
  }

  console.log(`   Result: ${tableAccessCount}/${tablesToCheck.length} tables accessible\n`);

  // Test 4: Check for connection issues
  console.log('🧪 TEST 4: Concurrent Connections Test');
  console.log('─'.repeat(50));

  try {
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        supabaseAnon
          .from('users')
          .select('count()', { count: 'exact', head: true })
      );
    }
    
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    
    if (errors.length > 0) {
      console.log('⚠️  Concurrent connection issues detected');
      console.log(`   Successful: ${3 - errors.length}/3`);
      console.log(`   Failed: ${errors.length}/3`);
      errors.forEach((err, i) => {
        console.log(`   Request ${i + 1}: ${err.error.message}`);
      });
    } else {
      console.log('✅ Concurrent connection handling OK');
      console.log(`   All 3 concurrent requests succeeded`);
    }
  } catch (err) {
    console.log('⚠️  Concurrent connection test failed');
    console.log(`   Error: ${err.message}`);
  }

  console.log('');

  // Test 5: Check realtime subscriptions
  console.log('🧪 TEST 5: Realtime Subscriptions');
  console.log('─'.repeat(50));

  try {
    const subscription = supabaseAnon
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
        console.log('   Subscription event received:', payload.eventType);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscriptions: Connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Realtime subscriptions: Error');
        }
      });

    // Cleanup after 2 seconds
    setTimeout(() => {
      supabaseAnon.removeChannel(subscription);
      performSummary();
    }, 2000);
  } catch (err) {
    console.log('⚠️  Realtime subscription test failed');
    console.log(`   Error: ${err.message}`);
    performSummary();
  }
})();

function performSummary() {
  console.log('\n📋 SUMMARY & RECOMMENDATIONS');
  console.log('═'.repeat(50));
  
  console.log('\n⚠️  "Unhealthy" Status Causes:');
  console.log('   1. Database instance down or unreachable');
  console.log('   2. Connection pool exhaustion');
  console.log('   3. Database storage limit reached');
  console.log('   4. High CPU/memory usage on DB instance');
  console.log('   5. Row-Level Security (RLS) policy issues');
  console.log('   6. Recent schema migrations causing locks');
  console.log('   7. Network connectivity problems');

  console.log('\n✅ What to Check:');
  console.log('   1. Go to Supabase Dashboard: https://app.supabase.com');
  console.log('   2. Navigate to: Project > Database > Status');
  console.log('   3. Check: Resource usage (CPU, memory, connections)');
  console.log('   4. Review: Database logs for errors or warnings');
  console.log('   5. Monitor: Active connections and queries');
  console.log('   6. Verify: No blocked tables or locks');

  console.log('\n🔧 Potential Fixes:');
  console.log('   1. Kill idle connections (if UI supports)');
  console.log('   2. Upgrade database instance size (t4g.nano → t4g.small)');
  console.log('   3. Increase connection pool settings');
  console.log('   4. Clear old logs or archived data');
  console.log('   5. Optimize slow queries');
  console.log('   6. Check for table locks with: SELECT * FROM pg_locks;');

  console.log('\n🛠️  Emergency Recovery Steps:');
  console.log('   1. Create database backup');
  console.log('   2. Disable non-essential scheduled functions');
  console.log('   3. Restart the database service (if available in UI)');
  console.log('   4. Scale up resources if needed');
  console.log('   5. Contact Supabase support if issue persists');

  console.log('\n═'.repeat(50) + '\n');
  process.exit(0);
}
