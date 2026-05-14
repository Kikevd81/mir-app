import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function dumpButtonsAfterSearch() {
  console.log('🚀 Dumping buttons after Medicine search...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );
    await new Promise(r => setTimeout(r, 15000));

    await page.click('ng-select');
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 200));
    }
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));
    await page.click('button.btn-primary');
    await new Promise(r => setTimeout(r, 20000));

    const buttons = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, a, .btn, [role="button"], i, em, span'));
      return all
        .filter(el => {
            const h = el.outerHTML.toLowerCase();
            return h.includes('pdf') || h.includes('print') || h.includes('descargar') || h.includes('export') || h.includes('imprimir');
        })
        .map(el => ({
            tag: el.tagName,
            text: el.innerText,
            html: el.outerHTML
        }));
    });

    console.log(JSON.stringify(buttons, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

dumpButtonsAfterSearch();
