const res = await fetch('https://fse.sanidad.gob.es/hera/oauth/api/v1/oidc/token', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    body: 'client_id=herapublico&grant_type=client_no_identification&state=abc-123'
});
console.log(res.status, await res.text());
