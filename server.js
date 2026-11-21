const http = require('http');
const INSTANCES = [
  'https://api.cobalt.liubquanti.click/',
  'https://cobaltapi.cjs.nz/',
];
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}
async function tryInstance(base, body) {
  const r = await fetch(base, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json().catch(() => null);
  if (!j || j.status === 'error') throw new Error((j && j.error && j.error.code) || 'instance error');
  return j;
}
const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, service: 'video-downloader-api' }));
  }
  if (req.method === 'POST' && req.url === '/api/fetch') {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 100000) req.destroy(); });
    req.on('end', async () => {
      let body;
      try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      if (!body.url || typeof body.url !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', error: { code: 'relay.bad_request' } }));
      }
      const payload = {
        url: body.url,
        videoQuality: body.videoQuality || '720',
        downloadMode: body.downloadMode || 'auto',
        filenameStyle: 'basic',
        alwaysProxy: true,
      };
      let lastErr = 'unknown';
      for (const inst of INSTANCES) {
        try {
          const j = await tryInstance(inst, payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(j));
        } catch (e) { lastErr = String(e && e.message || e); }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', error: { code: 'relay.all_failed', detail: lastErr } }));
    });
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', error: { code: 'relay.not_found' } }));
});
const port = process.env.PORT || 10000;
server.listen(port, () => console.log('video-downloader-api listening on', port));
