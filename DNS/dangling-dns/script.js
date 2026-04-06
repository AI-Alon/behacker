const DNS_RECORDS = [
  { name: 'securecorp.com',           type: 'A',     value: '54.210.123.45',                       active: true  },
  { name: 'www.securecorp.com',        type: 'CNAME', value: 'securecorp.com',                      active: true  },
  { name: 'staging.securecorp.com',    type: 'CNAME', value: 'securecorp-staging.netlify.app',      active: false, service: 'Netlify' },
  { name: 'blog.securecorp.com',       type: 'CNAME', value: 'securecorp.ghost.io',                 active: false, service: 'Ghost' },
  { name: 'assets.securecorp.com',     type: 'CNAME', value: 'securecorp-assets.s3.amazonaws.com',  active: false, service: 'AWS S3' },
  { name: 'docs.securecorp.com',       type: 'CNAME', value: 'securecorp.readthedocs.io',           active: true  },
  { name: 'old-shop.securecorp.com',   type: 'CNAME', value: 'securecorp-v1.myshopify.com',         active: false, service: 'Shopify' },
  { name: 'mail.securecorp.com',       type: 'MX',    value: 'aspmx.l.google.com',                 active: true  },
  { name: 'support.securecorp.com',    type: 'CNAME', value: 'securecorp.zendesk.com',              active: true  },
];

const domainInput    = document.getElementById('domainInput');
const scanBtn        = document.getElementById('scanBtn');
const verifyBtn      = document.getElementById('verifyBtn');
const exploitBtn     = document.getElementById('exploitBtn');
const danglingSelect = document.getElementById('danglingSelect');
const dnsTable       = document.getElementById('dnsTable');
const verifyResults  = document.getElementById('verifyResults');
const exploitResult  = document.getElementById('exploitResult');
const explanationBox = document.getElementById('explanationBox');

let scanned = false;

scanBtn.addEventListener('click', async () => {
  scanned = true;
  dnsTable.classList.remove('hidden');
  danglingSelect.innerHTML = '<option value="">— select dangling record —</option>';

  let html = `<table><thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead><tbody>`;
  for (const rec of DNS_RECORDS) {
    await sleep(80);
    const cls = rec.active ? 'rec-value' : 'rec-dangling';
    html += `<tr><td class="rec-type">${rec.name}</td><td style="color:#79c0ff">${rec.type}</td><td class="${cls}">${rec.value}${!rec.active ? ' ⚠' : ''}</td></tr>`;
    if (!rec.active && rec.service) {
      const opt = document.createElement('option');
      opt.value = rec.name;
      opt.textContent = `${rec.name} (${rec.service})`;
      danglingSelect.appendChild(opt);
    }
  }
  html += `</tbody></table>`;
  dnsTable.innerHTML = html;
});

verifyBtn.addEventListener('click', async () => {
  if (!scanned) { alert('Run DNS scan first.'); return; }
  verifyResults.classList.remove('hidden');
  verifyResults.innerHTML = '';
  const dangling = DNS_RECORDS.filter(r => !r.active && r.service);
  for (const rec of dangling) {
    await sleep(200);
    const item = document.createElement('div');
    item.className = 'verify-item dangling';
    item.innerHTML = `<span>${rec.name} → ${rec.value}</span><span>${rec.service}: <strong>UNCLAIMED</strong></span>`;
    verifyResults.appendChild(item);
  }
  const active = DNS_RECORDS.filter(r => r.active);
  for (const rec of active.slice(0,3)) {
    await sleep(100);
    const item = document.createElement('div');
    item.className = 'verify-item ok';
    item.innerHTML = `<span>${rec.name} → ${rec.value}</span><span>Active ✓</span>`;
    verifyResults.appendChild(item);
  }
  showExplanation('verify');
});

exploitBtn.addEventListener('click', () => {
  const target = danglingSelect.value;
  const rec = DNS_RECORDS.find(r => r.name === target);
  exploitResult.classList.remove('hidden');
  if (!rec) {
    exploitResult.className = 'result-msg';
    exploitResult.textContent = 'Select a dangling record first.';
    return;
  }
  exploitResult.className = 'result-msg error';
  exploitResult.textContent = `Registered "${rec.value}" on ${rec.service}.\n${rec.name} now points to attacker-controlled content.\n\nAll traffic to ${rec.name} — OAuth tokens, session cookies, API calls — is now intercepted.`;
  showExplanation('exploit', rec);
});

function showExplanation(type, rec) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Dangling DNS Record Takeover</h3>
    <p>${type === 'exploit' && rec
      ? `<code>${rec.name}</code> had a stale CNAME to <code>${rec.value}</code> (${rec.service}). That resource was deleted but the DNS record remained. Registering the resource on ${rec.service} completes the takeover.`
      : `${DNS_RECORDS.filter(r => !r.active && r.service).length} dangling CNAME records were found. Each CNAME target is unclaimed on its respective platform.`}</p>
    <ul>
      <li><strong>Root cause:</strong> Organizations delete cloud resources (S3 buckets, Netlify sites, Heroku dynos) without first removing their DNS records.</li>
      <li><strong>Impact:</strong> Phishing under trusted subdomain, OAuth token interception (redirect_uri), CSP bypass, cookie theft (if cookies are scoped to parent domain).</li>
      <li><strong>Discovery tools:</strong> <code>subjack</code>, <code>nuclei -t takeovers</code>, <code>can-i-take-over-xyz</code> (GitHub repo with platform fingerprints).</li>
      <li><strong>Fix:</strong> Remove DNS records <em>before</em> deprovisioning. Audit all DNS records quarterly. Use infrastructure-as-code (Terraform) to manage DNS and resources together — deleting a resource deletes its record.</li>
    </ul>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
