
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', {waitUntil: 'networkidle2'});
  
  // Wait for the dropdown and select MIR
  await page.waitForSelector('select');
  await page.select('select', 'M'); // M is for MIR
  
  await new Promise(r => setTimeout(r, 5000));
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, i')).map(el => ({
      tag: el.tagName,
      text: el.innerText || el.title || '',
      html: el.outerHTML.substring(0, 200)
    })).filter(b => b.text.toLowerCase().includes('pdf') || b.text.toLowerCase().includes('descargar') || b.text.toLowerCase().includes('imprimir') || b.html.toLowerCase().includes('pdf'));
  });
  console.log(JSON.stringify(buttons, null, 2));
  await browser.close();
})();
