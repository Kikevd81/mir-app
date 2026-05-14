import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function count() {
    const { count } = await supabase.from('slots').select('*', { count: 'exact', head: true });
    console.log('Total slots in DB:', count);
}

count();
