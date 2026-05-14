import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const cleanName = (name) => {
    return normalizeText(name)
      .replace(/hospital|universitario|clinico|complejo|sanitario|fundacion|general|infantil|materno|udm|geriatria|unidad|docente/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
};

async function debugHospitalMatch() {
    console.log('🔍 Debugging Hospital Match for: H. CLÍNICO UNIVERSITARIO DE VALENCIA');
    
    const { data: hospitals } = await supabase.from('hospitals').select('*');
    if (!hospitals) {
        console.log('❌ Failed to load hospitals.');
        return;
    }

    const targetHosp = 'H. CLÍNICO UNIVERSITARIO DE VALENCIA';
    const targetProvince = 'VALENCIA/VALÈNCIA';
    
    const targetClean = cleanName(targetHosp);
    console.log(`Target Clean: "${targetClean}"`);

    const matches = hospitals.filter(h => {
        const hClean = cleanName(h.name);
        const hProvNorm = normalizeText(h.province);
        const provinceMatch = hProvNorm.includes('valencia') || normalizeText(targetProvince).includes(hProvNorm);
        
        if (provinceMatch) {
            console.log(`Checking in Province: ${h.name} -> Clean: "${hClean}"`);
        }
        
        return provinceMatch && (hClean === targetClean || hClean.includes(targetClean) || targetClean.includes(hClean));
    });

    console.log(`Matches found: ${matches.length}`);
    matches.forEach(m => console.log(` - [${m.id}] ${m.name}`));

    // Also check adjudications
    const { count } = await supabase.from('adjudications')
        .select('*', { count: 'exact', head: true })
        .ilike('hospital_name', '%CLÍNICO UNIVERSITARIO DE VALENCIA%');
    
    console.log(`Total adjudications in DB for this hospital name: ${count}`);
}

debugHospitalMatch();
