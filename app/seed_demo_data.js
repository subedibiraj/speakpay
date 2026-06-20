require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding demo data...');
  
  // 1. Delete all existing data to start fresh
  await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('wallets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const pinHash = await bcrypt.hash('123456', 10);

  const demoUsers = [
    { phone: '9800000000', full_name: 'बिराज सुवेदी', pin_hash: pinHash }, // Main user
    { phone: '9811111111', full_name: 'राम श्रेष्ठ', pin_hash: pinHash }, // Ram
    { phone: '9822222222', full_name: 'सिता कुमारी', pin_hash: pinHash }, // Sita
    { phone: '9833333333', full_name: 'हरि थापा', pin_hash: pinHash }, // Hari
  ];

  for (const u of demoUsers) {
    const { data: user, error: uErr } = await supabase.from('users').insert(u).select().single();
    if (uErr) { console.error('Failed to create user:', uErr); continue; }
    
    // Give everyone 10,000 rupees to start
    const { error: wErr } = await supabase.from('wallets').insert({ user_id: user.id, balance: 10000 });
    if (wErr) { console.error('Failed to create wallet:', wErr); }
  }

  console.log('✅ Seeding complete. All users have PIN: 123456 and 10,000 balance.');
}

seed().catch(console.error);
