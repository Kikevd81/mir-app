async function testApi() {
  console.log('Testing direct API access (using native fetch)...');
  const url = 'https://fse.sanidad.gob.es/fse-p-adjudicacion/api/adjudicacion/getPlazasAdjudicadas?titulacion=1&convocatoria=2024';
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status);
    if (response.ok) {
      const json = await response.json();
      const count = Array.isArray(json) ? json.length : (json.data ? json.data.length : 'unknown');
      console.log('Success! Captured records:', count);
    } else {
      console.log('Failed:', await response.text());
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testApi();
