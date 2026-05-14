import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function countRows() {
  console.log('🚀 Counting rows in the adjudication table...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(
      'https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas',
      { waitUntil: 'networkidle2', timeout: 120000 }
    );
    await new Promise(r => setTimeout(r, 20000));

    const rowCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      return rows.length;
    });

    console.log(`✅ Found ${rowCount} rows (including header).`);

    const sampleRow = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      if (rows.length > 1) {
          return rows[1].innerText;
      }
      return 'No rows found';
    });
    console.log(`Sample row: ${sampleRow}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

countRows();
