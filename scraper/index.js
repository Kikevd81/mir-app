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
  console.log('🚀 Starting "Token Extraction" MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let interceptedData = null;
  let authHeader = null;

  // Intercept requests to steal the Authorization header
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const headers = request.headers();
    if (headers['authorization'] || headers['Authorization']) {
      authHeader = headers['authorization'] || headers['Authorization'];
    }
    request.continue();
  });

  // Intercept responses as a backup
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('listadosInicialPlazas') || url.includes('listadosInicial')) {
      try {
        const text = await response.text();
        if (text && text.length > 5000) {
          const json = JSON.parse(text);
          const data = json.data || json;
          if (Array.isArray(data) && data.length > 100) {
            interceptedData = data;
          }
        }
      } catch (e) {}
    }
  });

  try {
    console.log('📡 Navigating to Ministry Portal...');
    await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('🖱️ Selecting MEDICINA to trigger token generation...');
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      for (const s of selects) {
        if (s.innerText.includes('MEDICINA') || s.innerHTML.includes('MEDICINA')) {
          s.value = s.options[1].value;
          s.dispatchEvent(new Event('change'));
        }
      }
    });

    // Wait for the token to be captured
    let waitCount = 0;
    while (!authHeader && waitCount < 15) {
      await new Promise(r => setTimeout(r, 1000));
      waitCount++;
    }

    if (authHeader) {
      console.log('🔑 Authorization Token captured! Executing privileged fetch...');
      const data = await page.evaluate(async (token) => {
        const response = await fetch('https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas/listadosInicialPlazas', {
          headers: { 'Authorization': token }
        });
        const json = await response.json();
        return json.data || json;
      }, authHeader);

      if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ SUCCESS: Fetched ${data.length} records using captured token.`);
        interceptedData = data;
      }
    }

    if (!interceptedData) {
      console.log('🔄 Token fetch failed, trying final manual interaction...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.innerText.includes('Consultar'));
        if (target) target.click();
      });
      let finalWait = 0;
      while (!interceptedData && finalWait < 20) {
        await new Promise(r => setTimeout(r, 1000));
        finalWait++;
      }
    }

    if (interceptedData) {
      await processAndSaveData(interceptedData);
      console.log('🏁 Scraper finished successfully!');
    } else {
      console.error('❌ Failed to capture data. Portal might be down or heavily protected.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Scraper error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function processAndSaveData(data) {
  console.log('📊 Processing data...');
  
  const { data: specialties } = await supabase.from('specialties').select('*');
  const specialtyMap = new Map(specialties.map(s => [s.name.toLowerCase(), s.id]));

  const { data: existingSlots } = await supabase.from('slots').select('hospital_id');
  const existingHospitalIds = [...new Set(existingSlots.map(s => s.hospital_id))];

  const findBestHospitalId = (hospName, province, locality) => {
    const normName = normalizeText(hospName);
    const normProv = normalizeText(province);
    const normLoc = normalizeText(locality);
    
    const patterns = [
      `${normProv}-${normLoc}-${normName}`,
      `${normProv}-${normName}`,
      normName
    ];
    
    for (const p of patterns) {
      if (existingHospitalIds.includes(p)) return p;
    }
    
    const match = existingHospitalIds.find(id => id.includes(normName));
    return match || patterns[1];
  };

  const findBestSpecialtyId = (specName) => {
    const norm = specName.toLowerCase();
    if (specialtyMap.has(norm)) return specialtyMap.get(norm);
    for (const [name, id] of specialtyMap.entries()) {
      if (norm.includes(name) || name.includes(norm)) return id;
    }
    return generateId(specName);
  };

  const BATCH_SIZE = 100;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const upserts = batch.map(item => {
      const sName = item.descEspecialidad || item.descespecialidad;
      const hName = item.descCentro || item.desccentro;
      const prov = item.descProvincia || item.descprovincia;
      const loc = item.descLocalidad || item.desclocalidad || prov;

      return {
        order_number: item.numOrden || item.numorden,
        specialty_name: sName,
        hospital_name: hName,
        province: prov,
        locality: loc,
        region: item.descComunidad || item.desccomunidad,
        specialty_id: findBestSpecialtyId(sName),
        hospital_id: findBestHospitalId(hName, prov, loc)
      };
    });

    const { error } = await supabase.from('adjudications').upsert(upserts, { onConflict: 'order_number' });
    if (error) console.error('❌ Upsert error:', error.message);
  }

  console.log('🔄 Triggering availability sync...');
  await supabase.rpc('update_available_slots');
}

runScraper();
