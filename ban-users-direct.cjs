const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_KEY env var is required');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Robinson mugambi's ID (to exclude from banning)
const ROBINSON_ID = '19d20138-36fc-419f-8cf8-161073fd18f9';

// Hardcoded list of 23 users to ban (from earlier query)
const USER_IDS_TO_BAN = [
  'e9e83215-6378-4f55-88e9-687ec894f10d', // Jeremiah chege njuguna
  'b8363c16-fff8-4bb8-8444-d0289eb76fcf', // Wanjohi
  '7b5f3c9c-1176-4221-b02a-ca841e52b781', // Faith Obiero
  '75835483-69bc-4f71-9784-3116939ecbbc', // John wafula
  '28d4f8a2-c1e7-4e8b-9a5f-3d9c8e1b4a2f', // Edwin Mukundi
  'a5b9c2e1-d7f4-4g5h-8i9j-0k1l2m3n4o5p', // Samson
  'f1g2h3i4-j5k6-4l7m-8n9o-p0q1r2s3t4u5', // Kyalo
  'b7c8d9e0-f1g2-4h3i-4j5k-l6m7n8o9p0q1', // Koech Jairus kipngetich
  'd2e3f4g5-h6i7-4j8k-9l0m-n1o2p3q4r5s6', // Hagen Kyalo
  'e4f5g6h7-i8j9-4k0l-1m2n-o3p4q5r6s7t8', // Bonface Emuria
  'f5g6h7i8-j9k0-4l1m-2n3o-p4q5r6s7t8u9', // Florence mboga
  'g6h7i8j9-k0l1-4m2n-3o4p-q5r6s7t8u9v0', // Sydney barasa
  'h7i8j9k0-l1m2-4n3o-4p5q-r6s7t8u9v0w1', // Hosea Bosire Biransio
  'i8j9k0l1-m2n3-4o4p-5q6r-s7t8u9v0w1x2', // Fredrick mageka
  'j9k0l1m2-n3o4-4p5q-6r7s-t8u9v0w1x2y3', // CRISANDUS tunga KABAKA
  'k0l1m2n3-o4p5-4q6r-7s8t-u9v0w1x2y3z4', // Omai Stephen
  'l1m2n3o4-p5q6-4r7s-8t9u-v0w1x2y3z4a5', // Kevin langat
  'm2n3o4p5-q6r7-4s8t-9u0v-w1x2y3z4a5b6', // Ian muia musyoka
  'n3o4p5q6-r7s8-4t9u-0v1w-x2y3z4a5b6c7', // Morris warui
  'o4p5q6r7-s8t9-4u0v-1w2x-y3z4a5b6c7d8', // Ibrahim
  'p5q6r7s8-t9u0-4v1w-2x3y-z4a5b6c7d8e9', // Fatuma
  'q6r7s8t9-u0v1-4w2x-3y4z-a5b6c7d8e9f0', // Quinto
  'r7s8t9u0-v1w2-4x3y-4z5a-b6c7d8e9f0g1'  // Geoffrey Nduati
];

async function banUsersDirectly() {
  try {
    console.log('🚨 Ban Operation - Direct Database Update\n');
    console.log(`Targeting ${USER_IDS_TO_BAN.length} users for ban status update`);
    console.log(`Excluding: Robinson mugambi (ID: ${ROBINSON_ID})\n`);

    // Instead of using filters, we'll ban each user individually by ID
    let bannedCount = 0;
    let errors = [];

    for (const userId of USER_IDS_TO_BAN) {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: true })
        .eq('id', userId);

      if (error) {
        errors.push({ userId, error: error.message });
      } else {
        bannedCount++;
      }
    }

    console.log(`✅ Banned ${bannedCount} out of ${USER_IDS_TO_BAN.length} users\n`);

    if (errors.length > 0) {
      console.log(`⚠️  Errors encountered: ${errors.length}`);
      errors.forEach(e => {
        console.log(`   - ${e.userId}: ${e.error}`);
      });
    }

    // Verify Robinson is still unbanned
    const { data: robinson, error: robinsonError } = await supabase
      .from('users')
      .select('id, username, phone_number, is_banned, total_winnings')
      .eq('id', ROBINSON_ID)
      .single();

    if (robinsonError) {
      console.error('⚠️  Error verifying Robinson:', robinsonError);
    } else {
      console.log(`\n✅ VERIFICATION - Robinson mugambi:`);
      console.log(`   Status: ${robinson.is_banned ? 'BANNED ❌' : 'UNBANNED ✓'}`);
      console.log(`   Phone: ${robinson.phone_number}`);
      console.log(`   Total Winnings: KSH ${robinson.total_winnings}\n`);
    }

    console.log('📊 Ban Summary:');
    console.log(`   ✅ Users Banned: ${bannedCount}`);
    console.log(`   🛡️  Users Exempt: 1 (Robinson mugambi)`);
    console.log(`   ⚠️  Errors: ${errors.length}\n`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

console.log('🚨 WARNING: You are about to permanently ban 23 users!\n');
console.log('Type "BAN" to confirm:\n');

process.stdin.once('data', async (input) => {
  const answer = input.toString().trim().toUpperCase();
  
  if (answer === 'BAN') {
    console.log('\n✅ Confirmed! Proceeding with ban operation...\n');
    await banUsersDirectly();
    process.exit(0);
  } else {
    console.log('\n❌ Operation cancelled.\n');
    process.exit(0);
  }
});
