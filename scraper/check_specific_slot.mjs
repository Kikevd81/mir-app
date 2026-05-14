import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkSpecificSlot() {
    const hId = 'madrid-h-universitario-clinico-san-carlos';
    const sId = 'medicina-interna';
    
    const { data } = await supabase.from('slots')
        .select('*')
        .eq('hospital_id', hId)
        .eq('specialty_id', sId);
    
    console.log('Slot exists:', data.length > 0);
    if (data.length > 0) {
        console.log('Slot data:', data[0]);
    }
}

checkSpecificSlot();
