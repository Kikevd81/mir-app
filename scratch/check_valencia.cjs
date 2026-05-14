require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkValencia() {
  console.log('🔍 Checking H. CLÍNICO UNIVERSITARIO DE VALENCIA - Oftalmología...');
  
  // Check slots
  const { data: slots, error: slotError } = await supabase
    .from('slots')
    .select('*')
    .ilike('hospital_name', '%CLÍNICO UNIVERSITARIO%VALENCIA%')
    .ilike('specialty_name', '%Oftalmología%');

  if (slotError) console.error('Error fetching slots:', slotError);
  console.log('Slots found:', slots);

  // Check adjudications
  const { data: adjudications, error: adjError } = await supabase
    .from('adjudications')
    .select('*')
    .ilike('hospital_name', '%CLÍNICO UNIVERSITARIO%VALENCIA%')
    .ilike('specialty_name', '%Oftalmología%');

  if (adjError) console.error('Error fetching adjudications:', adjError);
  console.log('Adjudications found count:', adjudications ? adjudications.length : 0);
  if (adjudications) {
    adjudications.forEach(a => console.log(`   - Order: ${a.order_number}`));
  }
}

checkValencia();
