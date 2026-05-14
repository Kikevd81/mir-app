import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSanCarlosSlots() {
    const hId = 'madrid-h-universitario-clinico-san-carlos';
    const { data } = await supabase.from('slots')
        .select('specialty_id, specialties(name)')
        .eq('hospital_id', hId);
    
    console.log('Slots for San Carlos:', data.map(d => d.specialties.name));
}

checkSanCarlosSlots();
