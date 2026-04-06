// Simulated web cache: key = method + path only (headers excluded from key)
let cache = {}; // key -> { response, poisoned, hits }
let requestCount = 0;

const pathInput    = document.getElementById('pathInput');
const sendBtn      = document.getElementById('sendBtn');
const victimBtn    = document.getElementById('victimBtn');
const resetBtn     = document.getElementById('resetBtn');
const responseBox  = document.getElementById('responseBox');
const responseBar  = document.getElementById('responseBar');
const responseBody = document.getElementById('responseBody');
const cacheStatus  = document.getElementById('cacheStatus');
const explanationBox = document.getElementById('explanationBox');

// Hint buttons — populate headers on click
document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => {
    if (h.dataset.xfh !== undefined) {
      document.querySelector('.header-value[data-header="X-Forwarded-Host"]').value = h.dataset.xfh;
    }
    if (h.dataset.scheme !== undefined) {
      document.querySelector('.header-value[data-header="X-Forwarded-Scheme"]').value = h.dataset.scheme;
    }
    if (h.dataset.cache !== undefined) {
      document.querySelector('.header-value[data-header="Cache-Control"]').value = h.dataset.cache;
    }
  });
});

function getHeader(name) {
  const el = document.querySelector(`.header-value[data-header="${name}"]`);
  return el ? el.value.trim() : '';
}

sendBtn.addEventListener('click', sendRequest);

// Victim simulation — clean request, no special headers, hits the cache
victimBtn.addEventListener('click', () => {
  const path = pathInput.value.trim() || '/homepage';
  const cacheKey = `GET:${path}`;

  if (cache[cacheKey]) {
    const entry = cache[cacheKey];
    entry.hits++;
    responseBox.classList.remove('hidden');
    responseBar.innerHTML = `<span>GET ${escHtml(path)} (victim)</span><span class="status-ok">200 OK</span>`;
    responseBody.textContent = entry.response;
    cacheStatus.classList.remove('hidden');
    cacheStatus.className = `cache-status ${entry.poisoned ? 'poisoned' : 'hit'}`;
    cacheStatus.textContent = entry.poisoned
      ? `⚠ Cache HIT — VICTIM SERVED POISONED RESPONSE (${entry.hits} victim${entry.hits > 1 ? 's' : ''} affected)`
      : `X-Cache: HIT — Victim served clean cached response`;
    if (entry.poisoned) showExplanation(entry.injectedHost, true);
  } else {
    // No cache entry — fresh response for victim
    const content = buildResponse(path, 'securecorp.com', 'https', false);
    responseBox.classList.remove('hidden');
    responseBar.innerHTML = `<span>GET ${escHtml(path)} (victim — cache miss)</span><span class="status-ok">200 OK</span>`;
    responseBody.textContent = content;
    cacheStatus.classList.remove('hidden');
    cacheStatus.className = 'cache-status miss';
    cacheStatus.textContent = `X-Cache: MISS — No poisoned entry cached yet. Send an attacker request first.`;
  }
});

resetBtn.addEventListener('click', () => {
  cache = {};
  responseBox.classList.add('hidden');
  cacheStatus.classList.add('hidden');
  explanationBox.classList.add('hidden');
});

function sendRequest() {
  const path = pathInput.value.trim() || '/homepage';
  const host = getHeader('Host') || 'securecorp.com';
  const xfh  = getHeader('X-Forwarded-Host');
  const scheme = getHeader('X-Forwarded-Scheme') || 'https';
  const cacheControl = getHeader('Cache-Control');

  requestCount++;
  const cacheKey = `GET:${path}`; // VULNERABLE: headers not in cache key

  if (cache[cacheKey] && cacheControl !== 'no-cache') {
    // Cache HIT
    const entry = cache[cacheKey];
    entry.hits++;
    responseBox.classList.remove('hidden');
    responseBar.innerHTML = `<span>GET ${escHtml(path)}</span><span class="status-ok">200 OK</span>`;
    responseBody.textContent = entry.response;
    cacheStatus.classList.remove('hidden');
    cacheStatus.className = `cache-status ${entry.poisoned ? 'poisoned' : 'hit'}`;
    cacheStatus.textContent = `${entry.poisoned ? '⚠ CACHE HIT — POISONED RESPONSE' : 'X-Cache: HIT'} (served to ${entry.hits} victim${entry.hits > 1 ? 's' : ''})`;
    if (entry.poisoned) showExplanation(xfh || host, true);
    return;
  }

  // Cache MISS — generate response
  const effectiveHost = xfh || host; // VULNERABLE: X-Forwarded-Host used for generating URLs
  const isPoisoned = xfh && xfh !== host && !xfh.includes('securecorp.com');
  const response = buildResponse(path, effectiveHost, scheme, isPoisoned);

  cache[cacheKey] = { response, poisoned: isPoisoned, hits: 1, injectedHost: effectiveHost };

  responseBox.classList.remove('hidden');
  responseBar.innerHTML = `<span>GET ${escHtml(path)}</span><span class="status-ok">200 OK</span>`;
  responseBody.textContent = response;
  cacheStatus.classList.remove('hidden');
  cacheStatus.className = `cache-status ${isPoisoned ? 'poisoned' : 'miss'}`;
  cacheStatus.textContent = isPoisoned
    ? `⚠ X-Cache: MISS — RESPONSE CACHED (POISONED) — All future visitors will receive this malicious response`
    : `X-Cache: MISS — Response cached for path "${path}"`;

  if (isPoisoned) showExplanation(xfh, false);
}

function buildResponse(path, host, scheme, poisoned) {
  const cdnUrl = `${scheme}://${host}/cdn/app.js`;
  const apiBase = `${scheme}://${host}/api`;
  const lines = [
    `HTTP/1.1 200 OK`,
    `Content-Type: text/html`,
    `Cache-Control: public, max-age=3600`,
    `X-Cache: MISS`,
    ``,
    `<!DOCTYPE html><html>`,
    `<head>`,
    `  <title>SecureCorp — Home</title>`,
    `  <script src="${cdnUrl}"></script>`,
    `</head>`,
    `<body>`,
    `  <h1>Welcome to SecureCorp</h1>`,
    `  <script>var API_BASE = "${apiBase}";</script>`,
    poisoned ? `  <!-- X-Forwarded-Host reflected: ${host} -->` : '',
    `</body></html>`
  ];
  return lines.filter(Boolean).join('\n');
}

function showExplanation(injectedHost, wasHit) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Web Cache Poisoning via Unkeyed Header</h3>
    <p>${wasHit
      ? `A victim requested <code>${pathInput.value}</code> and received the <strong>cached poisoned response</strong> — their browser will load <code>app.js</code> from <code>${escHtml(injectedHost)}</code>.`
      : `The response was cached with <code>X-Forwarded-Host: ${escHtml(injectedHost)}</code> reflected into a <code>&lt;script src&gt;</code> tag. Every future request to this path receives this poisoned page.`}</p>
    <ul>
      <li><strong>Root cause:</strong> <code>X-Forwarded-Host</code> is reflected in the response but excluded from the cache key. One request poisons the cache for all users.</li>
      <li><strong>Impact:</strong> Attacker serves malicious JS to all visitors. Can steal credentials, cookies, perform actions as the victim.</li>
      <li><strong>Fix:</strong> Include all headers that affect the response in the cache key (<code>Vary: X-Forwarded-Host</code>), or validate/sanitize the header value before using it in responses. Never reflect unvalidated host headers into script tags or links.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
