// VULNERABLE BY DESIGN — Educational purposes only
// Simulates directory listing: the web server returns a file index for any directory
// that lacks an index.html, exposing internal structure and sensitive files.

const FS = {
  "/uploads/": {
    type: "dir",
    entries: [
      { name: "../",               type: "dir",  size: "-",        modified: "-" },
      { name: "avatar_alice.jpg",  type: "file", size: "42 KB",    modified: "2024-11-14 09:12", sensitive: false },
      { name: "avatar_bob.png",    type: "file", size: "38 KB",    modified: "2024-11-13 14:05", sensitive: false },
      { name: "shell.php",         type: "file", size: "1 KB",     modified: "2024-11-15 03:47", sensitive: true  },
      { name: "users_export.csv",  type: "file", size: "12 KB",    modified: "2024-10-30 11:20", sensitive: true  },
      { name: "webshell.jpg",      type: "file", size: "2 KB",     modified: "2024-11-15 03:48", sensitive: true  },
    ]
  },
  "/backup/": {
    type: "dir",
    entries: [
      { name: "../",               type: "dir",  size: "-",        modified: "-" },
      { name: "db_2024-10.sql",    type: "file", size: "4.2 MB",   modified: "2024-10-31 00:01", sensitive: true  },
      { name: "db_2024-11.sql",    type: "file", size: "4.4 MB",   modified: "2024-11-30 00:01", sensitive: true  },
      { name: "config_backup.zip", type: "file", size: "88 KB",    modified: "2024-11-01 08:00", sensitive: true  },
    ]
  },
  "/logs/": {
    type: "dir",
    entries: [
      { name: "../",               type: "dir",  size: "-",        modified: "-" },
      { name: "access.log",        type: "file", size: "1.1 MB",   modified: "2024-11-15 06:00", sensitive: false },
      { name: "error.log",         type: "file", size: "240 KB",   modified: "2024-11-15 05:58", sensitive: false },
      { name: "auth.log",          type: "file", size: "88 KB",    modified: "2024-11-15 06:00", sensitive: true  },
    ]
  },
  "/assets/": {
    type: "dir",
    entries: [
      { name: "../",               type: "dir",  size: "-",        modified: "-" },
      { name: "logo.svg",          type: "file", size: "6 KB",     modified: "2024-09-01 10:00", sensitive: false },
      { name: "main.css",          type: "file", size: "22 KB",    modified: "2024-10-15 14:30", sensitive: false },
      { name: "app.js",            type: "file", size: "94 KB",    modified: "2024-11-10 16:45", sensitive: false },
    ]
  },
  "/tmp/": {
    type: "dir",
    entries: [
      { name: "../",               type: "dir",  size: "-",        modified: "-" },
      { name: "sess_a3f9c2e1",     type: "file", size: "1 KB",     modified: "2024-11-15 07:01", sensitive: true  },
      { name: "sess_b847d056",     type: "file", size: "1 KB",     modified: "2024-11-15 07:03", sensitive: true  },
      { name: "import_job_99.tmp", type: "file", size: "320 KB",   modified: "2024-11-14 22:10", sensitive: false },
    ]
  },
  "/.git/": {
    type: "dir",
    entries: [
      { name: "../",               type: "dir",  size: "-",        modified: "-" },
      { name: "config",            type: "file", size: "256 B",    modified: "2024-09-01 10:00", sensitive: true  },
      { name: "HEAD",              type: "file", size: "23 B",     modified: "2024-11-15 06:00", sensitive: false },
      { name: "COMMIT_EDITMSG",    type: "file", size: "48 B",     modified: "2024-11-15 06:00", sensitive: false },
      { name: "objects/",          type: "dir",  size: "-",        modified: "2024-11-15 06:00", sensitive: true  },
    ]
  },
};

const FILE_CONTENTS = {
  "shell.php":         "<?php system($_GET['cmd']); ?>",
  "users_export.csv":  "id,username,email,password_hash\n1,admin,admin@securecorp.com,$2b$10$abc123...\n101,alice,alice@securecorp.com,$2b$10$def456...\n102,bob,bob@securecorp.com,$2b$10$ghi789...",
  "config":            "[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n[remote \"origin\"]\n\turl = https://github.com/securecorp/internal-app\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[user]\n\temail = dev@securecorp.com",
  "auth.log":          "Nov 15 06:00:01 securecorp sshd[2201]: Accepted publickey for alice\nNov 15 05:47:33 securecorp sudo: alice : TTY=pts/0 ; USER=root ; COMMAND=/bin/bash\nNov 15 03:47:11 securecorp sshd[2198]: Failed password for root from 185.220.101.5 port 48291",
  "access.log":        '185.220.101.5 - - [15/Nov/2024:03:47:09] "GET /uploads/shell.php?cmd=id HTTP/1.1" 200 28\n10.0.0.5 - alice - [15/Nov/2024:09:12:01] "GET /dashboard HTTP/1.1" 200 4821\n10.0.0.5 - alice - [15/Nov/2024:09:12:55] "POST /api/transfer HTTP/1.1" 200 142',
};

function browse(path) {
  const listingBox  = document.getElementById("listingBox");
  const fileContent = document.getElementById("fileContent");
  const explanation = document.getElementById("explanationBox");

  fileContent.classList.add("hidden");

  const dir = FS[path];
  listingBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  if (!dir) {
    listingBox.innerHTML = `<div class="listing-404">404 Not Found — ${escapeHtml(path)}</div>`;
    explanation.innerHTML = `<h3>Directory not found.</h3><p>Try the hint paths: <code>/uploads/</code>, <code>/backup/</code>, <code>/.git/</code>, etc.</p>`;
    return;
  }

  const hasSensitive = dir.entries.some(e => e.sensitive);
  const rows = dir.entries.map(entry => {
    const cls  = entry.type === "dir" ? "dir-link" : (entry.sensitive ? "file-link sensitive" : "file-link");
    const click = entry.type === "dir"
      ? `onclick="browseDir('${path}${entry.name}')"`
      : `onclick="openFile('${entry.name}', '${path}')"`;
    return `<tr>
      <td><span class="${cls}" ${click}>${escapeHtml(entry.name)}</span></td>
      <td>${entry.modified}</td>
      <td>${entry.size}</td>
    </tr>`;
  }).join("");

  listingBox.innerHTML = `
    <div class="listing-header">Index of ${escapeHtml(path)}</div>
    <table class="listing-table">
      <thead><tr><th>Name</th><th>Last modified</th><th>Size</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  if (hasSensitive) {
    explanation.innerHTML = `
      <h3>Directory listing exposed — sensitive files visible.</h3>
      <p>The server returned a full file index for <code>${escapeHtml(path)}</code> because there is no <code>index.html</code> and <code>autoindex</code> is enabled.</p>
      <ul>
        <li>An attacker can enumerate all files without prior knowledge of their names.</li>
        <li>Click any highlighted file to view its contents.</li>
        <li>The fix: <code>autoindex off;</code> (Nginx) or <code>Options -Indexes</code> (Apache), and place an empty <code>index.html</code> in sensitive directories.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `<h3>Directory listing — no sensitive files here.</h3><p>Try <code>/uploads/</code>, <code>/backup/</code>, <code>/.git/</code>, or <code>/logs/</code>.</p>`;
  }
}

function openFile(name, dir) {
  const fileContent    = document.getElementById("fileContent");
  const fileContentPre = document.getElementById("fileContentPre");
  const content = FILE_CONTENTS[name];
  if (content) {
    fileContent.classList.remove("hidden");
    fileContentPre.textContent = content;
    fileContent.querySelector(".code-label").textContent = dir + name;
  }
}

window.browseDir = browse;
window.openFile  = openFile;

document.getElementById("browseBtn").addEventListener("click", () => {
  browse(document.getElementById("pathInput").value.trim());
});

document.getElementById("pathInput").addEventListener("keydown", e => {
  if (e.key === "Enter") browse(e.target.value.trim());
});

document.querySelectorAll(".hint").forEach(h => {
  h.addEventListener("click", () => {
    const p = h.textContent.trim();
    document.getElementById("pathInput").value = p;
    browse(p);
  });
});

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
