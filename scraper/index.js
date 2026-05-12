require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

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
  console.log('🚀 Starting "God Mode" MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  let authToken = null;

  // Intercept headers to grab the Authorization token
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers['authorization'] || headers['Authorization']) {
      authToken = headers['authorization'] || headers['Authorization'];
    }
    request.continue();
  });

  try {
    console.log('📡 Navigating to Portal...');
    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // Wait for a token to appear
    console.log('⏳ Waiting for security token...');
    for (let i = 0; i < 20; i++) {
      if (authToken) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!authToken) {
      console.log('⚠️ No token found automatically. Forcing selection...');
      await page.evaluate(() => {
        const selects = document.querySelectorAll('select');
        for (const s of selects) {
          if (s.innerHTML.includes('MEDICINA')) {
            s.value = 'M';
            s.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
      await new Promise(r => setTimeout(r, 5000));
    }

    if (authToken) {
      console.log('🔑 Token captured! Forcing internal fetch...');
      const data = await page.evaluate(async (token) => {
        try {
          const response = await fetch('https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas/listadosInicialPlazas', {
            headers: { 'Authorization': token }
          });
          const json = await response.json();
          return json.data || json;
        } catch (e) {
          return null;
        }
      }, authToken);

      if (data && Array.isArray(data) && data.length > 100) {
        console.log(`🎯 SUCCESS: Extracted ${data.length} records!`);
        await processAndSaveData(data);
        console.log('🏁 Scraper finished successfully!');
      } else {
        console.error('❌ Internal fetch failed or returned no data.');
        process.exit(1);
      }
    } else {
      console.error('❌ Could not capture security token.');
      process.exit(1);
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
  const specialtyMap = new Map(specialties.map(s => [s.name.toLowerCase(), s.id]));
  const { data: existingSlots } = await supabase.from('slots').select('hospital_id');
  const existingHospitalIds = [...new Set(existingSlots.map(s => s.hospital_id))];

  const findBestHospitalId = (hospName, province, locality) => {
    const normName = normalizeText(hospName);
    const p1 = `${normalizeText(province)}-${normalizeText(locality)}-${normName}`;
    const p2 = `${normalizeText(province)}-${normName}`;
    return existingHospitalIds.includes(p1) ? p1 : (existingHospitalIds.includes(p2) ? p2 : p2);
  };

  const upserts = data.map(item => {
    const sName = item.descEspecialidad || item.descespecialidad;
    const hName = item.descCentro || item.desccentro;
    if (!sName || !hName) return null;
    return {
      order_number: item.numOrden || item.numorden,
      specialty_name: sName,
      hospital_name: hName,
      province: item.descProvincia || item.descprovincia,
      locality: item.descLocalidad || item.desclocalidad || item.descProvincia,
      region: item.descComunidad || item.desccomunidad,
      specialty_id: specialtyMap.get(sName.toLowerCase()) || generateId(sName),
      hospital_id: findBestHospitalId(hName, item.descProvincia || '', item.descLocalidad || '')
    };
  }).filter(Boolean);

  const BATCH_SIZE = 200;
  for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
    await supabase.from('adjudications').upsert(upserts.slice(i, i + BATCH_SIZE), { onConflict: 'order_number' });
  }
  await supabase.rpc('update_available_slots');
}

runScraper();
