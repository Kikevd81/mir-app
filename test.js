require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: adjs } = await supabase.from('adjudications').select('hospital_name, hospital_id').limit(10);
  console.log('Adjudications:');
  console.log(adjs);

  const { data: slots } = await supabase.from('slots').select('hospital_id').limit(10);
  console.log('Slots:');
  console.log(slots.map(s => s.hospital_id));
}
run();
