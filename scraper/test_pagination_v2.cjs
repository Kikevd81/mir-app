const puppeteer = require('puppeteer');

async function testPagination() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('📡 Testing pagination variants...');
  // Capture tokens and headers
  let authToken = '';
  page.on('request', request => {
    if (request.url().includes('getPlazasAdjudicadas')) {
      const auth = request.headers()['authorization'];
      if (auth) authToken = auth;
    }
  });

  await page.goto('https://fse.sanidad.gob.es/hera/oferta/ConsultaPlazasAdjudicadas.do?metodo=inicio&idTitulo=M');
  
  // Wait for some requests to happen
  await new Promise(r => setTimeout(r, 5000));
  
  const cookies = await page.cookies();
  const xsrfToken = cookies.find(c => c.name === 'XSRF-TOKEN')?.value;
  
  console.log(`🔑 Tokens: Auth=${authToken.substring(0, 15)}... XSRF=${xsrfToken}`);

    { name: 'limit=5000', url: 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&offset=0&limit=5000' },
    { name: 'offset=0, limit=10', url: 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&offset=0&limit=10' },
    { name: 'offset=10, limit=10', url: 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&offset=10&limit=10' },
    { name: 'page=1, limit=10', url: 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&page=1&limit=10' },
    { name: 'page=2, limit=10', url: 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&page=2&limit=10' },
    { name: 'pageNumber=1, pageSize=10', url: 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&pageNumber=1&pageSize=10' },
    { name: 'pageNumber=2, pageSize=10', url: 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?tipoBusqueda=&idTitulo=M&pageNumber=2&pageSize=10' },
  ];

  for (const v of variants) {
    try {
      const resp = await page.evaluate(async ({ url, token, xsrf }) => {
        const r = await fetch(url, { 
          headers: { 
            'Accept': 'application/json',
            'Authorization': token,
            'X-XSRF-TOKEN': xsrf
          } 
        });
        return await r.json();
      }, { url: v.url, token: authToken, xsrf: xsrfToken });
      
      if (Array.isArray(resp)) {
        const firstId = resp.length > 0 ? (resp[0].numorden || resp[0].n_ORDEN) : 'none';
        console.log(`- ${v.name}: Received ${resp.length} records. First Order: ${firstId}`);
      } else {
        console.log(`- ${v.name}: Unexpected response format: ${JSON.stringify(resp).substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`- ${v.name}: Failed - ${e.message}`);
    }
  }

  await browser.close();
}

testPagination();
