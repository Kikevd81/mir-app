import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

dotenv.config();
puppeteer.use(StealthPlugin());

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanName(name) {
    if (!name) return '';
    // Normalize first but keep spaces for word boundary matching
    let n = name.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Remove noise words
    const noise = [
        'hospital', 'universitario', 'clinico', 'complejo', 'sanitario', 
        'fundacion', 'general', 'infantil', 'materno', 'udm', 'geriatria', 
        'unidad', 'docente', 'serv', 'u', 'h', 'hosp', 'univ', 'de', 'del', 'la', 'el'
    ];
    
    const words = n.split(' ').filter(w => !noise.includes(w));
    return words.join('-');
}

async function diagnostic() {
    console.log('🚀 Starting diagnostics...');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    let authToken, xsrfToken;
    page.on('request', r => {
        const h = r.headers();
        if (h['authorization']) authToken = h['authorization'];
        if (h['x-xsrf-token']) xsrfToken = h['x-xsrf-token'];
    });

    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 15000));

    const apiUrl = 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadasTotal?tipoBusqueda=&idTitulo=M&orden=null';
    const apiData = await page.evaluate(async (url, auth, xsrf) => {
        const resp = await fetch(url, { headers: { 'Authorization': auth, 'X-XSRF-TOKEN': xsrf, 'Process-Type': 'MENU' } });
        return resp.json();
    }, apiUrl, authToken, xsrfToken);

    console.log(`✅ Loaded ${apiData.length} records from API.`);

    const { data: specialties } = await supabase.from('specialties').select('*');
    const { data: hospitals } = await supabase.from('hospitals').select('*');
    const { data: slots } = await supabase.from('slots').select('hospital_id, specialty_id');

    const specialtyMap = new Map(specialties.map(s => [s.name.toLowerCase(), s.id]));
    const hospitalMap = new Map(hospitals.map(h => [`${normalizeText(h.province)}-${normalizeText(h.name)}`, h.id]));
    const slotSet = new Set(slots.map(s => `${s.hospital_id}|${s.specialty_id}`));

    const findBestHospitalId = (hospName, province) => {
        const provinceNorm = normalizeText(province);
        const hospNorm = normalizeText(hospName);
        const directId = `${provinceNorm}-${hospNorm}`;
        if (hospitalMap.has(directId)) return hospitalMap.get(directId);
        
        const provinceFirstPart = provinceNorm.split('-')[0].trim();
        const provinceHospitals = hospitals.filter(h => normalizeText(h.province).includes(provinceFirstPart));
        const targetClean = cleanName(hospName);
        
        for (const h of provinceHospitals) {
            if (cleanName(h.name) === targetClean) return h.id;
        }
        return null;
    };

    const findBestSpecialtyId = (specName) => {
        const specNorm = specName.toLowerCase();
        if (specialtyMap.has(specNorm)) return specialtyMap.get(specNorm);
        const targetClean = cleanName(specName);
        for (const s of specialties) {
            if (cleanName(s.name) === targetClean) return s.id;
        }
        return null;
    };

    let unmatchedCount = 0;
    console.log('\n--- Unmatched Samples ---');
    for (const item of apiData) {
        const sName = item.desespec || item.descEspecialidad || item.especialidad;
        const hName = item.descentro || item.descCentro || item.centro;
        const prov = item.despro || item.descProvincia || item.provincia || '';
        
        const hId = findBestHospitalId(hName, prov);
        const sId = findBestSpecialtyId(sName);
        
        if (!hId || !sId || !slotSet.has(`${hId}|${sId}`)) {
            unmatchedCount++;
            if (unmatchedCount <= 20) {
                console.log(`Unmatched: ${hName} (${prov}) | ${sName}`);
                console.log(`  -> hId: ${hId}, sId: ${sId}, inSlotSet: ${slotSet.has(`${hId}|${sId}`)}`);
                if (hId && sId) {
                    // console.log(`  -> Slot Key: ${hId}|${sId}`);
                }
            }
        }
    }

    console.log(`\nTotal unmatched: ${unmatchedCount} / ${apiData.length}`);
    await browser.close();
}

diagnostic();
