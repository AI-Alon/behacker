// VULNERABLE BY DESIGN — Educational purposes only
// Simulates DOM-based XSS: payload is read from location.hash and written to the DOM
// without ever touching the server — the vulnerability lives entirely in client-side JS.

function renderFromHash() {
  const codeDisplay = document.getElementById("codeDisplay");
  const sinkDisplay = document.getElementById("sinkDisplay");
  const outputBox   = document.getElementById("outputBox");
  const explanation = document.getElementById("explanationBox");

  const hash = window.location.hash.slice(1); // strip leading #
  if (!hash) return;

  // Parse name= param from hash
  const params = new URLSearchParams(hash);
  const name   = params.get("name") || "";

  codeDisplay.textContent = `window.location.hash  →  "${hash}"\nname extracted         →  "${name}"`;
  sinkDisplay.textContent = `document.getElementById("outputBox").innerHTML = \`<p>Welcome, <strong>${name}</strong>!</p>\``;

  outputBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  // ── Vulnerable: hash value written directly to innerHTML ─────────────────
  // VULNERABLE: attacker-controlled URL fragment inserted into the DOM
  outputBox.innerHTML = `<p>Welcome, <strong>${name}</strong>!</p>`;

  const isInjected = /<|>|script|onerror|onload|svg|img|iframe/i.test(name);

  if (isInjected) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>Your payload was read from <code>location.hash</code> and written to the DOM via <code>innerHTML</code> — entirely client-side.</p>
      <ul>
        <li>The server <strong>never sees</strong> the hash fragment — it's processed only by your browser's JavaScript.</li>
        <li>Traditional server-side output encoding doesn't help here; the vulnerability is in the client JS.</li>
        <li>An attacker sends a victim a link like <code>index.html#name=&lt;img src=x onerror=alert(1)&gt;</code>.</li>
        <li>The script executes in the victim's browser with access to their cookies, session tokens, and DOM.</li>
        <li>The fix: never pass URL-derived values to <code>innerHTML</code>. Use <code>textContent</code>, or sanitise with DOMPurify.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Normal input — no injection detected.</h3>
      <p>Try these payloads by typing them into the field above and clicking "Set Hash & Render":</p>
      <ul>
        <li><code>name=&lt;img src=x onerror="alert('DOM XSS')"&gt;</code></li>
        <li><code>name=&lt;svg onload="alert(document.cookie)"&gt;</code></li>
        <li><code>name=&lt;script&gt;alert(1)&lt;/script&gt;</code> — (may be blocked by browser CSP)</li>
        <li><code>name=Alice&lt;/strong&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;strong&gt;</code> — breaks out of tag</li>
        <li>Notice: the payload never appears in a network request — no server logs can detect it.</li>
      </ul>`;
  }
}

// Button simulates changing the URL hash and re-rendering
document.getElementById("goBtn").addEventListener("click", function () {
  const hashInput = document.getElementById("hashInput").value.trim();
  if (hashInput) {
    window.location.hash = hashInput;
  }
  renderFromHash();
});

// Also render on load in case the page is opened with a hash already set
window.addEventListener("hashchange", renderFromHash);
renderFromHash();
