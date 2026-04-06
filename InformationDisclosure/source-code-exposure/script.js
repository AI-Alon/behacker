// Simulated server filesystem — paths that may be exposed
const EXPOSED_FILES = {
  '/.git/config': `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = https://github.com/securecorp/payment-api.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n\tmerge = refs/heads/main`,
  '/.git/HEAD': `ref: refs/heads/main`,
  '/.env': `APP_ENV=production\nDB_HOST=db.internal.securecorp.com\nDB_USER=appuser\nDB_PASS=Sup3rS3cr3t!2024\nDB_NAME=payments\nSTRIPE_SECRET_KEY=sk_FAKE_4xKJbwBmOx9VqDFzW3RH1234\nJWT_SECRET=hs256-prod-k3y-n3v3r-sh4r3\nREDIS_URL=redis://:r3d1s_p4ss@redis.internal:6379`,
  '/.env.backup': `# old env — DO NOT DEPLOY\nDB_PASS=OldPassword123\nADMIN_TOKEN=tok_admin_b4ckup_9182736`,
  '/config.php.bak': `<?php\n// Database config backup\ndefine('DB_HOST', 'db.internal');\ndefine('DB_USER', 'root');\ndefine('DB_PASS', 'r00t_p4ssw0rd');\ndefine('ADMIN_EMAIL', 'admin@securecorp.com');\n?>`,
  '/main.js.map': `{"version":3,"sources":["src/auth.js","src/payments.js","src/admin.js"],"sourcesContent":["// auth.js\\nconst ADMIN_SECRET = 'admin_s3cr3t_2024';\\nfunction verifyAdmin(token) {\\n  return token === ADMIN_SECRET;\\n}","// payments.js\\nconst STRIPE_KEY = 'sk_FAKE_4xKJbwBmOx9VqDFzW3RH1234';","// admin.js\\n// TODO: remove hardcoded creds before release\\nconst DB_PASS = 'Sup3rS3cr3t!2024';"]}`,
  '/web.config.bak': `<?xml version="1.0"?>\n<configuration>\n  <connectionStrings>\n    <add name="DefaultConnection"\n         connectionString="Server=db.internal;Database=payments;User Id=sa;Password=S@_p4ss_2024;"/>\n  </connectionStrings>\n</configuration>`,
  '/swagger.json': `{"openapi":"3.0.0","info":{"title":"SecureCorp Internal API","version":"2.1.0"},"paths":{"/api/admin/users":{"get":{"summary":"List all users (admin only)","security":[{"bearerAuth":[]}]}},"/api/admin/export-db":{"post":{"summary":"Export full DB dump"}}}}`,
  '/phpinfo.php': `PHP Version 7.4.3 (NTS)\nSystem: Linux prod-web-01 5.4.0-generic\nDocument Root: /var/www/html\nServer API: Apache 2.0 Handler\n_SERVER["DB_PASSWORD"] => Sup3rS3cr3t!2024\n_SERVER["STRIPE_KEY"] => sk_FAKE_4xKJbwBmOx9VqDFzW3RH1234`,
};

const pathInput      = document.getElementById('pathInput');
const fetchBtn       = document.getElementById('fetchBtn');
const responseBox    = document.getElementById('responseBox');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => {
    pathInput.value = h.textContent.trim();
  });
});

fetchBtn.addEventListener('click', () => {
  const p = pathInput.value.trim();
  if (!p) return;
  fetchPath(p);
});

pathInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchBtn.click(); });

function fetchPath(p) {
  responseBox.classList.remove('hidden');
  if (EXPOSED_FILES[p]) {
    responseBox.innerHTML =
      `<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#161b22;border-bottom:1px solid #30363d;font-family:monospace;font-size:.85rem;">` +
      `<span>GET ${escHtml(p)}</span><span class="status-200">200 OK</span></div>` +
      `<pre style="margin:0;padding:10px;font-size:.82rem;white-space:pre-wrap;">${escHtml(EXPOSED_FILES[p])}</pre>`;
    showExplanation(p);
  } else {
    responseBox.innerHTML =
      `<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#161b22;border-bottom:1px solid #30363d;font-family:monospace;font-size:.85rem;">` +
      `<span>GET ${escHtml(p)}</span><span class="status-404">404 Not Found</span></div>` +
      `<pre style="margin:0;padding:10px;font-size:.82rem;">This path is not exposed on this server.</pre>`;
  }
}

function showExplanation(trigger) {
  explanationBox.classList.remove('hidden');
  let extra = '';
  if (trigger === '/.env' || trigger === '/.env.backup') {
    extra = '<li><strong>.env files</strong> contain environment variables — database passwords, API keys, secrets — and should never be in the web root.</li>';
  } else if (trigger === '/.git/config' || trigger === '/.git/HEAD') {
    extra = '<li><strong>.git/ exposure</strong> lets attackers reconstruct the entire source tree using <code>git clone</code> against the server.</li>';
  } else if (trigger === '/main.js.map') {
    extra = '<li><strong>Source maps (.map)</strong> ship original pre-minified source code to the browser, including comments and hardcoded secrets.</li>';
  } else if (trigger === 'scan') {
    extra = '<li>Auto-scanning common backup/config paths is standard recon. Tools like <code>dirsearch</code>, <code>ffuf</code>, and <code>gobuster</code> automate this at high speed.</li>';
  }
  explanationBox.innerHTML = `
    <h3>Source Code &amp; Config Exposure</h3>
    <p>Web servers that serve backup files, version control directories, or config files expose credentials, internal architecture, and full source code to anyone who requests them.</p>
    <ul>
      <li><strong>Root cause:</strong> Deploying the web root directly from a VCS checkout, or leaving backup files accessible.</li>
      <li><strong>Impact:</strong> Database credentials, API keys, internal hostnames, admin tokens — all readable without authentication.</li>
      ${extra}
      <li><strong>Fix:</strong> Keep secrets in environment variables injected at runtime, never in files in the web root. Block access to <code>.git/</code>, <code>.env</code>, <code>*.bak</code>, <code>*.map</code> in the web server config.</li>
    </ul>`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
