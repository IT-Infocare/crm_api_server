const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://hqijrtdyvtaclifrbuuc.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_PLLzTvDBomit6CvtkO-EiA_KQZxKtD4';

let supabase = null;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('YOUR_')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[DB] ✅ Connected to Supabase Database:', supabaseUrl);
  } catch (err) {
    console.warn('[DB] Supabase Client initialization warning:', err.message);
  }
} else {
  console.log('[DB] Running with local mock data fallback.');
}

module.exports = {
  supabase,
  hasSupabase: () => !!supabase,
};
