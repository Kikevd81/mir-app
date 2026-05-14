async function guessApi() {
  const baseUrl = 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas';
  const variants = [
    '/listados/M',
    '/listados/M/2024',
    '/listados/M?convocatoria=2024',
    '/listados/1',
    '/listados/1/2024',
    '/getPlazasAdjudicadas?titulacion=1&convocatoria=2024',
    '/listadoAdjudicaciones?titulacion=1&convocatoria=2024'
  ];

  console.log('🧐 Guessing the correct API endpoint...');

  for (const variant of variants) {
    const url = variant.startsWith('http') ? variant : `${baseUrl}${variant}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      console.log(`Testing ${url} -> Status: ${res.status}`);
      if (res.ok) {
        const json = await res.json();
        const count = Array.isArray(json) ? json.length : (json.data ? json.data.length : (json.listado ? json.listado.length : (Array.isArray(json) ? json.length : 0)));
        console.log(`   ✅ Success! Items: ${count}`);
        if (count > 100) {
          console.log(`   🌟 FOUND IT! URL: ${url}`);
          process.exit(0);
        }
      }
    } catch (e) {
      console.log(`   ❌ Failed ${url}: ${e.message}`);
    }
  }
}

guessApi();
