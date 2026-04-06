// Simulated cache: key = GET URL only; server prefers body params over query params
let cache = {};

const urlInput    = document.getElementById('urlInput');
const bodyInput   = document.getElementById('bodyInput');
const sendBtn     = document.getElementById('sendBtn');
const victimBtn   = document.getElementById('victimBtn');
const responseBox = document.getElementById('responseBox');
const responseBar = document.getElementById('responseBar');
const responseBody= document.getElementById('responseBody');
const cacheStatus = document.getElementById('cacheStatus');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => {
    urlInput.value  = h.dataset.url;
    bodyInput.value = h.dataset.body || '';
  });
});

sendBtn.addEventListener('click', () => send(false));
victimBtn.addEventListener('click', () => send(true));

function send(isVictim) {
  const url  = urlInput.value.trim() || '/search?q=shoes';
  const body = isVictim ? '' : (bodyInput.value.trim());
  const cacheKey = url;

  if (isVictim) {
    // Victim sends clean GET — no body
    if (cache[cacheKey]) {
      const entry = cache[cacheKey];
      responseBox.classList.remove('hidden');
      responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-ok">200 OK</span>`;
      responseBody.textContent = entry.content;
      cacheStatus.classList.remove('hidden');
      cacheStatus.className = `cache-status ${entry.poisoned ? 'poisoned' : 'hit'}`;
      cacheStatus.textContent = entry.poisoned
        ? `⚠ Cache HIT — Victim served POISONED response (from attacker's fat GET)`
        : `X-Cache: HIT — clean response`;
      if (entry.poisoned) showExplanation('victim', entry.injectedQ);
    } else {
      // No cache entry
      const content = buildSearchPage(parseQuery(url), false);
      responseBox.classList.remove('hidden');
      responseBar.innerHTML = `<span>GET ${escHtml(url)} (victim — no cache)</span><span class="status-ok">200 OK</span>`;
      responseBody.textContent = content;
      cacheStatus.classList.remove('hidden');
      cacheStatus.className = 'cache-status miss';
      cacheStatus.textContent = `X-Cache: MISS — clean victim response`;
    }
    return;
  }

  // Attacker fat GET: server uses body over query
  const urlParams = parseQuery(url);
  const bodyParams = parseBodyParams(body);
  // Server merges, body takes precedence
  const effectiveParams = Object.assign({}, urlParams, bodyParams);
  const q = effectiveParams.q || '';
  const hasInjection = q.includes('<') || q.includes("'") || effectiveParams.admin;
  const content = buildSearchPage(effectiveParams, hasInjection);

  cache[cacheKey] = { content, poisoned: hasInjection, injectedQ: q };

  responseBox.classList.remove('hidden');
  responseBar.innerHTML = `<span>GET ${escHtml(url)} (fat GET)</span><span class="status-ok">200 OK</span>`;
  responseBody.textContent = content;
  cacheStatus.classList.remove('hidden');
  cacheStatus.className = `cache-status ${hasInjection ? 'poisoned' : 'miss'}`;
  cacheStatus.textContent = hasInjection
    ? `⚠ X-Cache: MISS — RESPONSE CACHED (POISONED from fat GET body param)`
    : `X-Cache: MISS — Response cached (clean)`;

  if (hasInjection) showExplanation('attacker', q);
}

function buildSearchPage(params, hasInjection) {
  const q = params.q || '';
  const admin = params.admin;
  return `HTTP/1.1 200 OK\nContent-Type: text/html\n\n<!DOCTYPE html>\n<html>\n<head><title>Search — SecureCorp</title></head>\n<body>\n  <h1>Search Results for: ${escHtml(q)}</h1>\n  <script>var searchQuery = '${q}';</script>\n  ${admin ? '<p class="admin-mode">ADMIN MODE ENABLED</p>' : ''}\n  ${hasInjection ? '<!-- INJECTED: ' + escHtml(q) + ' -->' : '<p>No results found.</p>'}\n</body>\n</html>`;
}

function parseQuery(url) {
  const parts = url.split('?');
  if (parts.length < 2) return {};
  return Object.fromEntries(parts[1].split('&').map(p => p.split('=').map(decodeURIComponent)));
}

function parseBodyParams(body) {
  if (!body) return {};
  return Object.fromEntries(body.split('&').map(p => p.split('=').map(s => decodeURIComponent(s || ''))));
}

function showExplanation(type, q) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Fat GET Cache Poisoning</h3>
    <p>${type === 'victim'
      ? `The victim sent a clean <code>GET /search?q=shoes</code> with no body, but received the poisoned cached response where <code>q = "${escHtml(q)}"</code> (from the attacker's body parameter).`
      : `The attacker sent a GET request with a body containing <code>q=${escHtml(q)}</code>. The server preferred the body param, returned a response with the injection, and the cache stored it under the URL key <code>${urlInput.value}</code>.`}</p>
    <ul>
      <li><strong>Root cause:</strong> The cache keys on the URL but the server processes body params — a desync between caching layer and application layer.</li>
      <li><strong>Fix:</strong> Ensure the cache key includes all inputs that affect the response. Reject or ignore bodies on GET requests at the CDN/proxy layer. Configure the CDN to never cache requests with a body.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
