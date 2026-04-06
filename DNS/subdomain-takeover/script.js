const SUBDOMAINS = [
  { name: 'www.securecorp.com',     type: 'A',     value: '54.210.123.45',                    status: 'active',  service: null },
  { name: 'staging.securecorp.com', type: 'CNAME', value: 'securecorp.github.io',              status: 'dangling', service: 'GitHub Pages', claimed: false },
  { name: 'docs.securecorp.com',    type: 'CNAME', value: 'securecorp.netlify.app',            status: 'dangling', service: 'Netlify', claimed: false },
  { name: 'shop.securecorp.com',    type: 'CNAME', value: 'securecorp-store.myshopify.com',    status: 'active',  service: 'Shopify' },
  { name: 'assets.securecorp.com',  type: 'CNAME', value: 'securecorp-assets.s3.amazonaws.com', status: 'dangling', service: 'AWS S3', claimed: false },
  { name: 'mail.securecorp.com',    type: 'MX',    value: 'mail.google.com',                  status: 'active',  service: null },
  { name: 'dev.securecorp.com',     type: 'CNAME', value: 'securecorp-dev.herokuapp.com',      status: 'dangling', service: 'Heroku', claimed: false },
];

const subdomainInput = document.getElementById('subdomainInput');
const enumBtn        = document.getElementById('enumBtn');
const dnsBtn         = document.getElementById('dnsBtn');
const claimBtn       = document.getElementById('claimBtn');
const subdomainList  = document.getElementById('subdomainList');
const dnsResult      = document.getElementById('dnsResult');
const claimResult    = document.getElementById('claimResult');
const danglingSelect = document.getElementById('danglingSelect');
const explanationBox = document.getElementById('explanationBox');

enumBtn.addEventListener('click', async () => {
  subdomainList.classList.remove('hidden');
  subdomainList.innerHTML = '';
  for (const sd of SUBDOMAINS) {
    await sleep(120);
    const row = document.createElement('div');
    row.className = 'subdomain-row';
    row.innerHTML = `<span class="sd-name">${sd.name}</span>
      <span>${sd.type} → ${sd.value}</span>
      <span class="sd-badge ${sd.status === 'dangling' ? 'vuln' : 'safe'}">${sd.status === 'dangling' ? 'DANGLING' : 'OK'}</span>`;
    row.addEventListener('click', () => { subdomainInput.value = sd.name; });
    subdomainList.appendChild(row);
    if (sd.status === 'dangling') {
      const opt = document.createElement('option');
      opt.value = sd.name;
      opt.textContent = `${sd.name} → ${sd.service}`;
      danglingSelect.appendChild(opt);
    }
  }
});

dnsBtn.addEventListener('click', () => {
  const sub = subdomainInput.value.trim();
  const sd  = SUBDOMAINS.find(s => s.name === sub);
  dnsResult.classList.remove('hidden');
  if (!sd) {
    dnsResult.innerHTML = `<span class="dns-warn">NXDOMAIN — subdomain not found in this simulation</span>`;
    return;
  }
  let html = `<span class="dns-key">Name:</span>  <span class="dns-val">${sd.name}</span>\n<span class="dns-key">Type:</span>  <span class="dns-val">${sd.type}</span>\n<span class="dns-key">Value:</span> <span class="dns-val">${sd.value}</span>\n`;
  if (sd.status === 'dangling') {
    html += `<span class="dns-warn">⚠ CNAME target "${sd.value}" is unclaimed on ${sd.service}!</span>`;
  } else {
    html += `<span class="dns-key">Status:</span> <span class="dns-val">Active — resource exists</span>`;
  }
  dnsResult.innerHTML = html;
  if (sd.status === 'dangling') showExplanation(sd, 'dns');
});

claimBtn.addEventListener('click', () => {
  const selected = danglingSelect.value;
  const sd = SUBDOMAINS.find(s => s.name === selected);
  claimResult.classList.remove('hidden');
  if (!sd || sd.status !== 'dangling') {
    claimResult.className = 'result-msg';
    claimResult.textContent = 'Select a dangling subdomain first.';
    return;
  }
  sd.claimed = true;
  claimResult.className = 'result-msg error';
  claimResult.textContent = `Success! Registered "${sd.value}" on ${sd.service}.\n${sd.name} now serves attacker-controlled content.\n\nAll traffic to ${sd.name} (emails, OAuth callbacks, password resets) is now intercepted.`;
  showExplanation(sd, 'claim');
});

function showExplanation(sd, type) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Subdomain Takeover</h3>
    <p>${type === 'claim'
      ? `<strong>${sd.name}</strong> has been taken over. It had a CNAME pointing to <code>${sd.value}</code> on ${sd.service}, which was deleted — but the DNS record was never removed.`
      : `<strong>${sd.name}</strong> points to <code>${sd.value}</code> (${sd.service}) which is unclaimed. Any attacker can register this resource.`}</p>
    <ul>
      <li><strong>Impact:</strong> Attacker serves phishing pages under a trusted domain, intercepts OAuth redirect tokens, receives password reset emails, bypasses CSP/CORS policies.</li>
      <li><strong>Affected platforms:</strong> GitHub Pages, Netlify, Heroku, AWS S3, Azure, Fastly, Zendesk — any service where the resource name is user-registerable.</li>
      <li><strong>Detection:</strong> Tools: <code>subjack</code>, <code>nuclei</code>, <code>dnsX</code>. Scan for dangling CNAMEs with fingerprints of abandoned service responses.</li>
      <li><strong>Fix:</strong> When deprovisioning any cloud resource, remove the DNS record <em>first</em>, then deprovision the resource. Audit DNS records regularly against active resources.</li>
    </ul>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
