// VULNERABLE BY DESIGN — Educational purposes only
// Simulates CSRF: the transfer endpoint trusts the session cookie and has no
// CSRF token — a forged request from evil.com goes through as if legitimate.

let balance = 1000;
const SESSION_USER = "alice";

function logRequest(type, to, amount, origin) {
  const log  = document.getElementById("requestLog");
  const line = document.createElement("div");
  line.className = type === "legit" ? "legit" : "forged";
  line.textContent =
    `[${type.toUpperCase()}] POST /api/transfer\n` +
    `  Origin: ${origin}\n` +
    `  Cookie: session=alice_session  (auto-attached by browser)\n` +
    `  Body:   to=${to}&amount=${amount}\n` +
    `  → Transfer of $${amount} to "${to}" ACCEPTED. New balance: $${balance}\n`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

// Legitimate transfer from the real site
document.getElementById("legitimateForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const to     = document.getElementById("toAccount").value;
  const amount = parseFloat(document.getElementById("amount").value) || 0;
  balance -= amount;
  logRequest("legit", to, amount, "https://securecorp.com");

  const explanation = document.getElementById("explanationBox");
  explanation.classList.remove("hidden");
  explanation.innerHTML = `
    <h3>Legitimate request — no CSRF yet.</h3>
    <p>Now click <strong>Redeem Now</strong> on the attacker's page to see a forged request sent without your knowledge.</p>`;
});

// Attack button — simulates what happens when victim visits evil.com
document.getElementById("attackBtn").addEventListener("click", function () {
  // Attacker's page auto-submits a hidden form targeting the victim's bank
  const forgedTo     = "attacker-account";
  const forgedAmount = 500;
  balance -= forgedAmount;

  // Show the hidden form HTML
  const formCode = document.getElementById("hiddenFormDisplay");
  formCode.classList.remove("hidden");
  formCode.textContent =
    `<form action="https://securecorp.com/api/transfer" method="POST" id="x">\n` +
    `  <input type="hidden" name="to"     value="${forgedTo}">\n` +
    `  <input type="hidden" name="amount" value="${forgedAmount}">\n` +
    `</form>\n` +
    `<script>document.getElementById('x').submit();<\/script>`;

  logRequest("forged", forgedTo, forgedAmount, "https://evil.com");

  const explanation = document.getElementById("explanationBox");
  explanation.classList.remove("hidden");
  explanation.innerHTML = `
    <h3>What happened?</h3>
    <p>The attacker's page submitted a hidden form to <code>securecorp.com/api/transfer</code>. The browser automatically attached alice's session cookie — the server had no way to tell this wasn't a legitimate request.</p>
    <ul>
      <li>CSRF exploits the browser's automatic cookie attachment on cross-origin requests.</li>
      <li>The victim doesn't need to interact beyond visiting the attacker's page — the form auto-submits with JavaScript.</li>
      <li>State-changing actions (transfers, deletes, password changes, account settings) are the main targets.</li>
      <li>The fix: require a CSRF token — a secret value embedded in the form that the attacker's page cannot read due to the Same-Origin Policy. Verify it server-side on every state-changing request.</li>
      <li>Also effective: <code>SameSite=Strict</code> or <code>SameSite=Lax</code> cookie attribute — prevents cookies from being sent on cross-site requests.</li>
    </ul>`;
});
