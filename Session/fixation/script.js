// VULNERABLE BY DESIGN — Educational purposes only
// Simulates session fixation: the server accepts a session ID from the URL
// and does NOT regenerate it after login — so an attacker who planted it
// can reuse the same ID to take over the authenticated session.

const VALID_USERS = {
  alice: "password123",
  bob:   "letmein99",
};

// In-memory session store: sid → { username, role }
const SESSION_STORE = {};

let currentSID = null;   // the session ID currently "in use" by the browser
let victimSID  = null;   // the session ID the attacker planted

// ── Step 1: Attacker plants a session ID ─────────────────────────────────────
document.getElementById("plantBtn").addEventListener("click", function () {
  const sid = document.getElementById("sidInput").value.trim() || "ATTACKER_KNOWN_SID_9x3k";

  // Server accepts the sid from URL and pre-creates an unauthenticated session
  SESSION_STORE[sid] = { username: null, role: null, authenticated: false };
  currentSID  = sid;
  victimSID   = sid;

  document.getElementById("urlDisplay").textContent =
    `https://securecorp.com/login?sid=${sid}\n\n` +
    `Server created session: SESSION_STORE["${sid}"] = { authenticated: false }\n` +
    `Victim's browser will use this SID for the upcoming login request.`;
});

// ── Step 2: Victim logs in (server reuses the existing SID — vulnerable) ─────
document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username   = document.getElementById("username").value.trim();
  const password   = document.getElementById("password").value;
  const errorMsg   = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");

  if (!VALID_USERS[username] || VALID_USERS[username] !== password) {
    errorMsg.classList.remove("hidden");
    return;
  }

  if (!currentSID) {
    // No planted SID — generate a fresh one (still vulnerable in this demo)
    currentSID = "RANDOM_" + Math.random().toString(36).slice(2, 10).toUpperCase();
    SESSION_STORE[currentSID] = {};
  }

  // VULNERABLE: session ID is NOT regenerated after login
  // A secure server would: delete old SID, create new SID, bind it to the user
  SESSION_STORE[currentSID] = { username, role: "user", authenticated: true };

  successMsg.textContent =
    `Logged in as ${username}. Session ID: ${currentSID}  (NOT regenerated — same SID the attacker planted!)`;
  successMsg.classList.remove("hidden");

  // Enable hijack button
  document.getElementById("hijackBtn").disabled = false;

  showExplanation("loggedin");
});

// ── Step 3: Attacker uses the same known SID ─────────────────────────────────
document.getElementById("hijackBtn").addEventListener("click", function () {
  const sid     = victimSID || currentSID;
  const session = SESSION_STORE[sid];
  const result  = document.getElementById("hijackResult");

  result.classList.remove("hidden");

  if (session && session.authenticated) {
    result.innerHTML =
      `ATTACKER REQUEST:\n` +
      `GET /dashboard HTTP/1.1\n` +
      `Cookie: sid=${sid}\n\n` +
      `SERVER RESPONSE:\n` +
      `200 OK — Welcome ${session.username}! (role: ${session.role})\n\n` +
      `Session hijacked. Attacker now has full access to ${session.username}'s account.`;
    showExplanation("hijacked");
  } else {
    result.textContent = "Session not yet authenticated — victim must log in first (Step 2).";
  }
});

function showExplanation(state) {
  const explanation = document.getElementById("explanationBox");
  explanation.classList.remove("hidden");

  if (state === "hijacked") {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>The attacker knew the session ID before the victim logged in — because the server never replaced it after authentication.</p>
      <ul>
        <li>The attacker crafted a login URL containing a known <code>sid</code> parameter.</li>
        <li>The server accepted that SID and pre-created an unauthenticated session.</li>
        <li>After the victim logged in, the server bound their identity to the <em>same</em> SID — never issuing a new one.</li>
        <li>The attacker, already holding that SID, can now make requests as the authenticated victim.</li>
      </ul>
      <p style="margin-top:10px;">The fix: always call <code>session.regenerate()</code> (or equivalent) immediately after a successful login. Destroy the old session, create a new one with a fresh random ID.</p>`;
  } else {
    explanation.innerHTML = `
      <h3>Victim logged in — same SID still in use.</h3>
      <p>The server did not regenerate the session ID. Click <strong>Hijack Session</strong> to take over as the attacker.</p>`;
  }
}
