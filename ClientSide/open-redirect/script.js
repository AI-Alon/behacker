// VULNERABLE BY DESIGN — Educational purposes only
// Simulates open redirect: after login the server redirects to the ?next= parameter
// without validating whether the destination is on the same domain.

const VALID_USERS = {
  alice: "password123",
  bob:   "letmein99",
};

const TRUSTED_DOMAIN = "securecorp.com";

function isSameDomain(url) {
  try {
    // Allow relative paths
    if (url.startsWith("/") && !url.startsWith("//")) return true;
    const parsed = new URL(url);
    return parsed.hostname === TRUSTED_DOMAIN || parsed.hostname.endsWith("." + TRUSTED_DOMAIN);
  } catch {
    return false;
  }
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username    = document.getElementById("username").value.trim();
  const password    = document.getElementById("password").value;
  const next        = document.getElementById("nextParam").value.trim();
  const codeDisplay = document.getElementById("codeDisplay");
  const resultBox   = document.getElementById("resultBox");
  const explanation = document.getElementById("explanationBox");

  if (!VALID_USERS[username] || VALID_USERS[username] !== password) {
    resultBox.className = "result-box danger";
    resultBox.classList.remove("hidden");
    resultBox.textContent = "Invalid credentials.";
    return;
  }

  // ── Vulnerable server-side logic ─────────────────────────────────────────
  codeDisplay.textContent =
    `// Vulnerable Node/Express:\n` +
    `const next = req.query.next;\n` +
    `// Missing: validate next is on the same domain\n` +
    `res.redirect(next);   // ← blindly redirects to attacker URL`;

  resultBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  const safe = isSameDomain(next);

  if (!safe) {
    resultBox.className = "result-box danger";
    resultBox.textContent =
      `Login successful as ${username}.\n` +
      `302 Redirect → ${next}\n\n` +
      `OPEN REDIRECT — victim is sent to an attacker-controlled domain!`;

    let note = "";
    if (next.startsWith("//")) {
      note = "Protocol-relative URL — browser fills in https: automatically, resolving to the attacker domain.";
    } else if (next.startsWith("javascript:")) {
      note = "javascript: URL — may execute JS in the context of the login page (XSS via redirect).";
    } else if (next.includes(TRUSTED_DOMAIN + ".")) {
      note = `Subdomain bypass — "${next}" looks like ${TRUSTED_DOMAIN} but the real domain is different.`;
    }

    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>After successful login the server redirected to <code>${escapeHtml(next)}</code> — an external domain the attacker controls.</p>
      ${note ? `<p style="margin-top:8px;color:#f8c555;">Note: ${escapeHtml(note)}</p>` : ""}
      <ul>
        <li>The victim trusts the login URL because it starts with <code>https://securecorp.com/login?next=…</code>.</li>
        <li>After entering credentials they are silently sent to the attacker's phishing clone.</li>
        <li>Open redirects also help bypass URL filters in phishing detection and email blockers.</li>
        <li>They can chain into SSRF, OAuth token theft, and password reset poisoning.</li>
        <li>The fix: validate <code>next</code> against an allowlist of safe paths. Only allow relative paths starting with <code>/</code> (no <code>//</code>), or explicitly match the trusted hostname.</li>
      </ul>`;
  } else {
    resultBox.className = "result-box safe";
    resultBox.textContent =
      `Login successful as ${username}.\n` +
      `302 Redirect → ${next}\n\n` +
      `Safe — destination is on ${TRUSTED_DOMAIN}.`;

    explanation.innerHTML = `
      <h3>Safe redirect — same domain.</h3>
      <p>Try changing the <code>?next=</code> field to an external URL:</p>
      <ul>
        <li><code>https://evil.com/phishing</code></li>
        <li><code>//evil.com</code> — protocol-relative URL bypass</li>
        <li><code>https://securecorp.com.evil.com</code> — domain confusion</li>
        <li><code>javascript:alert('XSS')</code> — JS execution via redirect</li>
      </ul>`;
  }
});

// Hint chips
document.querySelectorAll(".hint").forEach(hint => {
  hint.addEventListener("click", function () {
    document.getElementById("nextParam").value = this.textContent.trim();
  });
});

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
