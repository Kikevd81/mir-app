import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testOffset() {
  console.log('🚀 Testing if API accepts offsets...');
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

    await new Promise(r => setTimeout(r, 20000));

    if (!authToken) return;

    const testOffsets = [0, 400, 800, 1200];
    for (const offset of testOffsets) {
      console.log(`📡 Trying offset=${offset}...`);
      const sample = await page.evaluate(async (token, xsrf, off) => {
        const url = `https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&offset=${off}&limit=400`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-XSRF-TOKEN': xsrf,
            'Accept': 'application/json',
            'Process-Type': 'MENU'
          }
        });
        if (!response.ok) return { error: response.status };
        const data = await response.json();
        return { length: Array.isArray(data) ? data.length : 0, firstOrder: data[0]?.numorden || 'none' };
      }, authToken, xsrfToken, offset);

      console.log(`   Result for ${offset}: ${sample.length} records, first order: ${sample.firstOrder}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testOffset();
