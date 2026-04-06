// Simulated cache store
let cachedEntry = null; // { url, content, poisoned }
let poisoned = false;

const urlInput     = document.getElementById('urlInput');
const poisonBtn    = document.getElementById('poisonBtn');
const victimBtn    = document.getElementById('victimBtn');
const sourceBox    = document.getElementById('sourceBox');
const sourceContent= document.getElementById('sourceContent');
const cacheStatus  = document.getElementById('cacheStatus');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { urlInput.value = h.dataset.url; });
});

poisonBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  const injection = extractInjection(url);
  const content = buildPage(injection);
  cachedEntry = { url, content, poisoned: !!injection };
  poisoned = !!injection;

  sourceBox.classList.remove('hidden');
  highlightContent(content, injection);

  cacheStatus.classList.remove('hidden');
  cacheStatus.className = `cache-status ${poisoned ? 'poisoned' : 'miss'}`;
  cacheStatus.textContent = poisoned
    ? `⚠ Cache MISS → RESPONSE STORED (POISONED). Victims requesting /homepage will get this page.`
    : `Cache MISS → Response stored. Normal page cached.`;

  if (poisoned) showExplanation('poison', injection);
});

victimBtn.addEventListener('click', () => {
  if (!cachedEntry) {
    cacheStatus.classList.remove('hidden');
    cacheStatus.className = 'cache-status miss';
    cacheStatus.textContent = `Cache MISS — no cached entry. Send a request first.`;
    return;
  }
  // Victim gets whatever is in cache
  sourceBox.classList.remove('hidden');
  highlightContent(cachedEntry.content, extractInjection(cachedEntry.url));
  cacheStatus.classList.remove('hidden');
  cacheStatus.className = `cache-status ${cachedEntry.poisoned ? 'poisoned' : 'hit'}`;
  cacheStatus.textContent = cachedEntry.poisoned
    ? `⚠ Cache HIT — VICTIM SERVED POISONED PAGE (cached from attacker's request)`
    : `Cache HIT — Victim served clean cached page.`;

  if (cachedEntry.poisoned) showExplanation('victim', extractInjection(cachedEntry.url));
});

function extractInjection(url) {
  const match = url.match(/[?&](?:lang|utm_content)=([^&]+)/);
  if (!match) return null;
  const val = decodeURIComponent(match[1]);
  // Check if it breaks out of JS string context or injects a script
  if (val.includes('<') || val.includes('</') || val.includes("'") || val.includes('-alert')) return val;
  return null;
}

function buildPage(injection) {
  const langVal = injection || 'en';
  return `HTTP/1.1 200 OK\nContent-Type: text/html\nCache-Control: public, max-age=7200\nX-Cache: MISS\n\n<!DOCTYPE html>\n<html lang="${langVal}">\n<head><title>SecureCorp</title></head>\n<body>\n  <h1>Welcome</h1>\n  <script>\n    var LANG = '${langVal}';\n    var PAGE = 'homepage';\n  </script>\n</body>\n</html>`;
}

function highlightContent(content, injection) {
  let html = escHtml(content);
  if (injection) {
    html = html.replace(escHtml(injection), `<span class="injected">${escHtml(injection)}</span>`);
  }
  sourceContent.innerHTML = html;
}

function showExplanation(type, injection) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Stored Web Cache Poisoning</h3>
    <p>${type === 'victim'
      ? `The victim visited <code>/homepage</code> (no parameters) but received the poisoned response cached from the attacker's earlier request. The injection <code>${escHtml(injection)}</code> is present in their page.`
      : `The injected value <code>${escHtml(injection)}</code> was reflected into the page (inside a JS variable or HTML attribute) and stored in the cache. All future visitors receive this poisoned response.`}</p>
    <ul>
      <li><strong>Key property:</strong> The victim never visits the exploit URL. The attacker's single request poisons the shared cache entry for the entire user population.</li>
      <li><strong>Common reflection points:</strong> JS variables, canonical URL tags, Open Graph meta tags, script <code>src</code> attributes.</li>
      <li><strong>Fix:</strong> Validate and sanitize all reflected parameters. Use a strict <code>Content-Security-Policy</code>. Ensure parameters that affect the response are included in the cache key (<code>Vary</code> header) or strip them entirely before caching.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
