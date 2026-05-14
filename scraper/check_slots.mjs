import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSlots() {
    const { data } = await supabase.from('slots')
        .select('hospital_id, hospitals(name, province)')
        .limit(100);
    
    const valenciaSlots = data.filter(s => s.hospitals?.province?.includes('VALENCIA'));
    console.log('Valencia Slots Hospitals:', [...new Set(valenciaSlots.map(s => s.hospitals.name))]);
}

checkSlots();
