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
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Listen to browser console
    page.on('console', msg => {
      const text = msg.text();
      console.log(`[Browser] ${text}`);
    });

    console.log('🐴 Starting "Final Solution" MIR Scraper (Sanidad Page-based)...');
    
    let authToken, xsrfToken;
    page.on('request', request => {
      const headers = request.headers();
      if (headers['authorization']?.startsWith('Bearer ')) {
        authToken = headers['authorization'].split(' ')[1];
      }
      if (headers['x-xsrf-token']) {
        xsrfToken = headers['x-xsrf-token'];
      }
    });

    console.log('📡 Phase 1: Capturing tokens from Sanidad portal...');
    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });

    await new Promise(r => setTimeout(r, 15000));

    if (!authToken || !xsrfToken) {
      console.error('❌ Auth failed: No tokens captured on Sanidad domain.');
      process.exit(1);
    }

    console.log('🎯 Phase 2: Running offset-based fetch (GET to Sanidad API)...');
    
    // We execute the fetch inside the browser context to use the captured tokens and avoid CORS/Auth issues
    const allRecords = await page.evaluate(async (token, xsrf) => {
      let results = [];
      let offset = 0;
      const LIMIT = 400;
      const MAX_RECORDS = 20000; // Safety cap
      
      while (offset < MAX_RECORDS) {
        try {
          const url = `https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&offset=${offset}&limit=${LIMIT}`;
          console.log(`Fetching ${url}...`);
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-XSRF-TOKEN': xsrf,
              'Process-Type': 'MENU'
            }
          });

          if (!response.ok) {
            console.error(`HTTP Error: ${response.status}`);
            break;
          }
          const data = await response.json();
          
          if (Array.isArray(data) && data.length > 0) {
            const firstId = data[0].numorden || data[0].n_ORDEN;
            console.log(`   Offset ${offset}: Received ${data.length} records. (First Order: ${firstId})`);
            
            // Check for repeats (if the first record is the same as the last record of previous fetch)
            if (results.length > 0 && results[results.length - 1].n_ORDEN === firstId) {
               console.log('   ⚠️ Data is repeating. Pagination might be failing. Stopping.');
               break;
            }

            results = results.concat(data);
            if (data.length < LIMIT) break;
            offset += data.length;
          } else {
            console.log(`   Offset ${offset}: No more records.`);
            break;
          }
        } catch (e) {
          console.error(`   Error at offset ${offset}: ${e.message}`);
          break;
        }
      }
      return results;
    }, authToken, xsrfToken);

    if (allRecords && allRecords.length > 0) {
      // Deduplicate by order_number
      const uniqueRecords = Array.from(new Map(allRecords.map(item => [item.numorden || item.n_ORDEN, item])).values());
      console.log(`✅ Total records captured: ${allRecords.length} (Unique: ${uniqueRecords.length})`);
      await processAndSaveData(uniqueRecords);
      
      // Update config on success
      await supabase.from('scraper_config').update({
        last_scrape_at: new Date().toISOString(),
        last_scrape_status: 'success',
        last_error_message: null,
        total_adjudications_processed: allRecords.length,
        updated_at: new Date().toISOString()
      }).limit(1);

    } else {
      console.error('❌ Failed to capture any records via page-based GET.');
      await updateConfigError('No se capturaron registros de la API.');
      process.exit(1);
    }
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
    console.error('Failed to update scraper config with error:', e.message);
  }
}

async function processAndSaveData(data) {
  console.log(`📊 Processing ${data.length} records...`);
  
  // 1. Fetch official lists for matching
  const { data: specialties } = await supabase.from('specialties').select('*');
  const { data: hospitals } = await supabase.from('hospitals').select('*');
  const { data: slots } = await supabase.from('slots').select('hospital_id, specialty_id');

  const specialtyMap = new Map((specialties || []).map(s => [s.name.toLowerCase(), s.id]));
  const hospitalMap = new Map((hospitals || []).map(h => [`${normalizeText(h.province)}-${normalizeText(h.name)}`, h.id]));
  
  // Create a helper for fuzzy matching (removing noise)
  const cleanName = (name) => {
    return normalizeText(name)
      .replace(/hospital|universitario|clinico|complejo|sanitario|fundacion|general|infantil|materno|udm|geriatria|unidad|docente/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const findBestHospitalId = (hospName, province) => {
    const provinceNorm = normalizeText(province);
    const hospNorm = normalizeText(hospName);
    
    // 1. Try direct match
    const directId = `${provinceNorm}-${hospNorm}`;
    if (hospitalMap.has(directId)) return hospitalMap.get(directId);
    
    // 2. Try matching by only the first part of the province (e.g. "VALENCIA" in "VALENCIA/VALÈNCIA")
    const provinceFirstPart = provinceNorm.split(/[\/\-]/)[0].trim();
    
    // 3. Try fuzzy match within matching province
    const provinceHospitals = (hospitals || []).filter(h => {
      const hProvNorm = normalizeText(h.province);
      return hProvNorm.includes(provinceFirstPart) || provinceNorm.includes(hProvNorm.split(/[\/\-]/)[0].trim());
    });
    
    const cleanHosp = cleanName(hospName);
    for (const h of provinceHospitals) {
      const hClean = cleanName(h.name);
      if (hClean === cleanHosp || hClean.includes(cleanHosp) || cleanHosp.includes(hClean)) {
        return h.id;
      }
    }
    
    return directId; // Fallback to generated ID
  };

  const findBestSpecialtyId = (specName) => {
    if (!specName) return 'unknown';
    const specNorm = specName.toLowerCase();
    // 1. Try direct map
    if (specialtyMap.has(specNorm)) return specialtyMap.get(specNorm);
    
    // 2. Try clean name match
    const cleanSpec = cleanName(specName);
    for (const s of (specialties || [])) {
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

  console.log(`   Valid records processed: ${upserts.length}`);
  
  // Filter only those that match an existing slot (to avoid polluting the DB)
  const slotSet = new Set((slots || []).map(s => `${s.hospital_id}|${s.specialty_id}`));
  const matchedUpserts = upserts.filter(u => slotSet.has(`${u.hospital_id}|${u.specialty_id}`));
  
  console.log(`   Records matching known slots: ${matchedUpserts.length}`);

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

  console.log(`   ✅ Successfully upserted ${successCount} matched records.`);

  if (successCount > 0) {
    try {
      await supabase.rpc('update_available_slots');
      console.log('   ✅ Available slots updated in database!');
    } catch (e) {
      console.error('   ⚠️ RPC error updating slots:', e.message);
    }
    console.log(`🚀 Total records synced: ${successCount}`);
  }
}

runScraper();
