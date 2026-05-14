import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSlots() {
    const { data } = await supabase.from('slots')
        .select('hospital_id, hospitals!inner(name, province)');
    
    console.log('Total slots:', data.length);
    const valencia = data.filter(s => s.hospitals.province.includes('VALENCIA'));
    console.log('Valencia slots:', valencia.length);
    if (valencia.length > 0) {
        console.log('Valencia Hospitals:', [...new Set(valencia.map(s => s.hospitals.name))]);
    } else {
        // Search for anything in Valencia
        const { data: provs } = await supabase.from('hospitals').select('province').limit(100);
        console.log('Provinces available in DB:', [...new Set(provs.map(p => p.province))]);
    }
}

checkSlots();
