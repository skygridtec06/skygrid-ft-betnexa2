#!/usr/bin/env node

/**
 * Delete muleiadmin2 from Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eaqogmybihiqzivuwyav.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY env var is required');

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAdmin2() {
  console.log('\n🗑️  Deleting muleiadmin2...\n');

  try {
    // Delete muleiadmin2 by phone number
    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('phone_number', '0714945143');

    if (error) {
      console.error('❌ Error deleting muleiadmin2:', error.message);
    } else {
      console.log('✅ muleiadmin2 deleted successfully');
      console.log(`   Rows deleted: ${data?.length || 1}`);
    }

    // List remaining admins
    console.log('\n📋 Remaining Admin Users:\n');
    const { data: admins, error: fetchError } = await supabase
      .from('users')
      .select('phone_number, username, is_admin, email')
      .eq('is_admin', true);

    if (fetchError) {
      console.error('❌ Error fetching admins:', fetchError.message);
    } else {
      if (admins && admins.length > 0) {
        admins.forEach((admin, index) => {
          console.log(`${index + 1}. ${admin.username}`);
          console.log(`   Phone: ${admin.phone_number}`);
          console.log(`   Email: ${admin.email}\n`);
        });
      } else {
        console.log('No admins found');
      }
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

deleteAdmin2();
