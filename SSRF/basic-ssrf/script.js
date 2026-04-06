// Simulated server-side fetch responses
const RESPONSES = {
  'https://example.com': { status: 200, body: `<!DOCTYPE html><html><head><title>Example Domain</title></head><body><h1>Example Domain</h1><p>This domain is for illustrative examples.</p></body></html>` },
  'http://localhost/admin': { status: 200, body: `<!DOCTYPE html><html><body><h1>Admin Panel</h1><p>Welcome, admin. Server: localhost</p><ul><li><a href="/admin/users">Users (42)</a></li><li><a href="/admin/config">Config</a></li><li><a href="/admin/logs">Logs</a></li></ul></body></html>` },
  'http://127.0.0.1:8080': { status: 200, body: `HTTP/1.1 200 OK\nServer: internal-api/1.0\nContent-Type: application/json\n\n{"status":"ok","endpoints":["/api/users","/api/orders","/api/admin/keys"],"version":"2.1.0","internal":true}` },
  'http://internal-api:3000/users': { status: 200, body: `[{"id":1,"email":"admin@securecorp.com","role":"admin","apiKey":"sk-admin-9f8e7d"},{"id":2,"email":"alice@securecorp.com","role":"user"}]` },
  'http://db.internal/status': { status: 200, body: `PostgreSQL 14.2 — db.internal:5432\nDatabases: payments, users, sessions\nConnections: 47/100\nStatus: HEALTHY\nLast backup: 2024-01-15 03:00 UTC` },
  'file:///etc/passwd': { status: 200, body: `root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\napp:x:1001:1001::/home/app:/bin/bash` },
};

const PUBLIC_DOMAINS = ['example.com', 'httpbin.org', 'google.com', 'github.com'];

const urlInput   = document.getElementById('urlInput');
const fetchBtn   = document.getElementById('fetchBtn');
const responseBox  = document.getElementById('responseBox');
const responseBar  = document.getElementById('responseBar');
const responseBody = document.getElementById('responseBody');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { urlInput.value = h.dataset.url; });
});

fetchBtn.addEventListener('click', fetchURL);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchURL(); });

function fetchURL() {
  const url = urlInput.value.trim();
  if (!url) return;

  responseBox.classList.remove('hidden');

  const match = RESPONSES[url];
  if (match) {
    responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-ok">${match.status} OK</span>`;
    responseBody.textContent = match.body;
    showExplanation(url);
  } else {
    // Check if it's a public domain
    const isPublic = PUBLIC_DOMAINS.some(d => url.includes(d));
    if (isPublic) {
      responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-ok">200 OK</span>`;
      responseBody.textContent = `<html><body><p>Response from ${url} (public — no SSRF here)</p></body></html>`;
    } else {
      responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-err">Connection refused / timeout</span>`;
      responseBody.textContent = `Error: Could not connect to ${url}\nThe host may not exist or is not reachable from this simulation.`;
    }
  }
}

function showExplanation(url) {
  explanationBox.classList.remove('hidden');
  let extra = '';
  if (url.startsWith('file://')) {
    extra = '<li><strong>File scheme:</strong> Some SSRF vulnerabilities also allow <code>file://</code> URLs, enabling local file reads — equivalent to path traversal with no web path restrictions.</li>';
  } else if (url.includes('localhost') || url.includes('127.0.0.1')) {
    extra = '<li><strong>Localhost access:</strong> The server fetched its own admin panel — which is only bound to loopback and not exposed externally. SSRF bypasses network-level access controls.</li>';
  } else if (url.includes('internal')) {
    extra = '<li><strong>Internal service pivot:</strong> The server acted as a proxy into the internal network — reaching services that have no public DNS or firewall exposure.</li>';
  }
  explanationBox.innerHTML = `
    <h3>Server-Side Request Forgery (SSRF)</h3>
    <p>The server fetched <code>${escHtml(url)}</code> and returned the response. The attacker never connected to that resource directly — the server did it on their behalf.</p>
    <ul>
      <li><strong>Root cause:</strong> User-controlled URLs passed directly to a server-side HTTP client (curl, requests, fetch) without validating the destination.</li>
      <li><strong>Impact:</strong> Access to internal services, admin panels, cloud metadata, databases — all hidden behind the server's network position.</li>
      ${extra}
      <li><strong>Fix:</strong> Use an allowlist of permitted domains/IPs. Resolve the URL's IP and reject private ranges (RFC 1918: 10.x, 172.16.x, 192.168.x, 127.x, 169.254.x). Never pass raw user input to HTTP clients.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
