// VULNERABLE BY DESIGN — Educational purposes only
// Simulates broken access control: admin endpoints only check for a valid session,
// not for an admin role — any logged-in user can call them.

const SESSION = { username: "alice", role: "user", uid: 101 };

const ADMIN_RESPONSES = {
  "/api/admin/users": {
    status: 200,
    body: {
      users: [
        { uid: 1,   username: "admin",  role: "admin",  email: "admin@securecorp.com" },
        { uid: 101, username: "alice",  role: "user",   email: "alice@securecorp.com" },
        { uid: 102, username: "bob",    role: "user",   email: "bob@securecorp.com"   },
        { uid: 103, username: "carol",  role: "editor", email: "carol@securecorp.com" },
      ]
    }
  },
  "/api/admin/secrets": {
    status: 200,
    body: {
      DB_PASSWORD:  "hunter2secret",
      JWT_SECRET:   "supersecret_key_99",
      API_KEY:      "sk-prod-a1b2c3d4e5f6",
      SMTP_PASS:    "mailpass2024",
    }
  },
  "/api/admin/delete-user": {
    status: 200,
    body: { message: "User deleted successfully.", affected_uid: 102 }
  },
  "/api/admin/promote": {
    status: 200,
    body: { message: "User alice promoted to admin.", uid: 101, new_role: "admin" }
  },
};

document.getElementById("sendBtn").addEventListener("click", function () {
  const endpoint    = document.getElementById("endpointSelect").value;
  const reqDisplay  = document.getElementById("requestDisplay");
  const responseBox = document.getElementById("responseBox");
  const explanation = document.getElementById("explanationBox");

  const method = endpoint.includes("delete") || endpoint.includes("promote") ? "POST" : "GET";

  // ── Vulnerable: only checks session exists, not role ─────────────────────
  reqDisplay.textContent =
    `${method} ${endpoint} HTTP/1.1\n` +
    `Cookie: session=alice_valid_session\n\n` +
    `// Server check: if (!session) return 401;   ← only checks login\n` +
    `// Missing:      if (session.role !== 'admin') return 403;`;

  const response = ADMIN_RESPONSES[endpoint];
  responseBox.classList.remove("hidden");
  responseBox.textContent =
    `HTTP/1.1 ${response.status} OK\n\n` +
    JSON.stringify(response.body, null, 2);

  explanation.classList.remove("hidden");
  explanation.innerHTML = `
    <h3>What happened?</h3>
    <p>The admin endpoint <code>${endpoint}</code> responded to a regular user's request because it only verified a session existed — it never checked the role.</p>
    <ul>
      <li>The UI hides admin links from regular users, but hiding is not access control.</li>
      <li>Any user who knows (or guesses) the endpoint URL can call it directly.</li>
      <li>This is called "security through obscurity" — it provides no real protection.</li>
      <li>Real-world discovery: Burp Suite proxy, JS source code, API docs, directory brute-force.</li>
      <li>The fix: check <code>session.role === 'admin'</code> (or a specific permission flag) on every privileged endpoint — server-side, every time.</li>
    </ul>`;
});
