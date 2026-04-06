// VULNERABLE BY DESIGN — Educational purposes only
// Simulates path traversal: user-supplied filename is concatenated to a base path
// without sanitisation, allowing escape from the intended directory.

const BASE_PATH = "/var/www/securecorp/uploads/";

// Simulated filesystem
const FILESYSTEM = {
  "/var/www/securecorp/uploads/report.pdf":      "Q3 Financial Report\nRevenue: $2.4M\nConfidential — internal use only.",
  "/var/www/securecorp/uploads/avatar.png":      "[binary PNG data]",
  "/var/www/securecorp/uploads/notes.txt":       "Meeting notes 2024-11-01\n- Deploy new auth service\n- Review open tickets",
  "/var/www/securecorp/config.json":             '{\n  "db_host": "localhost",\n  "db_user": "root",\n  "db_pass": "hunter2secret",\n  "debug": true,\n  "admin_email": "admin@securecorp.com"\n}',
  "/var/www/securecorp/.env":                    "DB_HOST=localhost\nDB_USER=root\nDB_PASS=hunter2secret\nJWT_SECRET=supersecret99\nAPI_KEY=sk-prod-a1b2c3d4\nSMTP_PASS=mailpass2024\nAPP_ENV=production",
  "/etc/passwd":                                 "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nalice:x:1001:1001::/home/alice:/bin/bash\nbob:x:1002:1002::/home/bob:/bin/bash",
  "/etc/shadow":                                 "root:$6$rounds=5000$salt$hashedpass:19000:0:99999:7:::\nwww-data:!:19000::::::\nalice:$6$rounds=5000$salt2$hashedpass2:19000:0:99999:7:::",
  "/var/log/auth.log":                           "Nov 14 09:12:01 securecorp sshd[1234]: Accepted password for alice from 10.0.0.5 port 54321\nNov 14 09:15:44 securecorp sudo: alice : TTY=pts/0 ; PWD=/home/alice ; USER=root ; COMMAND=/bin/bash\nNov 14 10:02:11 securecorp sshd[1235]: Failed password for root from 192.168.1.100",
};

// Normalise path: resolve ../ sequences like a real filesystem
function resolvePath(base, filename) {
  // Simple resolution — split on / and handle ..
  const parts = (base + filename).split("/").filter(Boolean);
  const resolved = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return "/" + resolved.join("/");
}

// Bypass variants that should still resolve to traversal
function normaliseInput(input) {
  return input
    .replace(/\.\.\/\.\.\//g, "../../")   // ....// → ../
    .replace(/\.\.\.\.\//g, "../../")
    .replace(/%2F/gi, "/")
    .replace(/%2f/gi, "/")
    .replace(/%00.*/g, "");               // null byte truncation
}

document.querySelectorAll(".hint").forEach(h => {
  h.addEventListener("click", () => {
    document.getElementById("filenameInput").value = h.textContent.trim();
  });
});

document.getElementById("fileForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const raw         = document.getElementById("filenameInput").value;
  const filename    = normaliseInput(raw);
  const resolved    = resolvePath(BASE_PATH, filename);
  const pathDisplay = document.getElementById("pathDisplay");
  const terminal    = document.getElementById("terminal");
  const termOut     = document.getElementById("terminalOutput");
  const explanation = document.getElementById("explanationBox");

  // Show resolved path
  pathDisplay.textContent =
    `Base path:  ${BASE_PATH}\n` +
    `User input: ${raw}\n` +
    `Resolved:   ${resolved}`;

  terminal.style.display = "block";

  const content = FILESYSTEM[resolved];
  const escaped = BASE_PATH.replace(/\/$/, "");
  const traversed = !resolved.startsWith(escaped);

  if (content) {
    termOut.innerHTML = traversed
      ? `<span class="warn">⚠ PATH TRAVERSAL — escaped uploads directory!\n\n</span>${escapeHtml(content)}`
      : escapeHtml(content);
  } else {
    termOut.innerHTML = `<span class="warn">File not found: ${escapeHtml(resolved)}\n\nTry: ../config.json, ../../etc/passwd, ../.env</span>`;
  }

  explanation.classList.remove("hidden");

  if (traversed && content) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>The <code>../</code> sequences navigated above the intended <code>/uploads/</code> base directory and read <code>${escapeHtml(resolved)}</code>.</p>
      <ul>
        <li>The server concatenated the filename directly: <code>BASE_PATH + filename</code> — no validation.</li>
        <li>Each <code>../</code> moves one directory up in the filesystem tree.</li>
        <li>Encoded variants (<code>%2F</code>, <code>....//</code>, null bytes) bypass naive string filters.</li>
        <li>Targets: <code>/etc/passwd</code>, <code>.env</code>, <code>config.json</code>, SSH keys, log files.</li>
        <li>The fix: resolve the path and verify it still starts with the intended base directory before opening the file.</li>
      </ul>`;
  } else if (!traversed) {
    explanation.innerHTML = `
      <h3>Normal file — still inside uploads/.</h3>
      <p>Try the hint paths. Each <code>../</code> moves one level up:</p>
      <ul>
        <li><code>../config.json</code> — one level up from uploads/</li>
        <li><code>../../etc/passwd</code> — two levels up, reaching the root filesystem</li>
        <li><code>../.env</code> — reads the app's secret environment file</li>
      </ul>`;
  } else {
    explanation.innerHTML = `<h3>File not found.</h3><p>The path resolved but that file doesn't exist in this simulated filesystem. Try the hint paths.</p>`;
  }
});

function escapeHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
