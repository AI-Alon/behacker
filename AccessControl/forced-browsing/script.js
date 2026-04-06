// VULNERABLE BY DESIGN — Educational purposes only
// Simulates forced browsing: paths not linked in the navigation are still accessible
// because the server has no access control on them.

const SITE_MAP = {
  "/index.html":         { status: 200, type: "public",    content: "<h3>Welcome to Secure Corp</h3><p>Your trusted security partner.</p>" },
  "/about.html":         { status: 200, type: "public",    content: "<h3>About Us</h3><p>Founded 2010. 200+ employees worldwide.</p>" },
  "/contact.html":       { status: 200, type: "public",    content: "<h3>Contact</h3><p>Email: contact@securecorp.com</p>" },
  "/admin/panel.html":   { status: 200, type: "sensitive", content: "<h3>Admin Panel</h3><p>User management, server config, audit logs.</p><p><b>Logged in as: (none — no auth check!)</b></p>" },
  "/admin/users.html":   { status: 200, type: "sensitive", content: "<h3>User List</h3><pre>alice | bob | carol | admin</pre>" },
  "/backup/db.sql":      { status: 200, type: "sensitive", content: "-- MySQL dump\nCREATE TABLE users (id INT, username VARCHAR(50), password_hash VARCHAR(255));\nINSERT INTO users VALUES (1,'admin','$2b$10$hashedpassword...');\nINSERT INTO users VALUES (101,'alice','$2b$10$hashedpassword2...');" },
  "/.env":               { status: 200, type: "critical",  content: "DB_HOST=localhost\nDB_USER=root\nDB_PASS=hunter2secret\nJWT_SECRET=supersecret99\nAPI_KEY=sk-prod-a1b2c3d4\nSMTP_PASS=mailpass2024" },
  "/config.json":        { status: 200, type: "critical",  content: '{\n  "db_host": "localhost",\n  "db_pass": "hunter2secret",\n  "debug": true,\n  "admin_email": "admin@securecorp.com"\n}' },
  "/uploads/":           { status: 200, type: "sensitive", content: "Directory listing:\n  shell.php\n  webshell.jpg\n  backup_2024.zip\n  users_export.csv" },
  "/api/debug":          { status: 200, type: "sensitive", content: '{\n  "env": "production",\n  "version": "2.4.1",\n  "db_connected": true,\n  "uptime": "14 days",\n  "memory_usage": "312MB"\n}' },
  "/old/index.html":     { status: 200, type: "sensitive", content: "<h3>Old Site (v1)</h3><p>This version has known XSS and SQLi vulnerabilities. Decommissioned but still running.</p>" },
};

function requestPath(path) {
  const reqDisplay  = document.getElementById("requestDisplay") || (() => { const el = document.createElement("code"); el.id = "requestDisplay"; return el; })();
  const responseBox = document.getElementById("responseBox");
  const explanation = document.getElementById("explanationBox");

  // Normalise path
  if (!path.startsWith("/")) path = "/" + path;

  // Show request (no request display on this page — reuse response)
  const entry = SITE_MAP[path];
  responseBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  if (!entry) {
    responseBox.innerHTML = `<span class="err">404 Not Found\nGET ${path} HTTP/1.1\n\nNo resource at this path.</span>`;
    explanation.innerHTML = `<h3>404 — path not found.</h3><p>Try the hint paths above, or guess common filenames like <code>/.git/config</code>, <code>/phpinfo.php</code>, <code>/server-status</code>.</p>`;
    return;
  }

  const colorClass = entry.type === "public" ? "ok" : "err";
  responseBox.innerHTML =
    `<span class="${colorClass}">HTTP/1.1 ${entry.status} OK  [${entry.type.toUpperCase()}]\nGET ${path} HTTP/1.1\n</span>\n` +
    `<span class="content">\n${entry.content}</span>`;

  if (entry.type !== "public") {
    explanation.innerHTML = `
      <h3>Sensitive path exposed — no access control.</h3>
      <p><code>${path}</code> is not linked anywhere in the site navigation, but the server serves it to anyone who requests it directly.</p>
      <ul>
        <li>Hiding a URL is not access control — it only stops casual browsing.</li>
        <li>Attackers use tools like <em>Gobuster</em>, <em>ffuf</em>, or <em>Dirb</em> with wordlists to enumerate hidden paths automatically.</li>
        <li>Exposed <code>.env</code> and <code>config.json</code> files are one of the most common causes of credential leaks.</li>
        <li>The fix: require authentication before serving any non-public resource, move secrets out of the web root, and return 401/403 — not 200 — for unauthorised requests.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `<h3>Public page — accessible by design.</h3><p>Try the hint paths to find sensitive content that shouldn't be exposed.</p>`;
  }
}

document.getElementById("goBtn").addEventListener("click", function () {
  requestPath(document.getElementById("pathInput").value.trim());
});

document.getElementById("pathInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") requestPath(this.value.trim());
});

// Nav buttons
document.querySelectorAll(".nav-link").forEach(btn => {
  btn.addEventListener("click", function () {
    const path = this.dataset.path;
    document.getElementById("pathInput").value = path;
    requestPath(path);
  });
});

// Hint chips
document.querySelectorAll(".hint").forEach(hint => {
  hint.addEventListener("click", function () {
    const path = this.textContent.trim();
    document.getElementById("pathInput").value = path;
    requestPath(path);
  });
});
