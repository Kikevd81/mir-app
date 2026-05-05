require('dotenv').config({ path: '../.env' });
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to normalize IDs (same as in your app)
const normalizeText = (text) => {
  if (!text) return '';
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const generateId = (text) => {
  return normalizeText(text)
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

async function runScraper() {
  console.log('🚀 Starting MIR Scraper...');

  // Check configuration first
  const { data: config, error: configError } = await supabase
    .from('scraper_config')
    .select('is_enabled')
    .single();

  if (configError) {
    console.error('⚠️ Could not check config, proceeding anyway:', configError.message);
  } else if (config && config.is_enabled === false) {
    console.log('🛑 Scraper is disabled in the database configuration. Exiting.');
    process.exit(0);
  }

  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set a larger timeout
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  let adjudicacionesData = null;

  // Intercept network requests
  page.on('response', async (response) => {
    const request = response.request();
    const url = request.url();
    
    // We are looking for the getPlazasAdjudicadas API call
    if (url.includes('getPlazasAdjudicadas') && request.method() === 'GET') {
      console.log(`\n📥 Intercepted response from: ${url}`);
      try {
        const json = await response.json();
        if (json && json.data) {
          adjudicacionesData = json.data;
          console.log(`✅ Extracted ${adjudicacionesData.length} records from JSON!`);
        }
      } catch (e) {
        console.log("Failed to parse JSON:", e.message);
      }
    }
  });

  console.log('🌐 Navigating to the Ministry website...');
  await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {
    waitUntil: 'networkidle2'
  });

  console.log('⏳ Waiting for Angular to load...');
  await page.waitForTimeout(3000);

  try {
    console.log('🖱️ Selecting "MEDICINA" in Titulación dropdown...');
    // Find the ng-select for Titulación and click it
    // The dropdowns are likely ng-select components
    const dropdowns = await page.$$('ng-select');
    if (dropdowns.length > 0) {
      await dropdowns[0].click();
      await page.waitForTimeout(1000);
      
      // Look for the "MEDICINA" option
      const options = await page.$$('.ng-option');
      for (const option of options) {
        const text = await option.evaluate(el => el.textContent);
        if (text && text.includes('MEDICINA')) {
          await option.click();
          break;
        }
      }
    }

    await page.waitForTimeout(1000);

    console.log('🔍 Clicking "Buscar"...');
    // Find the submit button
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text && text.toLowerCase().includes('buscar')) {
        await btn.click();
        break;
      }
    }

    // Wait for the data to be intercepted
    console.log('⏳ Waiting for API response...');
    for (let i = 0; i < 15; i++) {
      if (adjudicacionesData) break;
      await page.waitForTimeout(1000);
    }

  } catch (error) {
    console.error('❌ Error interacting with the page:', error);
  }

  await browser.close();

  if (adjudicacionesData && adjudicacionesData.length > 0) {
    await processAndSaveData(adjudicacionesData);
  } else {
    console.log('⚠️ No data was captured. The scraper might need to be adjusted or there are no adjudications yet.');
  }
}

async function processAndSaveData(data) {
  console.log(`💾 Processing ${data.length} records for Supabase...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const item of data) {
    try {
      // Map the API fields to our database fields
      // Expected API fields: numOrden (or numorden), desEspecialidad (or desespec), desCentro (or descentro), localidad, despro, fechaHoraAdju
      const orderNumber = item.numOrden || item.numorden;
      const specialtyName = item.desEspecialidad || item.desespec || '';
      const hospitalName = item.desCentro || item.descentro || '';
      const province = item.despro || item.provincia || '';
      const locality = item.localidad || item.deslocalidad || '';
      const dateAdjudicated = item.fechaHoraAdju || item.fechaHora || new Date().toISOString();

      if (!orderNumber || !specialtyName) continue;

      const specId = generateId(specialtyName);
      const hospId = generateId(`${province}-${hospitalName}`);

      const { error } = await supabase
        .from('adjudications')
        .upsert({
          order_number: orderNumber,
          specialty_name: specialtyName,
          hospital_name: hospitalName,
          region: '', // We might not have this directly, but province is more important
          province: province,
          locality: locality,
          adjudication_datetime: parseDate(dateAdjudicated),
          specialty_id: specId,
          hospital_id: hospId,
          scraped_at: new Date().toISOString()
        }, { onConflict: 'order_number' });

      if (error) {
        console.error(`Error saving order ${orderNumber}:`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    } catch (e) {
      errorCount++;
    }
  }

  console.log(`✅ Saved ${successCount} new records.`);
  if (errorCount > 0) console.log(`❌ Failed to save ${errorCount} records.`);

  console.log('🔢 Updating available slots...');
  const { error: rpcError } = await supabase.rpc('update_available_slots');
  
  if (rpcError) {
    console.error('⚠️ Error updating available slots:', rpcError);
  } else {
    console.log('✅ Available slots updated successfully!');
  }
  
  process.exit(0);
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  // If it's already ISO
  if (dateStr.includes('T')) return dateStr;
  
  // Try to parse format "DD/MM/YYYY HH:mm:ss"
  try {
    const parts = dateStr.split(' ');
    if (parts.length === 2) {
      const [day, month, year] = parts[0].split('/');
      return `${year}-${month}-${day}T${parts[1]}Z`;
    }
  } catch (e) {
    // Ignore and return current
  }
  return new Date().toISOString();
}

runScraper();
