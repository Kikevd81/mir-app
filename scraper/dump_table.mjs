import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function dumpTableData() {
  console.log('🚀 Dumping all rendered table rows...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );
    await new Promise(r => setTimeout(r, 15000));

    // Search for Medicina
    await page.click('ng-select');
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));
    await page.click('button.btn-primary');
    await new Promise(r => setTimeout(r, 20000));

    const tableData = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.map(r => r.innerText.replace(/\t/g, ' | '));
    });

    console.log(`✅ Scraped ${tableData.length} rows.`);
    console.log('--- First 5 rows ---');
    console.log(tableData.slice(0, 5).join('\n'));
    console.log('--- Last 5 rows ---');
    console.log(tableData.slice(-5).join('\n'));

    // Check for "Total" or pagination info in the text
    const pageText = await page.evaluate(() => document.body.innerText);
    const match = pageText.match(/(\d+)\s+of\s+(\d+)/i) || pageText.match(/(\d+)\s+de\s+(\d+)/i);
    if (match) console.log(`🔢 Pagination found: ${match[0]}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

dumpTableData();
