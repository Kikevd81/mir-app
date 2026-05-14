require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: slots } = await supabase.from('slots').select('hospital_id, specialty_id');
  const { data: adjudications } = await supabase.from('adjudications').select('hospital_name, hospital_id, specialty_id, specialty_name');
  
  let uniqueHospitalsInSlots = new Set(slots.map(s => s.hospital_id));
  let uniqueHospitalsInAdjs = new Set(adjudications.map(s => s.hospital_id));
  
  console.log('Total slots:', slots.length);
  console.log('Unique hospitals in slots:', uniqueHospitalsInSlots.size);
  console.log('Total adjudications:', adjudications.length);
  console.log('Unique hospitals in adjudications:', uniqueHospitalsInAdjs.size);
  
  // Just print the first 5 hospitals in adjs that are NOT in slots
  let missing = [];
  for(let h of uniqueHospitalsInAdjs) {
     let tokens = h.split('-').filter(w => !['de', 'y', 'la', 'el', 'en', 'h', 'c', 'udm', 'area', 'especializada', 'hospital', 'universitario'].includes(w) && w.length > 2);
     let found = false;
     for(let s of uniqueHospitalsInSlots) {
         let slotTokens = s.split('-').filter(w => !['de', 'y', 'la', 'el', 'en', 'h', 'c', 'udm', 'area', 'especializada', 'hospital', 'universitario'].includes(w) && w.length > 2);
         const matches = slotTokens.filter(t => tokens.includes(t));
         if (slotTokens.length > 0 && matches.length / slotTokens.length >= 0.8) {
             found = true; break;
         }
     }
     if(!found) missing.push(h);
  }
  
  console.log('Hospitals in adjudications completely missing from slots DB:', missing.length);
  console.log('Some of them:', missing.slice(0, 5));

}
run();
