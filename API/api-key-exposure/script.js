// Simulated JS bundle contents with hardcoded API keys
const BUNDLES = {
  'main.bundle.js': `!function(e,t){"use strict";
var CONFIG={
  apiBase:"https://api.securecorp.com/v2",
  stripeKey:"pk_FAKE_51HzKJbwBmOx9VqDFzW3RH7Kp2xKJbwBmO",
  stripeSecret:"sk_FAKE_4xKJbwBmOx9VqDFzW3RH1234abcdefgh",
  sentryDsn:"https://abc123def456@o99999.ingest.sentry.io/1234567",
  googleMapsKey:"AIzaSyD-9tSrke72I3xi-1b4WqXm9L8vN8kPqRs",
};
function initPayment(amount){
  fetch(CONFIG.apiBase+"/charge",{
    method:"POST",
    headers:{"Authorization":"Bearer "+CONFIG.stripeSecret},
    body:JSON.stringify({amount:amount})
  });
}
function loadMap(el){
  const script=document.createElement("script");
  script.src="https://maps.googleapis.com/maps/api/js?key="+CONFIG.googleMapsKey;
  document.head.appendChild(script);
}`,
  'vendor.bundle.js': `/* vendor bundle - third party libs */
!function(){"use strict";
// Twilio credentials baked in during build
var TWILIO={
  accountSid:"ACFAKE1234567890abcdef1234567890",
  authToken:"1234567890abcdef1234567890abcdef",
  fromNumber:"+15551234567"
};
function sendSMS(to,msg){
  fetch("https://api.twilio.com/2010-04-01/Accounts/"+TWILIO.accountSid+"/Messages.json",{
    method:"POST",
    headers:{"Authorization":"Basic "+btoa(TWILIO.accountSid+":"+TWILIO.authToken)},
    body:new URLSearchParams({To:to,From:TWILIO.fromNumber,Body:msg})
  });
}
// AWS config leaked via build step
var AWS_ACCESS_KEY="AKIAIOSFODNN7EXAMPLE";
var AWS_SECRET="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
}();`,
  'config.chunk.js': `// !! DO NOT COMMIT - injected by CI !!
window.__ENV__={
  NODE_ENV:"production",
  API_KEY:"sc_prod_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
  ADMIN_TOKEN:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcwMDAwMH0.XXXXXXXX",
  INTERNAL_API:"https://internal-api.securecorp.local:8443",
  DB_CONN_STRING:"postgresql://appuser:Sup3rS3cr3t@db.internal:5432/payments",
  FEATURE_FLAGS:{newDashboard:true,adminPanel:true},
};`
};

// Auto-detected secrets (pattern-matched)
const SECRETS = [
  { file: 'main.bundle.js',  type: 'Stripe Secret Key',  value: 'sk_FAKE_4xKJbwBmOx9VqDFzW3RH1234abcdefgh', pattern: /sk_FAKE_[A-Za-z0-9]+/ },
  { file: 'main.bundle.js',  type: 'Google Maps API Key', value: 'AIzaSyD-9tSrke72I3xi-1b4WqXm9L8vN8kPqRs', pattern: /AIzaSy[A-Za-z0-9_-]+/ },
  { file: 'main.bundle.js',  type: 'Sentry DSN',          value: 'https://abc123def456@o99999.ingest.sentry.io/1234567', pattern: /ingest\.sentry\.io/ },
  { file: 'vendor.bundle.js',type: 'Twilio Auth Token',   value: '1234567890abcdef1234567890abcdef', pattern: /authToken/ },
  { file: 'vendor.bundle.js',type: 'AWS Access Key',      value: 'AKIAIOSFODNN7EXAMPLE', pattern: /AKIA[0-9A-Z]{16}/ },
  { file: 'vendor.bundle.js',type: 'AWS Secret Key',      value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', pattern: /AWS_SECRET/ },
  { file: 'config.chunk.js', type: 'API Key',             value: 'sc_prod_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c', pattern: /API_KEY/ },
  { file: 'config.chunk.js', type: 'JWT Admin Token',     value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', pattern: /ADMIN_TOKEN/ },
  { file: 'config.chunk.js', type: 'DB Connection String', value: 'postgresql://appuser:Sup3rS3cr3t@db.internal:5432/payments', pattern: /DB_CONN_STRING/ },
];

// Simulated network requests that appear after page load
const NETWORK_REQUESTS = [
  { method: 'GET',  url: 'https://api.securecorp.com/v2/user',       status: 200, key: 'Authorization: Bearer sk_FAKE_4xKJbwBmOx9...' },
  { method: 'POST', url: 'https://api.twilio.com/2010-04-01/...',     status: 201, key: 'Basic AC1234567890...:1234567890ab...' },
  { method: 'GET',  url: 'https://maps.googleapis.com/maps/api/js',   status: 200, key: 'key=AIzaSyD-9tSrke72I3xi-1b4WqXm9L8vN8kPqRs' },
];

let activeFile = 'main.bundle.js';

// --- Tab switching ---
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-content');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// Sources panel
const sourceFiles = document.querySelectorAll('.tree-item');
const sourceViewer = document.getElementById('sourceViewer');
sourceFiles.forEach(f => {
  f.addEventListener('click', () => {
    sourceFiles.forEach(sf => sf.classList.remove('active'));
    f.classList.add('active');
    activeFile = f.dataset.file;
    renderSourceFile(activeFile);
  });
});

function renderSourceFile(name) {
  let code = BUNDLES[name] || '';
  // Highlight secrets
  SECRETS.filter(s => s.file === name).forEach(s => {
    code = code.replace(s.value, `<span class="key-highlight">${escHtml(s.value)}</span>`);
  });
  sourceViewer.innerHTML = `<pre>${code}</pre>`;
}
renderSourceFile('main.bundle.js');

// Load button — populates network list and shows secrets
document.getElementById('loadBtn').addEventListener('click', () => {
  // Populate network list
  const networkList = document.getElementById('networkList');
  networkList.innerHTML = '';
  NETWORK_REQUESTS.forEach(req => {
    const row = document.createElement('div');
    row.className = 'network-row';
    row.innerHTML = `<span class="net-method">${req.method}</span> <span class="net-url">${escHtml(req.url)}</span> <span class="net-status">${req.status}</span>`;
    row.title = req.key;
    networkList.appendChild(row);
  });

  // Show secrets in explanationBox
  const box = document.getElementById('explanationBox');
  box.classList.remove('hidden');
  let secretsHtml = '<h3>Secrets Found in JS Bundles</h3><div>';
  SECRETS.forEach(s => {
    secretsHtml += `<div class="secret-item">
      <div class="s-label">${escHtml(s.type)}</div>
      <div class="s-value">${escHtml(s.value)}</div>
      <div class="s-location">Found in: ${escHtml(s.file)}</div>
    </div>`;
  });
  secretsHtml += '</div>';
  box.innerHTML = secretsHtml + `
    <h3>API Key &amp; Secret Exposure in JS Bundles</h3>
    <p>Frontend JavaScript bundles are served to every visitor's browser. Any secret embedded in them — API keys, tokens, credentials — is immediately public.</p>
    <ul>
      <li><strong>Root cause:</strong> Build pipelines that inject environment variables directly into the bundle, or developers hardcoding keys for convenience.</li>
      <li><strong>Impact:</strong> Attackers can abuse Stripe keys to make charges, use AWS keys to spin up infra, query internal APIs using leaked tokens.</li>
      <li><strong>Detection:</strong> Tools like <code>trufflehog</code>, <code>gitleaks</code>, and browser DevTools Sources panel expose these trivially.</li>
      <li><strong>Fix:</strong> All secrets belong on the <em>server side</em>. Frontend should only hold public/publishable keys. Use short-lived tokens for client calls and proxy sensitive operations through your backend.</li>
    </ul>`;
});

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
