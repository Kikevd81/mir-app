import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

dotenv.config();
puppeteer.use(StealthPlugin());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const cleanName = (name) => {
    return normalizeText(name)
      .replace(/hospital|universitario|clinico|complejo|sanitario|fundacion|general|infantil|materno|udm|geriatria|unidad|docente|serv\.|u\.|h\.|hosp\.|univ\./g, '')
      .replace(/\s+/g, ' ')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .trim();
};

async function debugUnmatched() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.goto('https://fse.sanidad.gob.es/fseweb/#/principal/adjudicacionPlazas/ConsultaPlazasAdjudicadas', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 10000));

        let authToken, xsrfToken;
        const requests = await page.evaluate(() => window.performance.getEntriesByType('resource')
            .filter(r => r.name.includes('/hera/api/'))
            .map(r => r.name));
        
        // This is not reliable, I'll use the same logic as index.js
        // ... (skipping token capture for brevity, I'll just use the endpoint test results if I can)
        
        // Actually, I'll just load the data from a file if I saved it, or fetch it again.
        // For now, I'll just assume I can fetch it.
    } catch (e) {}
}

// I'll create a simpler diagnostic script that just compares DB data with a sample of the API response I got earlier.
// I'll use the preview I got in the previous turn.
