const SCENARIOS = {
  it: {
    subject: 'URGENT: Your account will be locked in 24 hours',
    sender: 'IT Security Team <security@securecorp-it.com>',
    body: (name, sender) => `<p>Dear ${name},</p>
<p>Our security systems have detected <strong>suspicious login activity</strong> on your account. To prevent unauthorized access, you must verify your identity within <strong>24 hours</strong> or your account will be suspended.</p>
<p>Please provide the following to complete verification:</p>
<ul><li>Current password</li><li>Your 6-digit MFA code</li><li>Employee ID</li></ul>
<p>Reply directly to this email or click <span style="color:#1d4ed8;text-decoration:underline;cursor:pointer">Verify My Account</span> to proceed.</p>
<p>— ${sender}</p>
<p style="font-size:11px;color:#999">This is an automated security alert from IT. Do not ignore this message.</p>`,
    fields: [{ label: 'Current Password', type: 'password', name: 'password' }, { label: 'MFA Code', type: 'text', name: 'mfa' }, { label: 'Employee ID', type: 'text', name: 'empid' }],
    redFlags: ['Urgent deadline pressure','Sender domain: securecorp-it.com (not securecorp.com)','IT never asks for passwords via email','Vague "suspicious activity" claim'],
  },
  ceo: {
    subject: 'Confidential — Wire Transfer Request',
    sender: 'David Chen (CEO) <david.chen@securecorp-group.com>',
    body: (name, sender) => `<p>Hi ${name},</p>
<p>I need you to process an <strong>urgent wire transfer of $48,500</strong> to close a confidential acquisition deal. This must be done today before 5pm. Do not discuss with anyone — NDA applies.</p>
<p>Wire to: Account 8847291033, Routing 021000021, Beneficiary: SC Holdings LLC</p>
<p>Send confirmation once done. Thanks.</p>
<p>— ${sender}</p>`,
    fields: [{ label: 'Confirm transfer amount ($)', type: 'text', name: 'amount' }, { label: 'Your authorization code', type: 'text', name: 'authcode' }],
    redFlags: ['CEO doesn\'t normally initiate wire transfers directly','Secrecy request ("don\'t discuss with anyone")','Sender domain: securecorp-group.com not securecorp.com','Extreme urgency'],
  },
  vendor: {
    subject: 'Updated Banking Details — Invoice #INV-2024-0892',
    sender: 'Accounts Team <accounts@securecorp-vendor.net>',
    body: (name, sender) => `<p>Dear ${name},</p>
<p>Please be advised that our banking details have changed. All outstanding and future invoices should be paid to our <strong>new account</strong>:</p>
<p><strong>Bank:</strong> Chase<br><strong>Account:</strong> 7712345678<br><strong>Routing:</strong> 021000021</p>
<p>Please confirm receipt of this update and apply the new details to invoice INV-2024-0892 ($23,400) due this Friday.</p>
<p>— ${sender}</p>`,
    fields: [{ label: 'Confirm you have updated payment details', type: 'text', name: 'confirm' }, { label: 'Your name & title', type: 'text', name: 'name' }],
    redFlags: ['Vendor bank changes should always be confirmed by phone','Different sender domain from usual vendor','Coincides with a real invoice (social engineering detail)'],
  },
  security: {
    subject: 'Action Required: Security Audit — Account Verification',
    sender: 'Security Compliance <compliance@securecorp-audit.org>',
    body: (name, sender) => `<p>Dear ${name},</p>
<p>As part of our annual <strong>ISO 27001 compliance audit</strong>, we require all employees to verify their system access credentials by EOD today.</p>
<p>Please reply with: current username, password, and answers to your security questions. This information will be deleted after verification.</p>
<p>Non-compliance may result in temporary account suspension during the audit period.</p>
<p>— ${sender}</p>`,
    fields: [{ label: 'Username', type: 'text', name: 'username' }, { label: 'Password', type: 'password', name: 'password' }, { label: 'Security question answer', type: 'text', name: 'secq' }],
    redFlags: ['Legitimate audits never require password disclosure','Domain: securecorp-audit.org not securecorp.com','ISO audits don\'t collect credentials via email','Threat of suspension = pressure tactic'],
  },
};

let capturedInfo = [];

const btnAttacker  = document.getElementById('btnAttacker');
const btnVictim    = document.getElementById('btnVictim');
const attackerView = document.getElementById('attackerView');
const victimView   = document.getElementById('victimView');
const scenarioSelect = document.getElementById('scenarioSelect');
const targetName   = document.getElementById('targetName');
const senderName   = document.getElementById('senderName');
const generateBtn  = document.getElementById('generateBtn');
const pretextFrame = document.getElementById('pretextFrame');
const capturedInfoEl = document.getElementById('capturedInfo');
const explanationBox = document.getElementById('explanationBox');

btnAttacker.addEventListener('click', () => {
  btnAttacker.classList.add('active'); btnVictim.classList.remove('active');
  attackerView.classList.remove('hidden'); victimView.classList.add('hidden');
});
btnVictim.addEventListener('click', () => {
  btnVictim.classList.add('active'); btnAttacker.classList.remove('active');
  victimView.classList.remove('hidden'); attackerView.classList.add('hidden');
  if (!pretextFrame.innerHTML) buildPretext();
});

generateBtn.addEventListener('click', () => { buildPretext(); btnVictim.click(); });

function buildPretext() {
  const key = scenarioSelect.value;
  const sc  = SCENARIOS[key];
  const name = targetName.value.trim() || 'Alice';
  const sender = senderName.value.trim() || 'IT Security Team';

  const redFlagHtml = sc.redFlags.map(f => `<li>${f}</li>`).join('');
  const fieldsHtml  = sc.fields.map(f =>
    `<div style="margin-bottom:12px">
      <label style="display:block;font-size:12px;color:#555;margin-bottom:4px">${f.label}</label>
      <input type="${f.type}" name="${f.name}" style="width:100%;padding:9px 12px;border:1px solid #ccc;border-radius:4px;font-size:13px;box-sizing:border-box">
    </div>`
  ).join('');

  pretextFrame.innerHTML = `
    <div style="background:#f3f4f6;padding:8px 14px;border-bottom:1px solid #ddd;font-size:12px;color:#666;font-family:monospace">
      From: ${escHtml(sc.sender)} &nbsp;|&nbsp; Subject: ${escHtml(sc.subject)}
    </div>
    <div style="padding:20px 24px;font-family:Arial,sans-serif;font-size:13px;color:#111;max-width:500px">
      ${sc.body(name, sender)}
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <strong style="font-size:12px">Response Form:</strong>
      <form onsubmit="return window._pretextSubmit(event,'${key}')" style="margin-top:10px">
        ${fieldsHtml}
        <button type="submit" style="background:#1d4ed8;color:white;border:none;border-radius:4px;padding:10px 20px;font-size:13px;cursor:pointer">Submit</button>
      </form>
    </div>
    <div style="background:#fefce8;border-top:1px solid #fde68a;padding:12px 16px">
      <strong style="font-size:11px;color:#92400e">⚠ Red flags in this message:</strong>
      <ul style="font-size:11px;color:#78350f;margin:6px 0 0 16px;line-height:1.7">${redFlagHtml}</ul>
    </div>`;

  window._pretextSubmit = function(e, scKey) {
    e.preventDefault();
    const form = e.target;
    const inputs = form.querySelectorAll('input');
    const info = {};
    inputs.forEach(inp => { info[inp.name] = inp.value; });
    info.scenario = scKey;
    info.timestamp = new Date().toLocaleTimeString();
    capturedInfo.push(info);

    const item = document.createElement('div');
    item.className = 'harvested-item';
    item.innerHTML = `<div class="h-field">Captured @ ${info.timestamp} — ${SCENARIOS[scKey].subject}</div>` +
      Object.entries(info).filter(([k]) => !['scenario','timestamp'].includes(k))
        .map(([k, v]) => `<div>${k}: <strong>${escHtml(v)}</strong></div>`).join('');
    capturedInfoEl.appendChild(item);
    showExplanation(scKey);

    const el = document.createElement('div');
    el.style.cssText = 'padding:20px;text-align:center;font-size:14px;color:#666;background:#fff';
    el.textContent = 'Thank you. Your information has been received. (Information captured by attacker)';
    pretextFrame.innerHTML = '';
    pretextFrame.appendChild(el);
    return false;
  };
}

function showExplanation(key) {
  explanationBox.classList.remove('hidden');
  const sc = SCENARIOS[key];
  explanationBox.innerHTML = `
    <h3>Pretexting Attack</h3>
    <p>The victim submitted sensitive information in response to a fabricated scenario (<em>"${sc.subject}"</em>). The pretext created urgency, authority, and fear to override rational judgment.</p>
    <ul>
      <li><strong>Psychological levers used:</strong> Authority (IT/CEO), Urgency (24hr deadline), Fear (account suspension), Scarcity (confidential, NDA).</li>
      <li><strong>Red flags present:</strong> ${sc.redFlags.join(', ')}.</li>
      <li><strong>Defense:</strong> Verify requests through a separate, known-good channel (call the person directly). No legitimate IT/security/compliance team ever requests passwords via email. Train employees on social engineering patterns.</li>
      <li><strong>Process controls:</strong> Wire transfers and account changes should require multi-person approval and out-of-band confirmation — business email compromise (BEC) relies on single points of approval.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
