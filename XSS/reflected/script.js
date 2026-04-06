// VULNERABLE BY DESIGN — Educational purposes only
// Simulates reflected XSS: user input is echoed back via innerHTML without sanitisation.

document.getElementById("searchForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const query       = document.getElementById("queryInput").value;
  const codeDisplay = document.getElementById("codeDisplay");
  const outputBox   = document.getElementById("outputBox");
  const explanation = document.getElementById("explanationBox");

  // ── Vulnerable: builds HTML string by concatenating raw user input ────────
  const reflected = `<p>You searched for: <strong>${query}</strong></p>
<p style="color:#555;font-size:0.88rem;">0 results found.</p>`;

  codeDisplay.textContent = reflected;

  outputBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  // VULNERABLE: reflected input rendered via innerHTML — scripts execute
  outputBox.innerHTML = reflected;

  // Detect injection
  const isInjected = /<|>|&lt;|script|onerror|onload|svg|img|iframe/i.test(query);

  if (isInjected) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>Your input was reflected back into the page HTML without escaping, causing the browser to execute it as markup.</p>
      <ul>
        <li>The server (or in this case, client JS) took your query and placed it directly inside a <code>&lt;p&gt;</code> tag.</li>
        <li>Because the output went through <code>innerHTML</code>, any HTML you injected was parsed and rendered.</li>
        <li>An attacker crafts a malicious URL containing a payload and tricks a victim into clicking it — the script runs in the victim's browser session.</li>
        <li>Reflected XSS is not stored — it only fires for the user who visits the crafted URL.</li>
        <li>The fix: HTML-encode output (<code>&amp;lt;</code>, <code>&amp;gt;</code>) or use <code>textContent</code> instead of <code>innerHTML</code>.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Normal input — no injection detected.</h3>
      <p>Try these payloads in the Search field:</p>
      <ul>
        <li><code>&lt;script&gt;alert('XSS')&lt;/script&gt;</code> — classic script tag (blocked by most browsers in reflected context)</li>
        <li><code>&lt;img src=x onerror="alert('XSS')"&gt;</code> — broken image triggers JS</li>
        <li><code>&lt;svg onload="alert('XSS')"&gt;</code> — SVG onload event</li>
        <li><code>&lt;iframe src="javascript:alert('XSS')"&gt;</code> — iframe with JS URL</li>
        <li><code>&lt;a href="#" onclick="alert(document.cookie)"&gt;click me&lt;/a&gt;</code> — phishing link that leaks cookies</li>
      </ul>`;
  }
});
