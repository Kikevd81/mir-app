import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

function generateId(text) {
  return normalizeText(text);
}

async function runScraper() {
  const isCI = process.env.CI === 'true';
  console.log(`🚀 Starting MIR Scraper (CI: ${isCI})...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions'
    ]
  });

  try {
    const page = await browser.newPage();

    // Forward browser console to Node
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

    let authToken = null;
    let xsrfToken = null;

    page.on('request', request => {
      const headers = request.headers();
      if (headers['authorization']?.startsWith('Bearer ')) {
        authToken = headers['authorization'].split(' ')[1];
      }
      if (headers['x-xsrf-token']) {
        xsrfToken = headers['x-xsrf-token'];
      }
    });

    console.log('📡 Phase 1: Loading Sanidad portal to capture auth tokens...');
    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );

    // Wait for Angular app to initialize and make its initial API calls
    const WAIT_MS = isCI ? 25000 : 15000;
    console.log(`⏳ Waiting ${WAIT_MS / 1000}s for app initialization...`);
    await new Promise(r => setTimeout(r, WAIT_MS));

    if (!authToken) {
      console.error('❌ Auth failed: No Bearer token captured. The page may have blocked the request.');
      await updateConfigError('No se capturó el token de autenticación.');
      process.exit(1);
    }

    console.log(`✅ Tokens captured. Auth: ${authToken.substring(0, 10)}...`);

    // Use the newly discovered "Total" endpoint to get all records
    const apiUrl = `https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadasTotal?tipoBusqueda=&idTitulo=M&orden=null`;
    console.log(`📡 Fetching full data from: ${apiUrl}`);

    const records = await page.evaluate(async (url, token, xsrf) => {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-XSRF-TOKEN': xsrf,
          'Accept': 'application/json',
          'Process-Type': 'MENU'
        }
      });
      if (!response.ok) throw new Error(`API failed with status ${response.status}`);
      return await response.json();
    }, apiUrl, authToken, xsrfToken);

    if (!records || records.length === 0) {
      console.error('❌ No records received from the API.');
      await updateConfigError('La API no devolvió registros.');
      process.exit(1);
    }

    console.log(`✅ Captured ${records.length} records from API.`);
    await processAndSaveData(records);

    await supabase.from('scraper_config').update({
      last_scrape_at: new Date().toISOString(),
      last_scrape_status: 'success',
      last_error_message: null,
      total_adjudications_processed: records.length,
      updated_at: new Date().toISOString()
    }).limit(1);

  } catch (error) {
    console.error('❌ Scraper error:', error.message);
    await updateConfigError(error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function updateConfigError(message) {
  try {
    await supabase.from('scraper_config').update({
      last_scrape_at: new Date().toISOString(),
      last_scrape_status: 'error',
      last_error_message: message,
      updated_at: new Date().toISOString()
    }).limit(1);
  } catch (e) {
    console.error('Failed to update scraper config:', e.message);
  }
}

async function processAndSaveData(data) {
  console.log(`📊 Processing ${data.length} records...`);

  // Fetch all reference data (handling Supabase 1000 limit with pagination)
  const fetchAll = async (table, select = '*') => {
    let all = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data: batch, error } = await supabase.from(table).select(select).range(from, from + step - 1);
      if (error) throw error;
      if (!batch || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < step) break;
      from += step;
    }
    return all;
  };

  const specialties = await fetchAll('specialties');
  const hospitals = await fetchAll('hospitals');
  const slots = await fetchAll('slots', 'hospital_id, specialty_id');

  console.log(`   Loaded reference data: ${specialties.length} specs, ${hospitals.length} hosps, ${slots.length} slots.`);

  const specialtyMap = new Map((specialties).map(s => [s.name.toLowerCase(), s.id]));
  const hospitalMap = new Map((hospitals).map(h => [`${normalizeText(h.province)}-${normalizeText(h.name)}`, h.id]));

  function cleanName(name) {
    if (!name) return '';
    let n = name.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    const noise = [
        'hospital', 'universitario', 'clinico', 'complejo', 'sanitario', 
        'fundacion', 'general', 'infantil', 'materno', 'udm', 'geriatria', 
        'unidad', 'docente', 'serv', 'u', 'h', 'hosp', 'univ', 'de', 'del', 'la', 'el'
    ];
    
    const words = n.split(' ').filter(w => !noise.includes(w));
    return words.join('-');
  }

  const findBestHospitalId = (hospName, province) => {
    const provinceNorm = normalizeText(province);
    const hospNorm = normalizeText(hospName);

    // 1. Direct key match
    const directId = `${provinceNorm}-${hospNorm}`;
    if (hospitalMap.has(directId)) return hospitalMap.get(directId);

    // 2. Province fuzzy match (handle "VALENCIA/VALÈNCIA" style)
    const provinceFirstPart = provinceNorm.split(/[\/\-]/)[0].trim();
    const provinceHospitals = hospitals.filter(h => {
      const hProvNorm = normalizeText(h.province);
      return hProvNorm.includes(provinceFirstPart) || provinceNorm.includes(hProvNorm.split(/[\/\-]/)[0].trim());
    });

    // 3. Fuzzy name match within province
    const cleanHosp = cleanName(hospName);
    for (const h of provinceHospitals) {
      const hClean = cleanName(h.name);
      if (hClean === cleanHosp || hClean.includes(cleanHosp) || cleanHosp.includes(hClean)) {
        return h.id;
      }
    }

    return directId; // Fallback (won't match any slot, so it will be filtered out)
  };

  const findBestSpecialtyId = (specName) => {
    if (!specName) return 'unknown';
    const specNorm = specName.toLowerCase();
    if (specialtyMap.has(specNorm)) return specialtyMap.get(specNorm);
    const cleanSpec = cleanName(specName);
    for (const s of specialties) {
      if (cleanName(s.name) === cleanSpec) return s.id;
    }
    return generateId(specName);
  };

  const upserts = data.map(item => {
    const sName = item.desespec || item.descEspecialidad || item.especialidad;
    const hName = item.descentro || item.descCentro || item.centro;
    const orderNum = item.numorden || item.numOrden || item.n_ORDEN;
    if (!sName || !hName || !orderNum) return null;
    const province = item.despro || item.descProvincia || item.provincia || '';

    return {
      order_number: parseInt(orderNum),
      specialty_name: sName,
      hospital_name: hName,
      province: province,
      specialty_id: findBestSpecialtyId(sName),
      hospital_id: findBestHospitalId(hName, province)
    };
  }).filter(Boolean);

  console.log(`   Valid records: ${upserts.length}`);

  // Only upsert records that match an existing slot
  const slotSet = new Set((slots).map(s => `${s.hospital_id}|${s.specialty_id}`));
  const matchedUpserts = upserts.filter(u => slotSet.has(`${u.hospital_id}|${u.specialty_id}`));
  console.log(`   Matching known slots: ${matchedUpserts.length}`);

  if (matchedUpserts.length === 0) {
    console.log('⚠️ No records matched any tracked slot. Nothing to upsert.');
    return;
  }

  const BATCH_SIZE = 400;
  let successCount = 0;
  for (let i = 0; i < matchedUpserts.length; i += BATCH_SIZE) {
    const batch = matchedUpserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('adjudications').upsert(batch, { onConflict: 'order_number' });
    if (error) {
      console.error(`   ❌ Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
    } else {
      successCount += batch.length;
    }
  }

  console.log(`   ✅ Upserted ${successCount} records.`);

  if (successCount > 0) {
    const { error: rpcError } = await supabase.rpc('update_available_slots');
    if (rpcError) {
      console.error(`   ⚠️ RPC error: ${rpcError.message}`);
    } else {
      console.log('   ✅ Available slots updated!');
    }
    console.log(`🏁 Done. Total synced: ${successCount}`);
  }
}

runScraper();
