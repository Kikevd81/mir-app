async function test() {
    console.log('Fetching initial page to get cookies...');
    const r1 = await fetch('https://fse.sanidad.gob.es/fseweb/', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
    });
    const setCookie = r1.headers.get('set-cookie');
    console.log('Set-Cookie:', setCookie);

    console.log('\nFetching token...');
    const r2 = await fetch('https://fse.sanidad.gob.es/hera/oauth/api/v1/oidc/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Cookie': setCookie ? setCookie.split(';')[0] : ''
        },
        body: 'client_id=herapublico&grant_type=client_no_identification&state=abc-123'
    });
    console.log('Token Status:', r2.status);
    console.log('Token Body:', await r2.text());
}
test();
