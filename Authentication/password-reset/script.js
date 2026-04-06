// VULNERABLE BY DESIGN — Educational purposes only
// Simulates password reset poisoning: the server builds the reset link using the
// Host header from the request — an attacker can forge this header to redirect
// the reset token to their own domain.

const RESET_TOKEN = "a3f9c2e1b847d056f3a1"; // simulated secret token

document.getElementById("resetForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const email      = document.getElementById("emailInput").value.trim();
  const hostHeader = document.getElementById("hostHeader").value.trim() || "securecorp.com";
  const emailPreview = document.getElementById("emailPreview");
  const codeDisplay  = document.getElementById("codeDisplay");
  const explanation  = document.getElementById("explanationBox");

  // ── Vulnerable: reset link domain is taken from the Host header ───────────
  const resetLink = `https://${hostHeader}/reset?token=${RESET_TOKEN}`;

  // Show vulnerable server-side logic
  codeDisplay.textContent =
`// Vulnerable server-side code (Node/Express):
const host      = req.headers['host'];          // ← attacker-controlled
const token     = generateResetToken(user);
const resetLink = \`https://\${host}/reset?token=\${token}\`;
sendEmail(user.email, resetLink);               // victim clicks → token sent to attacker`;

  // Detect if the host was poisoned
  const isPoisoned = hostHeader !== "securecorp.com";
  const linkClass  = isPoisoned ? "poisoned" : "";

  emailPreview.classList.remove("hidden");
  emailPreview.innerHTML = `
    <div class="email-from">From: no-reply@securecorp.com</div>
    <div class="email-to">To: ${escapeHtml(email)}</div>
    <hr style="border-color:#ddd;margin:8px 0;">
    <div class="email-body">
      <p>Hi,</p>
      <p style="margin-top:8px;">We received a request to reset your Secure Corp password. Click the link below:</p>
      <p style="margin-top:12px;"><a class="${linkClass}" href="#">${escapeHtml(resetLink)}</a></p>
      <p style="margin-top:12px;font-size:0.85rem;color:#555;">If you did not request this, you can ignore this email.</p>
    </div>`;

  explanation.classList.remove("hidden");

  if (isPoisoned) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>The reset link in the victim's email points to <code>${escapeHtml(hostHeader)}</code> — an attacker-controlled domain.</p>
      <ul>
        <li>The server built the reset URL using the <code>Host</code> header from the HTTP request without validating it.</li>
        <li>An attacker intercepts or crafts the reset request and sets <code>Host: evil.com</code>.</li>
        <li>The victim receives a legitimate-looking email from Secure Corp but the link points to the attacker's server.</li>
        <li>When the victim clicks the link, the secret token is sent to the attacker's server in the URL.</li>
        <li>The attacker uses the stolen token to reset the victim's password and take over the account.</li>
      </ul>
      <p style="margin-top:10px;">The fix: never build URLs from the <code>Host</code> header — hardcode the domain in server config (<code>APP_URL=https://securecorp.com</code>).</p>`;
  } else {
    explanation.innerHTML = `
      <h3>Normal reset — link points to the correct domain.</h3>
      <p>To simulate the attack, change the <strong>Host Header</strong> field to an attacker domain, e.g. <code>evil.com</code> or <code>attacker.ngrok.io</code>, then submit again.</p>
      <ul>
        <li>In a real attack, the Host header is modified with a proxy tool (Burp Suite) or via custom HTTP client.</li>
        <li>Some servers also trust <code>X-Forwarded-Host</code> or <code>X-Original-Host</code> headers — try those too.</li>
      </ul>`;
  }
});

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
