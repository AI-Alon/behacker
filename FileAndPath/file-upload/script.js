// VULNERABLE BY DESIGN — Educational purposes only
// Simulates file upload bypass: the server only checks file extension and Content-Type header,
// both of which an attacker controls — allowing a web shell to be uploaded.

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ALLOWED_MIMES      = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Magic bytes for common image formats
const IMAGE_MAGIC = {
  "image/jpeg": "\xFF\xD8\xFF",
  "image/png":  "\x89PNG",
  "image/gif":  "GIF8",
  "image/webp": "RIFF",
};

function getExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1].toLowerCase() : "";
}

function isPhpContent(content) {
  return /<\?php/i.test(content) || /<\?=/i.test(content);
}

function checkServer(filename, mime, content) {
  const ext    = getExtension(filename);
  const lines  = [];
  let   blocked = false;

  // Check 1: extension (naive — only checks last extension)
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    lines.push({ cls: "pass", text: `[PASS] Extension check: "${ext}" is allowed` });
  } else {
    lines.push({ cls: "fail", text: `[FAIL] Extension check: "${ext}" is not an allowed image extension` });
    blocked = true;
  }

  // Check 2: MIME type from Content-Type header (attacker controls this)
  if (ALLOWED_MIMES.includes(mime)) {
    lines.push({ cls: "pass", text: `[PASS] MIME type check: "${mime}" is allowed` });
  } else {
    lines.push({ cls: "fail", text: `[FAIL] MIME type check: "${mime}" is not an allowed image MIME` });
    blocked = true;
  }

  // No magic byte check, no content scan — server trusts extension + header only
  lines.push({ cls: "warn", text: `[SKIP] Magic byte check: not implemented` });
  lines.push({ cls: "warn", text: `[SKIP] Content scan: not implemented` });

  return { blocked, lines };
}

document.querySelectorAll(".hint").forEach(h => {
  h.addEventListener("click", () => {
    const name = h.dataset.name;
    const mime = h.dataset.mime;
    if (name) document.getElementById("filenameInput").value = name;
    if (mime) document.getElementById("mimeInput").value     = mime;
  });
});

document.getElementById("uploadForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const filename    = document.getElementById("filenameInput").value.trim();
  const mime        = document.getElementById("mimeInput").value.trim();
  const content     = document.getElementById("contentInput").value;
  const logEl       = document.getElementById("validationLog");
  const explanation = document.getElementById("explanationBox");

  const { blocked, lines } = checkServer(filename, mime, content);
  const hasShell = isPhpContent(content);
  const ext      = getExtension(filename);

  logEl.innerHTML = lines.map(l => `<span class="${l.cls}">${escapeHtml(l.text)}</span>`).join("\n");

  explanation.classList.remove("hidden");

  if (!blocked && hasShell) {
    logEl.innerHTML += `\n<span class="shell">⚠ SHELL UPLOADED — file saved to /uploads/${escapeHtml(filename)}</span>`;
    logEl.innerHTML += `\n<span class="shell">⚠ Accessible at: https://securecorp.com/uploads/${escapeHtml(filename)}?cmd=whoami</span>`;

    let why = "";
    if (filename.includes(".php.")) {
      why = `Double extension bypass: the server only checked the <em>last</em> extension (<code>${ext}</code>) — the <code>.php</code> earlier in the name still executes.`;
    } else if (/\.php$/i.test(filename) && !/\.php$/.test(filename)) {
      why = `Case bypass: <code>${ext}</code> passed the lowercase extension check, but Apache/PHP still executes it.`;
    } else if (filename.includes("%00")) {
      why = "Null byte bypass: the <code>%00</code> truncates the filename at the null byte — the server stores it as <code>.php</code>.";
    } else if (ext === ".php5" || ext === ".phtml" || ext === ".phar") {
      why = `Alternative extension bypass: <code>${ext}</code> is not in the blocked list but is still executed as PHP by the web server.`;
    } else {
      why = "The extension and MIME type both passed — the server accepted the PHP shell.";
    }

    explanation.innerHTML = `
      <h3>Upload succeeded — web shell on the server!</h3>
      <p>${why}</p>
      <ul>
        <li>The attacker can now execute OS commands by visiting <code>/uploads/${escapeHtml(filename)}?cmd=id</code>.</li>
        <li>From there: read <code>/etc/passwd</code>, dump the database, install a reverse shell, pivot internally.</li>
        <li>The fix: never rely on extension or Content-Type alone. Validate magic bytes, re-encode images server-side (strip metadata), store uploads outside the web root, serve them through a non-executing handler.</li>
      </ul>`;
  } else if (!blocked) {
    logEl.innerHTML += `\n<span class="pass">File uploaded to /uploads/${escapeHtml(filename)}</span>`;
    explanation.innerHTML = `
      <h3>Upload accepted — but no shell content detected.</h3>
      <p>The file passed validation. Try adding PHP content like <code>&lt;?php system($_GET['cmd']); ?&gt;</code> with a bypass filename from the hint list.</p>`;
  } else {
    explanation.innerHTML = `
      <h3>Upload blocked by current checks.</h3>
      <p>The server rejected this file. Try a bypass technique:</p>
      <ul>
        <li><code>shell.php.jpg</code> + <code>image/jpeg</code> — double extension, last ext is .jpg</li>
        <li><code>shell.php5</code> + <code>image/jpeg</code> — alternative PHP extension</li>
        <li><code>shell.pHp</code> + <code>image/jpeg</code> — uppercase bypass if check is case-sensitive</li>
      </ul>`;
  }
});

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
