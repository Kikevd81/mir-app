import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testTotalEndpoint() {
  console.log('🚀 Testing getPlazasAdjudicadasTotal endpoint...');
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

    if (!authToken) {
        console.log('❌ No auth token found.');
        return;
    }

    const url = 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadasTotal?tipoBusqueda=&idTitulo=M&orden=null';
    console.log(`📡 Fetching ${url}...`);
    
    const result = await page.evaluate(async (u, token, xsrf) => {
      try {
        const response = await fetch(u, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-XSRF-TOKEN': xsrf,
            'Accept': 'application/json',
            'Process-Type': 'MENU'
          }
        });
        if (!response.ok) return { error: response.status, statusText: response.statusText };
        const data = await response.json();
        return { 
          length: Array.isArray(data) ? data.length : (data.length ? 'object with length' : -1), 
          preview: JSON.stringify(data).substring(0, 500)
        };
      } catch (e) {
        return { error: e.message };
      }
    }, url, authToken, xsrfToken);

    console.log(`Result: ${JSON.stringify(result, null, 2)}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testTotalEndpoint();
