require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const generateId = (text) => normalizeText(text);

async function runScraper() {
  console.log('🐴 Starting "Inside Trojan" MIR Scraper...');
  console.log('   Strategy: Hijack Angular session → Direct API call');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Phase 1: Intercept the Bearer token from the Angular app's auth flow
  let authToken = null;
  let xsrfToken = null;

  page.on('request', (request) => {
    const headers = request.headers();
    if (headers['authorization'] && headers['authorization'].startsWith('Bearer ')) {
      authToken = headers['authorization'].replace('Bearer ', '');
      console.log(`🔑 Token captured: ${authToken.substring(0, 20)}...`);
    }
    if (headers['x-xsrf-token']) {
      xsrfToken = headers['x-xsrf-token'];
      console.log(`🛡️ XSRF token captured: ${xsrfToken.substring(0, 20)}...`);
    }
  });

  // Also listen for token in responses (from the OAuth endpoint)
  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (url.includes('oidc/token') && response.status() === 200) {
        const json = await response.json();
        if (json.access_token) {
          authToken = json.access_token;
          console.log(`🔑 Token from OAuth: ${authToken.substring(0, 20)}...`);
        }
      }
    } catch (e) {}
  });

  try {
    // Phase 1: Let Angular boot and authenticate
    console.log('📡 Phase 1: Loading portal and letting Angular authenticate...');
    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
      waitUntil: 'networkidle2',
      timeout: 90000
    });

    // Wait for the app to fully initialize and make its auth calls
    await new Promise(r => setTimeout(r, 10000));

    console.log(`🔐 Auth status: token=${authToken ? 'YES' : 'NO'}, xsrf=${xsrfToken ? 'YES' : 'NO'}`);

    // Phase 2: Make direct API call from within the page context
    console.log('🎯 Phase 2: Direct API call to getPlazasAdjudicadas...');
    
    const apiData = await page.evaluate(async (token, xsrf) => {
      // Build headers exactly like the Angular app does
      const headers = {
        'Content-Type': 'application/json',
        'pragma': 'no-cache',
        'cache-control': 'no-cache'
      };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
      headers['Process-Type'] = 'MENU';

      // Call the API with tipoBusqueda empty (get all) and idTitulo for MEDICINA
      const params = new URLSearchParams();
      params.set('tipoBusqueda', '');
      params.set('idTitulo', 'M');  // MEDICINA

      const url = '/hera/api/datos/convocatoria/getPlazasAdjudicadas?' + params.toString();
      
      try {
        const response = await fetch(url, { headers, credentials: 'include' });
        if (!response.ok) {
          return { error: `HTTP ${response.status}: ${await response.text()}` };
        }
        const data = await response.json();
        return { success: true, data: data, count: Array.isArray(data) ? data.length : (data.data ? data.data.length : 'unknown') };
      } catch (e) {
        return { error: e.message };
      }
    }, authToken, xsrfToken);

    if (apiData.error) {
      console.log(`⚠️ First attempt failed: ${apiData.error}`);
      console.log('🔄 Trying alternative: getPlazasAdjudicadasTotal...');
      
      // Try the Total endpoint
      const totalData = await page.evaluate(async (token, xsrf) => {
        const headers = {
          'Content-Type': 'application/json',
          'pragma': 'no-cache',
          'cache-control': 'no-cache'
        };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
        headers['Process-Type'] = 'MENU';

        try {
          // Try multiple endpoints
          const endpoints = [
            '/hera/api/datos/convocatoria/getPlazasAdjudicadasTotal',
            '/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=plazaCentro&idTitulo=M',
            '/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M',
            '/hera/api/datos/convocatoria/getPlazasAdjudicadas'
          ];
          
          for (const endpoint of endpoints) {
            const response = await fetch(endpoint, { headers, credentials: 'include' });
            if (response.ok) {
              const data = await response.json();
              const records = Array.isArray(data) ? data : (data.data || data);
              if (Array.isArray(records) && records.length > 0) {
                return { success: true, data: records, endpoint };
              }
            }
          }
          return { error: 'All endpoints returned empty or failed' };
        } catch (e) {
          return { error: e.message };
        }
      }, authToken, xsrfToken);
      
      if (totalData.success) {
        console.log(`✅ Got ${totalData.data.length} records from ${totalData.endpoint}`);
        await processAndSaveData(totalData.data);
        console.log('🏁 Scraper finished successfully!');
      } else {
        console.error(`❌ All API attempts failed: ${totalData.error}`);
        process.exit(1);
      }
    } else {
      const records = Array.isArray(apiData.data) ? apiData.data : (apiData.data?.data || apiData.data);
      if (Array.isArray(records) && records.length > 0) {
        console.log(`✅ Got ${records.length} records from primary endpoint`);
        await processAndSaveData(records);
        console.log('🏁 Scraper finished successfully!');
      } else {
        console.log(`⚠️ API returned data but no records array. Response shape: ${JSON.stringify(apiData).substring(0, 200)}`);
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function processAndSaveData(data) {
  console.log(`📊 Processing ${data.length} records...`);
  const { data: specialties } = await supabase.from('specialties').select('*');
  const specialtyMap = new Map((specialties || []).map(s => [s.name.toLowerCase(), s.id]));
  const { data: existingSlots } = await supabase.from('slots').select('hospital_id');
  const existingHospitalIds = [...new Set((existingSlots || []).map(s => s.hospital_id))];

  const findBestHospitalId = (hospName, province, locality) => {
    const normName = normalizeText(hospName);
    const p2 = `${normalizeText(province)}-${normName}`;
    return existingHospitalIds.includes(p2) ? p2 : p2;
  };

  const upserts = data.map(item => {
    const sName = item.desespec || item.descEspecialidad;
    const hName = item.descentro || item.descCentro;
    if (!sName || !hName) return null;

    const province = item.despro || item.descProvincia || '';
    
    return {
      order_number: parseInt(item.numorden || item.numOrden),
      specialty_name: sName,
      hospital_name: hName,
      province: province,
      specialty_id: specialtyMap.get(sName.toLowerCase()) || generateId(sName),
      hospital_id: findBestHospitalId(hName, province, '')
    };
  }).filter(Boolean);

  console.log(`   Valid records to upsert: ${upserts.length}`);
  const BATCH_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    const batch = upserts.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('adjudications').upsert(batch, { onConflict: 'order_number' });

    if (error) {
      console.error(`   ❌ Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
      if (error.message.includes('WHERE clause')) {
        console.error('   ⚠️ DATABASE BLOCK: A trigger in your Supabase database is preventing updates.');
        console.error('   👉 FIX: Apply the updated SQL in 003_scraper_trigger.sql to your Supabase SQL Editor.');
        break; 
      }
    } else {
      console.log(`   ✅ Batch ${i / BATCH_SIZE + 1}: ${batch.length} records OK`);
      successCount += batch.length;
    }
  }

  if (successCount > 0) {
    try {
      await supabase.rpc('update_available_slots');
      console.log('   ✅ Available slots updated in database!');
    } catch (e) {
      console.error('   ⚠️ RPC error updating slots:', e.message);
    }
    console.log(`🚀 Total records processed: ${successCount}`);
  }
}

runScraper();



