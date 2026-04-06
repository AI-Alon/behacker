// Simulated JS bundle files with embedded secrets
const FILES = {
  'main.bundle.js': {
    content: `// SecureCorp App v3.1.4 — main bundle
(function() {
  "use strict";

  var AppConfig = {
    apiBase:        "https://api.securecorp.com/v2",
    // Stripe keys — DO NOT COMMIT (but someone did)
    stripePublic:   "pk_FAKE_51HzKJbwBmOx9VqDFz",
    stripeSecret:   "sk_FAKE_4xKJbwBmOx9VqDFzW3RH1234",
    sentryDsn:      "https://abc123@o99999.ingest.sentry.io/1234567",
    googleMapsKey:  "AIzaSyD-9tSrke72I3xi-1b4WqXm9L8vN8kPqRs",
    featureFlags:   { newUI: true, adminPanel: true },
  };

  function initAuth() {
    var token = localStorage.getItem("token") ||
                "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.HARDCODED";
    return token;
  }

  function chargeCard(amount) {
    return fetch(AppConfig.apiBase + "/charge", {
      headers: { Authorization: "Bearer " + AppConfig.stripeSecret },
      body: JSON.stringify({ amount: amount })
    });
  }

  window.App = { config: AppConfig, initAuth: initAuth };
})();`,
    secrets: [
      { type: 'Stripe Secret Key',   value: 'sk_FAKE_4xKJbwBmOx9VqDFzW3RH1234', line: 8 },
      { type: 'Google Maps API Key', value: 'AIzaSyD-9tSrke72I3xi-1b4WqXm9L8vN8kPqRs', line: 9 },
      { type: 'Hardcoded JWT Token', value: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.HARDCODED', line: 14 },
    ]
  },
  'vendor.chunk.js': {
    content: `// Third-party vendor bundle
!function() {
  // Twilio SMS integration
  var TwilioClient = {
    accountSid: "ACFAKE1234567890abcdef1234567890",
    authToken:  "1234567890abcdef1234567890abcdef",
    from:       "+15551234567"
  };

  // AWS SDK config (should be server-side only!)
  window.AWS = {
    accessKeyId:     "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region:          "us-east-1"
  };

  function sendSMS(to, body) {
    var creds = btoa(TwilioClient.accountSid + ":" + TwilioClient.authToken);
    return fetch("https://api.twilio.com/...", {
      headers: { Authorization: "Basic " + creds }
    });
  }
}();`,
    secrets: [
      { type: 'Twilio Auth Token',  value: '1234567890abcdef1234567890abcdef', line: 6 },
      { type: 'AWS Access Key ID',  value: 'AKIAIOSFODNN7EXAMPLE', line: 11 },
      { type: 'AWS Secret Key',     value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', line: 12 },
    ]
  },
  'env.config.js': {
    content: `// Runtime config injected by build pipeline
// WARNING: CI injected these — remove before deploy (it wasn't removed)
window.__ENV__ = {
  NODE_ENV:        "production",
  API_KEY:         "sc_prod_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
  ADMIN_TOKEN:     "tok_admin_9182736450abc",
  INTERNAL_HOST:   "https://internal.securecorp.local:8443",
  DB_CONN:         "postgresql://app:Sup3rS3cr3t@db.internal:5432/payments",
  REDIS_URL:       "redis://:r3d1s_p4ss@redis.internal:6379/0",
  ENCRYPTION_KEY:  "a1b2c3d4e5f6789012345678901234ab",
};`,
    secrets: [
      { type: 'API Key',            value: 'sc_prod_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c', line: 5 },
      { type: 'Admin Token',        value: 'tok_admin_9182736450abc', line: 6 },
      { type: 'DB Connection String', value: 'postgresql://app:Sup3rS3cr3t@db.internal:5432/payments', line: 8 },
      { type: 'Encryption Key',     value: 'a1b2c3d4e5f6789012345678901234ab', line: 10 },
    ]
  }
};

const tabs = document.querySelectorAll('.tab');
const viewer = document.getElementById('bundleViewer');
const scanBtn = document.getElementById('scanBtn');
const secretsList = document.getElementById('secretsList');
const explanationBox = document.getElementById('explanationBox');

let activeFile = 'main.bundle.js';

function renderFile(name) {
  const f = FILES[name];
  if (!f) return;
  let code = escHtml(f.content);
  f.secrets.forEach(s => {
    code = code.replace(escHtml(s.value), `<span class="token-secret">${escHtml(s.value)}</span>`);
  });
  // Basic syntax highlighting
  code = code.replace(/(\/\/[^\n]*)/g, '<span class="token-comment">$1</span>');
  code = code.replace(/"([^"<>]*)"/g, (m, v) => {
    if (m.includes('token-secret')) return m;
    return `<span class="token-str">"${v}"</span>`;
  });
  viewer.innerHTML = code;
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFile = tab.dataset.file;
    renderFile(activeFile);
  });
});

scanBtn.addEventListener('click', () => {
  secretsList.classList.remove('hidden');
  secretsList.innerHTML = '';
  let total = 0;
  Object.entries(FILES).forEach(([fname, f]) => {
    f.secrets.forEach(s => {
      total++;
      const el = document.createElement('div');
      el.className = 'secret-item';
      el.innerHTML = `<div class="s-type">${escHtml(s.type)}</div>
        <div class="s-value">${escHtml(s.value)}</div>
        <div class="s-file">${escHtml(fname)} — line ${s.line}</div>`;
      secretsList.appendChild(el);
    });
  });
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Hardcoded Secrets in Source Code</h3>
    <p>The scanner found <strong>${total} secrets</strong> across ${Object.keys(FILES).length} bundle files. Every visitor's browser can read these — they are public by definition once served as static assets.</p>
    <ul>
      <li><strong>Common offenders:</strong> API keys, tokens, database connection strings, encryption keys, third-party service credentials.</li>
      <li><strong>Detection tools:</strong> <code>trufflehog</code>, <code>gitleaks</code>, <code>semgrep</code>, <code>git-secrets</code> — all scan for known secret patterns.</li>
      <li><strong>Fix:</strong> Secrets belong on the server only. Frontend bundles must contain <em>zero</em> secrets. Use short-lived, scoped tokens for client-side calls. Rotate any exposed credentials immediately.</li>
      <li><strong>Git history:</strong> Even after removal, secrets remain in git history. Use <code>git filter-repo</code> and rotate all affected credentials.</li>
    </ul>`;
});

renderFile('main.bundle.js');

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
