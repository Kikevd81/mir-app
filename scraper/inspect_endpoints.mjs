import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function inspectEndpoints() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const captured = [];

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('PlazasAdjudicadas') || url.includes('plazasAdjudicadas')) {
      try {
        const body = await response.text();
        captured.push({ url, status: response.status(), size: body.length, preview: body.substring(0, 500) });
      } catch (e) { /* ignore */ }
    }
  });

  await page.goto(
    'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
    { waitUntil: 'networkidle2', timeout: 60000 }
  );
  await new Promise(r => setTimeout(r, 10000));

  console.log(`\n=== Captured ${captured.length} responses ===\n`);
  for (const c of captured) {
    console.log(`URL: ${c.url}`);
    console.log(`Status: ${c.status} | Size: ${c.size} bytes`);
    console.log(`Preview: ${c.preview}\n---\n`);
  }

  // Now try to find and click the PDF button
  console.log('=== Looking for PDF/export elements ===');
  const elements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all
      .filter(el => {
        const t = (el.innerText || '').toLowerCase();
        const h = (el.outerHTML || '').toLowerCase();
        return h.includes('pdf') || h.includes('imprimir') || h.includes('descargar') || h.includes('excel')
          || h.includes('fa-file') || h.includes('fa-print') || h.includes('fa-download');
      })
      .slice(0, 20)
      .map(el => ({ tag: el.tagName, text: (el.innerText || '').substring(0, 80), html: el.outerHTML.substring(0, 300) }));
  });
  console.log(JSON.stringify(elements, null, 2));

  await browser.close();
}

inspectEndpoints();
