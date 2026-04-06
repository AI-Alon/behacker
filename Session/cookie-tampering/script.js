// VULNERABLE BY DESIGN — Educational purposes only
// Simulates cookie tampering: the session cookie is base64-encoded JSON with no
// HMAC signature — the client can decode it, modify any field, and re-encode it.

const VALID_USERS = {
  alice: { password: "password123", role: "user",  uid: 101 },
  bob:   { password: "letmein99",   role: "user",  uid: 102 },
  carol: { password: "monkey2024",  role: "editor", uid: 103 },
};

const ADMIN_DATA = {
  users:   ["alice (uid:101)", "bob (uid:102)", "carol (uid:103)", "admin (uid:1)"],
  secrets: ["DB_PASS=hunter2secret", "API_KEY=sk-prod-a1b2c3d4", "JWT_SECRET=supersecret99"],
};

function encodeCookie(obj) {
  return btoa(JSON.stringify(obj));
}

function decodeCookie(str) {
  try { return JSON.parse(atob(str)); } catch { return null; }
}

function renderDashboard(session) {
  const isAdmin = session.role === "admin";
  const dash = document.getElementById("dashboard");

  dash.innerHTML = `
    <div class="dash-name">${session.username}</div>
    <span class="dash-role ${isAdmin ? "role-admin" : "role-user"}">${session.role}</span>
    <div class="dash-section">
      <h4>Your account</h4>
      <ul>
        <li>User ID: ${session.uid}</li>
        <li>Role: ${session.role}</li>
        <li>Last login: just now</li>
      </ul>
    </div>
    <div class="dash-section">
      <h4>Admin panel</h4>
      ${isAdmin
        ? `<ul>
            <li><strong>User list:</strong> ${ADMIN_DATA.users.join(", ")}</li>
            <li><strong>Server secrets:</strong> ${ADMIN_DATA.secrets.join(" | ")}</li>
           </ul>`
        : `<p class="locked">Locked — admin role required. (Hint: edit the cookie above.)</p>`
      }
    </div>`;

  const explanation = document.getElementById("explanationBox");
  explanation.classList.remove("hidden");

  if (isAdmin) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>You changed the <code>role</code> field in the cookie to <code>"admin"</code> — the server accepted it without verification.</p>
      <ul>
        <li>The cookie was base64-encoded JSON with no cryptographic signature.</li>
        <li>Base64 is <strong>encoding, not encryption</strong> — anyone can decode and re-encode it.</li>
        <li>Because the server trusted the cookie value without verifying it was unmodified, any field change is accepted.</li>
        <li>An attacker can also change <code>uid</code> to access another user's data (IDOR via cookie).</li>
      </ul>
      <p style="margin-top:10px;">The fix: sign cookies with HMAC (<code>cookie-signature</code> library) or use server-side sessions where the cookie is only an opaque ID — all data lives on the server.</p>`;
  } else {
    explanation.innerHTML = `
      <h3>Logged in as <code>${session.role}</code>.</h3>
      <p>Edit the decoded cookie above — change <code>"role"</code> to <code>"admin"</code> (or <code>"uid"</code> to <code>1</code>), then click <strong>Apply Tampered Cookie</strong>.</p>`;
  }
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.classList.add("hidden");

  const user = VALID_USERS[username];
  if (!user || user.password !== password) {
    errorMsg.classList.remove("hidden");
    return;
  }

  // VULNERABLE: session data encoded in cookie without signature
  const session = { username, role: user.role, uid: user.uid };
  const encoded = encodeCookie(session);

  document.getElementById("rawCookie").textContent = `session=${encoded}`;
  document.getElementById("cookieEditor").value = JSON.stringify(session, null, 2);
  document.getElementById("cookieSection").classList.remove("hidden");

  renderDashboard(session);
});

document.getElementById("applyBtn").addEventListener("click", function () {
  const raw = document.getElementById("cookieEditor").value.trim();
  let session;

  try {
    session = JSON.parse(raw);
  } catch {
    alert("Invalid JSON in cookie editor.");
    return;
  }

  const encoded = encodeCookie(session);
  document.getElementById("rawCookie").textContent = `session=${encoded}`;

  renderDashboard(session);
});
