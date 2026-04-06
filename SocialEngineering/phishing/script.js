const BRANDS = {
  github: {
    name: 'GitHub',
    color: '#24292e',
    logo: 'GH',
    fields: [{ label: 'Username or email address', type: 'text', name: 'username' }, { label: 'Password', type: 'password', name: 'password' }],
    btn: 'Sign in',
    indicators: ['GitHub.com uses HTTPS with a valid EV certificate', 'Real URL: github.com — not gîthub.com', 'Browser shows padlock + correct domain'],
  },
  google: {
    name: 'Google',
    color: '#fff',
    logo: 'G',
    fields: [{ label: 'Email or phone', type: 'text', name: 'email' }, { label: 'Password', type: 'password', name: 'password' }],
    btn: 'Next',
    indicators: ['Real URL: accounts.google.com', 'Google uses FIDO2/passkeys — phishing-resistant', 'Check domain carefully before entering credentials'],
  },
  microsoft: {
    name: 'Microsoft',
    color: '#fff',
    logo: 'M',
    fields: [{ label: 'Email, phone, or Skype', type: 'text', name: 'email' }, { label: 'Password', type: 'password', name: 'password' }],
    btn: 'Sign in',
    indicators: ['Real URL: login.microsoftonline.com', 'Microsoft supports FIDO2 keys', 'Check for homograph attacks in domain name'],
  },
  bank: {
    name: 'SecureBank',
    color: '#003087',
    logo: 'SB',
    fields: [{ label: 'Account Number', type: 'text', name: 'account' }, { label: 'Password', type: 'password', name: 'password' }, { label: 'One-Time Code', type: 'text', name: 'otp' }],
    btn: 'Log In',
    indicators: ['Banks never ask for OTP via email link', 'Verify URL is your bank\'s exact domain', 'Call bank directly if suspicious'],
  },
};

let harvestedCreds = [];

const btnAttacker = document.getElementById('btnAttacker');
const btnVictim   = document.getElementById('btnVictim');
const attackerView= document.getElementById('attackerView');
const victimView  = document.getElementById('victimView');
const brandSelect = document.getElementById('brandSelect');
const phishDomain = document.getElementById('phishDomain');
const redirectUrl = document.getElementById('redirectUrl');
const buildBtn    = document.getElementById('buildBtn');
const phishFrame  = document.getElementById('phishFrame');
const harvestedCredsEl = document.getElementById('harvestedCreds');
const explanationBox = document.getElementById('explanationBox');

btnAttacker.addEventListener('click', () => {
  btnAttacker.classList.add('active'); btnVictim.classList.remove('active');
  attackerView.classList.remove('hidden'); victimView.classList.add('hidden');
});
btnVictim.addEventListener('click', () => {
  btnVictim.classList.add('active'); btnAttacker.classList.remove('active');
  victimView.classList.remove('hidden'); attackerView.classList.add('hidden');
  if (!phishFrame.innerHTML) buildPhish();
});

buildBtn.addEventListener('click', () => {
  buildPhish();
  btnVictim.click();
});

function buildPhish() {
  const brand = BRANDS[brandSelect.value];
  if (!brand) return;
  const domain = phishDomain.value.trim();

  const fieldsHtml = brand.fields.map(f =>
    `<div style="margin-bottom:14px">
      <label style="display:block;font-size:13px;color:#666;margin-bottom:4px">${f.label}</label>
      <input type="${f.type}" name="${f.name}" style="width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;box-sizing:border-box" placeholder="${f.label}">
    </div>`
  ).join('');

  const indicatorsHtml = brand.indicators.map(i =>
    `<div style="display:flex;gap:6px;margin-bottom:4px;font-size:12px;color:#555"><span>🔒</span><span>${i}</span></div>`
  ).join('');

  phishFrame.innerHTML = `
    <div style="background:#f6f8fa;padding:8px 14px;border-bottom:1px solid #ddd;font-size:12px;color:#666;font-family:monospace">
      🔒 ${escHtml(domain)} <span style="color:#b91c1c;font-size:11px">(This is a phishing domain!)</span>
    </div>
    <div style="padding:32px 24px;font-family:Arial,sans-serif;max-width:350px;margin:0 auto">
      <div style="width:48px;height:48px;border-radius:50%;background:${brand.color === '#fff' ? '#4285f4' : brand.color};color:white;font-size:1.4rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:16px">${brand.logo}</div>
      <h2 style="font-size:1.3rem;margin:0 0 8px;color:#111">Sign in to ${brand.name}</h2>
      <form onsubmit="return window._phishSubmit(event, '${brandSelect.value}')">
        ${fieldsHtml}
        <button type="submit" style="width:100%;background:#238636;color:white;border:none;border-radius:4px;padding:12px;font-size:15px;cursor:pointer;margin-top:4px">${brand.btn}</button>
      </form>
    </div>
    <div style="background:#fffbeb;border-top:1px solid #fde68a;padding:10px 14px;font-size:11px">
      <strong>Security indicators to check:</strong><br><br>
      ${indicatorsHtml}
    </div>`;

  window._phishSubmit = function(e, brandKey) {
    e.preventDefault();
    const form = e.target;
    const inputs = form.querySelectorAll('input');
    const cred = {};
    inputs.forEach(inp => { cred[inp.name] = inp.value; });
    cred.brand = brandKey;
    cred.timestamp = new Date().toLocaleTimeString();
    harvestedCreds.push(cred);

    // Render in attacker view
    const item = document.createElement('div');
    item.className = 'harvested-item';
    item.innerHTML = `<div class="h-field">Captured @ ${cred.timestamp} — ${BRANDS[brandKey].name}</div>` +
      Object.entries(cred).filter(([k]) => !['brand','timestamp'].includes(k))
        .map(([k, v]) => `<div>${k}: <strong>${escHtml(v)}</strong></div>`).join('');
    harvestedCredsEl.appendChild(item);

    showExplanation(brandKey);

    // Simulate redirect to real site
    const el = document.createElement('div');
    el.style.cssText = 'padding:20px;text-align:center;font-size:14px;color:#666';
    el.textContent = `Redirecting to ${redirectUrl.value || 'the real site'}… (credentials captured)`;
    phishFrame.innerHTML = '';
    phishFrame.appendChild(el);
    setTimeout(() => buildPhish(), 2000);
    return false;
  };
}

function showExplanation(brandKey) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Phishing Page (Credential Harvesting)</h3>
    <p>The victim entered credentials on a convincing clone of ${BRANDS[brandKey].name}. They were immediately captured and sent to the attacker. The victim was redirected to the real site, often unaware anything happened.</p>
    <ul>
      <li><strong>Homograph attack:</strong> Domains like <code>gîthub.com</code> (Unicode î) look identical to <code>github.com</code> in many fonts.</li>
      <li><strong>Detection:</strong> Always check the full domain in the address bar. Use a password manager — it won't autofill on a different domain.</li>
      <li><strong>Phishing-resistant MFA:</strong> FIDO2/WebAuthn hardware keys are bound to the origin — they <em>cannot</em> be used on a phishing domain, even if credentials are stolen.</li>
      <li><strong>Defense:</strong> Train users. Deploy FIDO2 MFA. Use email filtering. Report phishing domains for takedown.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
