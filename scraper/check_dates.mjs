import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkAdjudicationDates() {
    const { data } = await supabase.from('adjudications')
        .select('created_at')
        .order('created_at', { ascending: true });
    
    if (data.length > 0) {
        console.log('Earliest:', data[0].created_at);
        console.log('Latest:', data[data.length - 1].created_at);
        console.log('Total:', data.length);
    }
}

checkAdjudicationDates();
