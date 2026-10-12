#!/usr/bin/env node

/**
 * Add Admin Users to Supabase
 * Adds muleiadmin and muleiadmin2 as admin users
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY env var is required');

const supabase = createClient(supabaseUrl, supabaseKey);

async function addAdmins() {
  console.log('\n🚀 Adding Admin Users to Supabase...\n');

  try {
    // Add muleiadmin (primary admin)
    console.log('📝 Adding muleiadmin...');
    const admin1 = await supabase
      .from('users')
      .upsert([
        {
          phone_number: '0714945142',
          email: 'muleiadmin@betnexa.com',
          username: 'muleiadmin',
          password: '4306',
          is_admin: true,
          is_verified: true,
          account_balance: 0,
          total_bets: 0,
          total_winnings: 0,
          status: 'active',
          role: 'admin',
        }
      ], { onConflict: 'phone_number' })
      .select();

    if (admin1.error) {
      console.error('❌ Error adding muleiadmin:', admin1.error.message);
    } else {
      console.log('✅ muleiadmin added/updated successfully');
      console.log('   Phone: 0714945142');
      console.log('   Password: 4306');
    }

    // Add muleiadmin2 (secondary admin)
    console.log('\n📝 Adding muleiadmin2...');
    const admin2 = await supabase
      .from('users')
      .upsert([
        {
          phone_number: '0714945143',
          email: 'muleiadmin2@betnexa.com',
          username: 'muleiadmin2',
          password: '4307',
          is_admin: true,
          is_verified: true,
          account_balance: 0,
          total_bets: 0,
          total_winnings: 0,
          status: 'active',
          role: 'admin',
        }
      ], { onConflict: 'phone_number' })
      .select();

    if (admin2.error) {
      console.error('❌ Error adding muleiadmin2:', admin2.error.message);
    } else {
      console.log('✅ muleiadmin2 added/updated successfully');
      console.log('   Phone: 0714945143');
      console.log('   Password: 4307');
    }

    // Fetch and display all admins
    console.log('\n\n📋 All Admin Users in Database:\n');
    const { data: admins, error: fetchError } = await supabase
      .from('users')
      .select('id, phone_number, username, is_admin, email, created_at')
      .eq('is_admin', true);

    if (fetchError) {
      console.error('❌ Error fetching admins:', fetchError.message);
    } else {
      if (admins && admins.length > 0) {
        admins.forEach((admin, index) => {
          console.log(`${index + 1}. ${admin.username}`);
          console.log(`   Username: ${admin.username}`);
          console.log(`   Phone: ${admin.phone_number}`);
          console.log(`   Email: ${admin.email || 'N/A'}`);
          console.log(`   ID: ${admin.id}`);
          console.log('');
        });
      } else {
        console.log('No admins found in database');
      }
    }

    console.log('✅ Admin setup complete!\n');
    console.log('🔐 You can now login with either:');
    console.log('   muleiadmin   - Phone: 0714945142, Password: 4306');
    console.log('   muleiadmin2  - Phone: 0714945143, Password: 4307\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

addAdmins();
