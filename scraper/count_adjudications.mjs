import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function count() {
    const { count, error } = await supabase.from('adjudications').select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Total adjudications in DB:', count);
    }
}

count();
