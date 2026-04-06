// Simulated SSRF filter: naive blocklist of "127.0.0.1", "localhost", "169.254.169.254"
const BLOCKLIST_STRINGS = ['127.0.0.1', 'localhost', '169.254.169.254', '::1'];

// These URLs resolve to loopback but bypass the naive string check
const BYPASS_RESPONSES = {
  'http://2130706433/admin':          { resolves: '127.0.0.1', body: `<h1>Admin Panel</h1><p>Accessed via decimal IP bypass (2130706433 = 0x7F000001 = 127.0.0.1)</p>` },
  'http://0x7f000001/admin':          { resolves: '127.0.0.1', body: `<h1>Admin Panel</h1><p>Accessed via hex IP bypass (0x7f000001 = 127.0.0.1)</p>` },
  'http://0177.0.0.1/admin':          { resolves: '127.0.0.1', body: `<h1>Admin Panel</h1><p>Accessed via octal IP bypass (0177.0.0.1 = 127.0.0.1)</p>` },
  'http://[::1]/admin':               { resolves: '::1 (IPv6 loopback)', body: `<h1>Admin Panel</h1><p>Accessed via IPv6 loopback bypass</p>` },
  'http://localtest.me/admin':        { resolves: '127.0.0.1 (DNS)', body: `<h1>Admin Panel</h1><p>localtest.me always resolves to 127.0.0.1 — DNS-based bypass</p>` },
  'http://127.0.0.1.nip.io/admin':    { resolves: '127.0.0.1 (nip.io)', body: `<h1>Admin Panel</h1><p>nip.io encodes the IP in the domain — resolves to 127.0.0.1</p>` },
  'http://169.254.169.254.xip.io/':   { resolves: '169.254.169.254 (xip.io)', body: `ami-id\niam/security-credentials\ninstance-id\n(metadata endpoint via xip.io DNS bypass)` },
};

const BLOCKED_RESPONSES = {
  'http://127.0.0.1/admin':     { blocked: true, reason: 'Blocked: "127.0.0.1" in blocklist' },
  'http://localhost/admin':      { blocked: true, reason: 'Blocked: "localhost" in blocklist' },
  'http://169.254.169.254/':     { blocked: true, reason: 'Blocked: "169.254.169.254" in blocklist' },
};

const urlInput     = document.getElementById('urlInput');
const fetchBtn     = document.getElementById('fetchBtn');
const filterResult = document.getElementById('filterResult');
const responseBox  = document.getElementById('responseBox');
const responseBar  = document.getElementById('responseBar');
const responseBody = document.getElementById('responseBody');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { urlInput.value = h.dataset.url; });
});

fetchBtn.addEventListener('click', submit);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

function submit() {
  const url = urlInput.value.trim();
  if (!url) return;

  filterResult.classList.remove('hidden');
  responseBox.classList.add('hidden');
  explanationBox.classList.add('hidden');

  // Naive string-based filter
  const isBlocked = BLOCKLIST_STRINGS.some(b => url.includes(b));

  if (isBlocked || BLOCKED_RESPONSES[url]) {
    filterResult.className = 'filter-result blocked';
    filterResult.textContent = BLOCKED_RESPONSES[url]?.reason || `Blocked: URL matches blocklist pattern`;
  } else if (BYPASS_RESPONSES[url]) {
    filterResult.className = 'filter-result bypassed';
    filterResult.textContent = `✓ Filter passed! Resolves to: ${BYPASS_RESPONSES[url].resolves}`;
    responseBox.classList.remove('hidden');
    responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-ok">200 OK (via bypass)</span>`;
    responseBody.textContent = BYPASS_RESPONSES[url].body;
    showExplanation(url);
  } else {
    filterResult.className = 'filter-result bypassed';
    filterResult.textContent = `Filter passed (URL not in blocklist). No simulated response for this URL.`;
  }
}

function showExplanation(url) {
  explanationBox.classList.remove('hidden');
  const bypass = BYPASS_RESPONSES[url];
  let technique = '';
  if (url.includes('2130706433') || url.includes('0x7f') || url.includes('0177')) {
    technique = '<li><strong>Numeric encoding:</strong> IP addresses can be represented as decimal (2130706433), hex (0x7f000001), or octal (0177.0.0.1) — all equivalent to 127.0.0.1 but not matched by string filters.</li>';
  } else if (url.includes('[::1]')) {
    technique = '<li><strong>IPv6:</strong> <code>::1</code> is the IPv6 loopback — equivalent to 127.0.0.1 but not matched by "127.0.0.1" string check.</li>';
  } else if (url.includes('nip.io') || url.includes('xip.io') || url.includes('localtest.me')) {
    technique = '<li><strong>DNS-based bypass:</strong> These domains always resolve to the IP encoded in the name. A string-based filter that doesn\'t resolve DNS before checking will allow them through.</li>';
  }
  explanationBox.innerHTML = `
    <h3>SSRF Filter Bypass</h3>
    <p>The naive blocklist checked for <code>127.0.0.1</code>, <code>localhost</code>, and <code>169.254.169.254</code> as substrings — but the submitted URL bypassed all of them while still reaching the same internal resource.</p>
    <ul>
      ${technique}
      <li><strong>Why blocklists fail:</strong> There are too many representations of any given IP. Blocklists are inherently incomplete.</li>
      <li><strong>Correct fix:</strong> Resolve the hostname to its final IP address <em>before</em> checking, and validate against blocked IP ranges using CIDR matching. Block all RFC 1918 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16). Use an allowlist of approved external domains instead of a blocklist.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
