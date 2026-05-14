import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function dumpButtons() {
  console.log('🚀 Dumping button HTML...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );
    await new Promise(r => setTimeout(r, 15000));

    const buttonData = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('button, a, .btn, [role="button"]'));
      return items.map(i => ({
        tag: i.tagName,
        text: i.innerText,
        title: i.getAttribute('title'),
        class: i.className,
        onclick: i.getAttribute('onclick'),
        html: i.outerHTML
      }));
    });

    console.log(JSON.stringify(buttonData, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

dumpButtons();
