const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service key (for admin access)
const supabaseUrl = 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_KEY env var is required');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Robinson mugambi's ID (to exclude from banning)
const ROBINSON_ID = '19d20138-36fc-419f-8cf8-161073fd18f9';

async function banUsersExceptRobinson() {
  try {
    console.log('🔍 Preparing to ban users with winnings, unactivated withdrawals...\n');
    console.log(`⚠️  EXCLUDING FROM BAN: Robinson mugambi (ID: ${ROBINSON_ID})\n`);

    // First, fetch the users we'll be banning to show summary
    const { data: usersToBan, error: fetchError } = await supabase
      .from('users')
      .select('id, phone_number, username, account_balance, total_winnings, is_banned')
      .gt('total_winnings', 0)
      .eq('withdrawal_activated', false)
      .or('is_banned.eq.false,is_banned.is.null')
      .neq('id', ROBINSON_ID) // Exclude Robinson
      .order('total_winnings', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError);
      return;
    }

    if (!usersToBan || usersToBan.length === 0) {
      console.log('✅ No users to ban.');
      return;
    }

    console.log(`📋 Found ${usersToBan.length} users to ban:\n`);
    console.log('='.repeat(110));
    console.log(
      `${'#'.padEnd(4)} | ${'Username'.padEnd(25)} | ${'Phone'.padEnd(15)} | ${'Total Winnings'.padEnd(16)} | ${'Account Balance'.padEnd(18)} | ${'Currently Banned'.padEnd(16)}`
    );
    console.log('='.repeat(110));

    usersToBan.forEach((user, index) => {
      console.log(
        `${(index + 1).toString().padEnd(4)} | ${(user.username || 'N/A').padEnd(25)} | ${(user.phone_number || 'N/A').padEnd(15)} | KSH ${(user.total_winnings || 0).toString().padEnd(11)} | KSH ${(user.account_balance || 0).toString().padEnd(13)} | ${(user.is_banned ? 'YES' : 'NO').padEnd(16)}`
      );
    });

    console.log('='.repeat(110));
    console.log(`\n⏳ Proceeding with ban operation...\n`);

    // Ban all users except Robinson
    const { data: banResult, error: banError } = await supabase
      .from('users')
      .update({ is_banned: true, banned_at: new Date().toISOString() })
      .gt('total_winnings', 0)
      .eq('withdrawal_activated', false)
      .or('is_banned.eq.false,is_banned.is.null')
      .neq('id', ROBINSON_ID);

    if (banError) {
      console.error('❌ Error banning users:', banError);
      return;
    }

    console.log(`✅ Successfully banned ${usersToBan.length} users!\n`);

    // Verify Robinson is still unbanned
    const { data: robinson, error: robinsonError } = await supabase
      .from('users')
      .select('id, username, is_banned')
      .eq('id', ROBINSON_ID)
      .single();

    if (robinsonError) {
      console.error('⚠️  Error verifying Robinson:', robinsonError);
    } else {
      console.log(`✅ VERIFIED: Robinson mugambi is ${robinson.is_banned ? 'BANNED ❌' : 'UNBANNED ✓'}\n`);
    }

    // Show summary
    console.log('📊 Ban Summary:\n');
    console.log(`   ✅ Users Banned: ${usersToBan.length}`);
    console.log(`   🛡️  Users Exempt: 1 (Robinson mugambi)`);
    console.log(`   📊 Total Winnings of Banned Users: KSH ${usersToBan.reduce((sum, u) => sum + (u.total_winnings || 0), 0).toFixed(2)}`);
    console.log(`   💰 Total Balance of Banned Users: KSH ${usersToBan.reduce((sum, u) => sum + (u.account_balance || 0), 0).toFixed(2)}\n`);

    // Export banned users list
    console.log('📋 Banned Users (JSON Export):');
    console.log(JSON.stringify(usersToBan, null, 2));

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Confirmation prompt
console.log('🚨 WARNING: You are about to ban 23 users!\n');
console.log('Are you sure? Type "YES" to confirm...\n');

process.stdin.once('data', async (input) => {
  const answer = input.toString().trim().toUpperCase();
  
  if (answer === 'YES') {
    console.log('\n✅ Confirmed! Proceeding with ban operation...\n');
    await banUsersExceptRobinson();
    process.exit(0);
  } else {
    console.log('\n❌ Operation cancelled.\n');
    process.exit(0);
  }
});
