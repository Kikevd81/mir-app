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
  console.log('🚀 Starting "Reliable Hunter" MIR Scraper...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  let interceptedData = null;

  page.on('response', async (response) => {
    const url = response.url();
    // Targeted capture of the adjudication list
    if (url.includes('getPlazasAdjudicadas/listados/M') && response.status() === 200) {
      try {
        const text = await response.text();
        if (text && text.includes('numOrden')) {
          const json = JSON.parse(text);
          const data = json.data || json;
          if (Array.isArray(data)) {
            console.log(`🎯 TARGET ACQUIRED: Captured ${data.length} adjudications!`);
            interceptedData = data;
          }
        }
      } catch (e) {}
    }
  });

  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`📡 Attempt ${attempt}/3: Navigating...`);
      try {
        await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
          waitUntil: 'domcontentloaded', // Faster than networkidle2
          timeout: 60000
        });
      } catch (e) {
        console.log('⚠️ Navigation timeout, but proceeding to see if page loaded enough...');
      }

      await new Promise(r => setTimeout(r, 5000));
      
      console.log('🖱️ Selecting MEDICINA...');
      await page.evaluate(() => {
        const selects = document.querySelectorAll('select');
        for (const s of selects) {
          if (s.innerHTML.includes('MEDICINA')) {
            s.value = 'M';
            s.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      });

      console.log('⏳ Waiting for specialties...');
      await new Promise(r => setTimeout(r, 8000));

      console.log('🖱️ Clicking Consultar...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a.btn, span'));
        const target = btns.find(b => b.innerText?.includes('Consultar') || b.textContent?.includes('Consultar'));
        if (target) {
          const actualBtn = target.closest('button') || target;
          actualBtn.click();
          return true;
        }
        return false;
      });

      console.log('⏳ Waiting for data flow (30s max)...');
      for (let i = 0; i < 30; i++) {
        if (interceptedData) break;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (interceptedData) break;
      console.log('⚠️ No data flow detected. Refreshing...');
    }

    if (interceptedData) {
      await processAndSaveData(interceptedData);
      console.log('🏁 Scraper finished successfully!');
    } else {
      console.error('❌ Data capture failed.');
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
    const normProv = normalizeText(province);
    const normLoc = normalizeText(locality);
    const p1 = `${normProv}-${normLoc}-${normName}`;
    const p2 = `${normProv}-${normName}`;
    if (existingHospitalIds.includes(p1)) return p1;
    if (existingHospitalIds.includes(p2)) return p2;
    return existingHospitalIds.find(id => id.includes(normName)) || p2;
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
      if (!sName || !hName) return null;
      return {
        order_number: item.numOrden || item.numorden,
        specialty_name: sName,
        hospital_name: hName,
        province: item.descProvincia || item.descprovincia,
        locality: item.descLocalidad || item.desclocalidad || item.descProvincia,
        region: item.descComunidad || item.desccomunidad,
        specialty_id: findBestSpecialtyId(sName),
        hospital_id: findBestHospitalId(hName, item.descProvincia || '', item.descLocalidad || '')
      };
    }).filter(Boolean);
    
    const { error } = await supabase.from('adjudications').upsert(upserts, { onConflict: 'order_number' });
    if (error) console.error('❌ Upsert error:', error.message);
  }

  console.log('🔄 Syncing slots availability...');
  await supabase.rpc('update_available_slots');
}

runScraper();
