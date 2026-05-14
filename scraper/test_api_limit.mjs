import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

puppeteer.use(StealthPlugin());

async function testLimit() {
  console.log('🚀 Testing if API accepts higher limits...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    
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

    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );

    await new Promise(r => setTimeout(r, 15000));

    if (!authToken) {
      console.error('❌ No token captured');
      return;
    }

    const testLimits = [500, 1000, 2000, 5000];
    for (const limit of testLimits) {
      console.log(`📡 Trying limit=${limit}...`);
      const count = await page.evaluate(async (token, xsrf, lim) => {
        const url = `https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&offset=0&limit=${lim}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-XSRF-TOKEN': xsrf,
            'Accept': 'application/json',
            'Process-Type': 'MENU'
          }
        });
        if (!response.ok) return -1;
        const data = await response.json();
        return Array.isArray(data) ? data.length : 0;
      }, authToken, xsrfToken, limit);

      console.log(`   Result for ${limit}: ${count} records`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testLimit();
