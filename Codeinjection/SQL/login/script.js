// VULNERABLE BY DESIGN — Educational purposes only
// This simulates a server-side SQL injection vulnerability in the browser.
// Real SQL injection happens on a backend; this JS mimics the same logic.

// ── Simulated "database" ──────────────────────────────────────────────────────
const DB = [
  { username: "admin", password: "password123", role: "Administrator" },
  { username: "alice", password: "qwerty",       role: "Editor" },
  { username: "bob",   password: "letmein",      role: "Viewer" },
];

// ── Simulated vulnerable SQL evaluator ───────────────────────────────────────
// Mimics: SELECT * FROM users WHERE username='<input>' AND password='<input>'
// Supports:  ' OR '1'='1    admin'--    ' OR 1=1--    destructive patterns

function simulateSQLQuery(username, password) {
  const raw = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;

  // ── Detect comment-based injection (-- strips the password clause) ──────
  const strippedQuery = raw.replace(/--.*$/, "").trim();

  // ── Check for destructive payloads (simulate, don't actually drop) ──────
  if (/drop\s+table/i.test(raw)) {
    return {
      query: raw,
      result: null,
      injected: true,
      destructive: true,
      message: "Table dropped! (simulated) — DB wiped.",
    };
  }

  // ── Check for UNION-based injection ─────────────────────────────────────
  if (/union\s+select/i.test(raw)) {
    return {
      query: raw,
      result: DB,  // simulate leaking all rows
      injected: true,
      union: true,
      message: "UNION injection detected — all rows leaked!",
    };
  }

  // ── Evaluate the WHERE clause by parsing the stripped query ─────────────
  // Extract what's between WHERE and end-of-string (after comment removal)
  const whereMatch = strippedQuery.match(/WHERE\s+(.+)$/i);
  if (!whereMatch) {
    return { query: raw, result: null, injected: false, message: "Parse error." };
  }

  const whereClause = whereMatch[1];

  // Check if OR injection makes the clause always true
  const alwaysTruePatterns = [
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /'\s*OR\s*1\s*=\s*1/i,
    /'\s*OR\s*'[^']+'\s*=\s*'[^']+/i,  // generic OR x=x
    /'\s*OR\s*true/i,
  ];

  const isAlwaysTrue = alwaysTruePatterns.some(p => p.test(whereClause));

  if (isAlwaysTrue) {
    // Return the first row (as a real DB would)
    return {
      query: raw,
      result: [DB[0]],
      injected: true,
      message: "OR injection — WHERE clause always true. First row returned.",
    };
  }

  // ── Comment-based: username='admin'-- strips password check ─────────────
  // After stripping comments, password clause is gone → match only username
  const commentInjected = raw.includes("--") || raw.includes("#");
  if (commentInjected) {
    const usernameMatch = strippedQuery.match(/username='([^']+)'/i);
    if (usernameMatch) {
      const targetUser = usernameMatch[1];
      const found = DB.find(u => u.username === targetUser);
      if (found) {
        return {
          query: raw,
          result: [found],
          injected: true,
          message: `Comment injection — password check bypassed for '${targetUser}'.`,
        };
      }
    }
  }

  // ── Normal (non-injected) login ──────────────────────────────────────────
  const found = DB.find(u => u.username === username && u.password === password);
  return {
    query: raw,
    result: found ? [found] : null,
    injected: false,
    message: found ? "Login successful." : "Invalid credentials.",
  };
}

// ── DOM wiring ────────────────────────────────────────────────────────────────
const loginForm     = document.getElementById("loginForm");
const errorMsg      = document.getElementById("errorMsg");
const successMsg    = document.getElementById("successMsg");
const queryDisplay  = document.getElementById("queryDisplay");
const explanationBox = document.getElementById("explanationBox");

loginForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  // Reset state
  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");
  explanationBox.classList.add("hidden");

  const outcome = simulateSQLQuery(username, password);

  // Show the raw query
  queryDisplay.textContent = outcome.query;

  if (outcome.destructive) {
    errorMsg.textContent = "DROP TABLE detected! (simulated) — Database wiped.";
    errorMsg.classList.remove("hidden");
    showExplanation(true, outcome.message);
    return;
  }

  if (outcome.union) {
    // Redirect to dashboard with all leaked rows
    sessionStorage.setItem("sqli_result", JSON.stringify({
      user: outcome.result[0],
      injected: true,
      allRows: outcome.result,
      query: outcome.query,
      message: outcome.message,
    }));
    showExplanation(true, outcome.message);
    window.location.href = "#";
    return;
  }

  if (outcome.result && outcome.result.length > 0) {
    successMsg.textContent = "Login successful! Redirecting...";
    successMsg.classList.remove("hidden");

    sessionStorage.setItem("sqli_result", JSON.stringify({
      user: outcome.result[0],
      injected: outcome.injected,
      query: outcome.query,
      message: outcome.message,
    }));

    showExplanation(outcome.injected, outcome.message);
    setTimeout(() => { window.location.href = "#"; }, 900);
  } else {
    errorMsg.textContent = "Invalid username or password.";
    errorMsg.classList.remove("hidden");
    showExplanation(false, outcome.message);
  }
});

function showExplanation(injected, message) {
  explanationBox.classList.remove("hidden");
  if (injected) {
    explanationBox.innerHTML = `
      <h3>What happened?</h3>
      <p>${message}</p>
      <ul>
        <li>The username/password were inserted <strong>directly</strong> into the SQL query with no escaping.</li>
        <li>A single quote <code>'</code> closes the string literal, letting you append arbitrary SQL.</li>
        <li>Using <code>--</code> comments out the rest of the query, bypassing the password check entirely.</li>
        <li>The fix: use <strong>parameterized queries</strong> — credentials are passed as bound values, not concatenated text.</li>
      </ul>`;
  } else {
    explanationBox.innerHTML = `
      <h3>Normal login — no injection detected.</h3>
      <p>Try these payloads in the username field to see injection in action:</p>
      <ul>
        <li><code>admin'--</code> — comment injection, bypasses password check</li>
        <li><code>' OR '1'='1</code> — always-true OR injection</li>
        <li><code>' OR 1=1--</code> — numeric tautology with comment</li>
        <li><code>' UNION SELECT username,password,role FROM users--</code> — UNION leak</li>
        <li><code>'; DROP TABLE users--</code> — simulated destructive query</li>
      </ul>`;
  }
}
