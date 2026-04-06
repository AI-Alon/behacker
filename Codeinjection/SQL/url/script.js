// VULNERABLE BY DESIGN — Educational purposes only
// Simulates SQL injection via URL parameter (e.g. ?id=1).
// A real backend would concatenate the URL param directly into a SQL string.

// ── Simulated "database" ─────────────────────────────────────────────────────
const DB = [
  { id: 1, username: "admin",   password: "s3cr3t!",    email: "admin@securecorp.io",   role: "Administrator" },
  { id: 2, username: "alice",   password: "alice2024",  email: "alice@securecorp.io",   role: "Editor" },
  { id: 3, username: "bob",     password: "ilovecats",  email: "bob@securecorp.io",     role: "Viewer" },
  { id: 4, username: "charlie", password: "hunter2",    email: "charlie@securecorp.io", role: "Viewer" },
];

// ── Classify the incoming ?id= value ────────────────────────────────────────
function classifyPayload(idParam) {
  const raw = `SELECT * FROM users WHERE id=${idParam}`;

  // DROP TABLE (destructive)
  if (/;\s*drop\s+table/i.test(raw)) {
    return { type: "drop", raw };
  }

  // UNION-based data exfiltration
  if (/union\s+select/i.test(raw)) {
    return { type: "union", raw };
  }

  // Boolean always-true tautologies
  const tautologies = [
    /\bOR\b\s+1\s*=\s*1/i,
    /\bOR\b\s*'\w*'\s*=\s*'\w*'/i,   // OR 'a'='a'
    /\bOR\b\s+true\b/i,
  ];
  if (tautologies.some(p => p.test(raw))) {
    return { type: "or-true", raw };
  }

  // Comment stripping (-- or #): truncates WHERE clause
  // e.g. ?id=1-- makes  WHERE id=1--  which strips remaining conditions
  const hasComment = /--/.test(idParam) || /#/.test(idParam);
  const stripped = raw.replace(/--.*$/, "").replace(/#.*$/, "").trim();
  const idMatch  = stripped.match(/WHERE\s+id\s*=\s*(\d+)/i);

  if (!idMatch) {
    // Something injected that broke the query structure
    return { type: "malformed", raw, stripped };
  }

  const targetId = parseInt(idMatch[1], 10);
  const found    = DB.find(u => u.id === targetId);

  return {
    type:     "normal",
    raw,
    stripped,
    targetId,
    row:      found ?? null,
    comment:  hasComment,   // 1-- is "normal" but shows comment-stripping note
  };
}

// ── Syntax-highlight the SQL query string ───────────────────────────────────
// Marks keywords, injected portions, and comment runs.
function highlightSQL(sql) {
  // Escape HTML first
  let s = sql.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Highlight SQL keywords
  const keywords = ["SELECT","FROM","WHERE","UNION","DROP","TABLE","OR","AND","INSERT","UPDATE","DELETE","NULL","TRUE","FALSE"];
  const kwRe = new RegExp(`\\b(${keywords.join("|")})\\b`, "gi");
  s = s.replace(kwRe, '<span class="sql-kw">$1</span>');

  // Highlight comment runs (-- to end, or #)
  s = s.replace(/(--[^\n]*)$/, '<span class="sql-comment">$1</span>');
  s = s.replace(/(#[^\n]*)$/, '<span class="sql-comment">$1</span>');

  // Highlight strings
  s = s.replace(/'([^']*)'/g, "<span class=\"sql-str\">'$1'</span>");

  // Highlight numbers
  s = s.replace(/\b(\d+)\b/g, '<span class="sql-num">$1</span>');

  return s;
}

// ── Render helpers ───────────────────────────────────────────────────────────
const resultArea     = document.getElementById("resultArea");
const queryDisplay   = document.getElementById("queryDisplay");
const explanationBox = document.getElementById("explanationBox");
const urlParam       = document.getElementById("urlParam");

function show(el) { el.classList.remove("hidden"); }

function renderQuery(sql) {
  queryDisplay.innerHTML = highlightSQL(sql);
}

function renderProfile(row, badgeType) {
  const badge = badgeType === "injected"
    ? '<span class="badge badge-injected">INJECTED</span>'
    : '<span class="badge badge-legit">NORMAL</span>';

  resultArea.innerHTML = `
    <div class="profile-box">
      <div class="profile-header">
        <div class="avatar" style="background:${avatarColor(row.username)}">${row.username[0].toUpperCase()}</div>
        <div>
          <div class="profile-name">${esc(row.username)} ${badge}</div>
          <div class="profile-role">${esc(row.role)}</div>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-item"><div class="label">ID</div><div class="value">${row.id}</div></div>
        <div class="info-item"><div class="label">Username</div><div class="value">${esc(row.username)}</div></div>
        <div class="info-item"><div class="label">Email</div><div class="value">${esc(row.email)}</div></div>
        <div class="info-item"><div class="label">Role</div><div class="value">${esc(row.role)}</div></div>
      </div>
    </div>`;
}

function renderError(msg) {
  resultArea.innerHTML = `<div class="msg error">${esc(msg)}</div>`;
}

function renderLeakTable(rows, includePassword) {
  const heads = includePassword
    ? ["ID","Username","Password","Role"]
    : ["ID","Username","Email","Role"];

  const rowsHTML = rows.map(r => {
    const cells = includePassword
      ? [r.id, r.username, r.password, r.role]
      : [r.id, r.username, r.email,    r.role];
    return `<tr>${cells.map(c => `<td>${esc(String(c))}</td>`).join("")}</tr>`;
  }).join("");

  resultArea.innerHTML = `
    <div class="leak-section">
      <div class="leak-title-row">
        <span class="leak-icon">!</span>
        <span class="leak-title">Data Leaked — Full Table Dump</span>
      </div>
      <table class="table-leak">
        <thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>`;
}

function renderDropped() {
  resultArea.innerHTML = `
    <div class="msg destructive">
      <strong>Table dropped!</strong> (simulated)<br/>
      The <code>users</code> table no longer exists. All data is gone.
    </div>`;
}

function renderExplanation(html) {
  explanationBox.innerHTML = html;
  show(explanationBox);
}

// ── Utility ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const AVATAR_COLORS = ["#238636","#1f6feb","#9e6a03","#8957e5","#da3633"];
function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Main ─────────────────────────────────────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const idParam = params.get("id");

if (idParam === null) {
  // Landing state — no ?id= in URL
  urlParam.textContent = "";
  queryDisplay.textContent = "— (no ?id= in URL yet — click a pill above)";
  renderExplanation(`
    <h3>How this works</h3>
    <p>
      This page simulates a backend that builds its SQL query by string-concatenating
      the <code>id</code> URL parameter with no sanitisation:
    </p>
    <pre class="code-block">// Vulnerable backend (Node/PHP/Python — same problem everywhere)
$id  = $_GET['id'];                       // raw user input
$sql = "SELECT * FROM users WHERE id=$id"; // directly concatenated
$row = $db->query($sql);                  // executed as-is</pre>
    <p>Click a <strong>Normal</strong> pill to see a clean lookup, or an <strong>Injection</strong> pill to attack it.</p>
  `);
} else {
  // Show the URL in the fake address bar
  urlParam.textContent = `?id=${idParam}`;

  const outcome = classifyPayload(idParam);
  renderQuery(outcome.raw);

  if (outcome.type === "drop") {
    renderDropped();
    renderExplanation(`
      <h3 class="bad">DROP TABLE — Destructive Injection</h3>
      <p>By appending <code>; DROP TABLE users--</code> the attacker turns a single SELECT into two statements:</p>
      <ol>
        <li><code>SELECT * FROM users WHERE id=1</code> — runs normally</li>
        <li><code>DROP TABLE users</code> — deletes the entire table</li>
      </ol>
      <p>
        The <code>--</code> comment strips anything the backend might have appended after the value.
        In a real database this is permanent — no undo.
      </p>
      <p><strong>Fix:</strong> parameterized queries prevent <em>any</em> SQL being injected,
      and many databases block multi-statement execution by default.</p>
    `);

  } else if (outcome.type === "union") {
    // UNION inject — expose passwords
    renderLeakTable(DB, true);
    renderExplanation(`
      <h3 class="bad">UNION SELECT — Data Exfiltration</h3>
      <p>
        <code>UNION SELECT</code> appends a <em>second</em> query result to the first.
        By making <code>id=0</code> (no real match), only the injected rows are returned.
      </p>
      <pre class="code-block">SELECT * FROM users WHERE id=0
UNION SELECT 1,username,password,role FROM users--</pre>
      <p>
        The attacker chose which columns to extract — here: <code>username</code>, <code>password</code>, and <code>role</code>.
        The <code>--</code> discards anything after the injected clause.
      </p>
      <p><strong>Fix:</strong> parameterized queries. The value <code>0 UNION SELECT…</code> would be treated as a literal string that matches no integer ID.</p>
    `);

  } else if (outcome.type === "or-true") {
    renderLeakTable(DB, false);
    renderExplanation(`
      <h3 class="bad">Boolean Injection — Always-True WHERE Clause</h3>
      <p>
        The injected <code>OR</code> condition is always true, so the <code>WHERE</code> clause matches
        <em>every row</em> in the table:
      </p>
      <pre class="code-block">SELECT * FROM users WHERE id=1 OR 1=1
--  WHERE clause is always true → returns all rows</pre>
      <p>
        Common tautologies: <code>OR 1=1</code>, <code>OR 'a'='a'</code>, <code>OR true</code>.
        They all exploit the fact that the parameter is inserted without quotes or type-checking.
      </p>
      <p><strong>Fix:</strong> parameterized queries or strict integer casting before interpolation.</p>
    `);

  } else if (outcome.type === "malformed") {
    renderError("Query error — malformed SQL (possible injection attempt).");
    renderExplanation(`
      <h3 class="warn">Malformed Query Detected</h3>
      <p>
        The injected value broke the SQL syntax in an unexpected way.
        In a real database this would return an error — which itself leaks information
        (table names, column names, DB engine) if verbose errors are shown to the user.
      </p>
      <p>Raw query: <code>${esc(outcome.raw)}</code></p>
    `);

  } else {
    // type === "normal" (possibly with a -- comment)
    if (outcome.row) {
      renderProfile(outcome.row, outcome.comment ? "injected" : "normal");
      if (outcome.comment) {
        renderExplanation(`
          <h3 class="warn">Comment Stripping — SQL Comment Injected</h3>
          <p>
            The <code>--</code> in the URL is a SQL line comment.
            Everything after it is ignored by the database engine:
          </p>
          <pre class="code-block">SELECT * FROM users WHERE id=1--  ← rest of query discarded</pre>
          <p>
            In a more complex query this could strip a second condition like
            <code>AND active=1</code> or <code>AND role='user'</code>,
            bypassing access checks.
          </p>
          <p><strong>Fix:</strong> parameterized queries — <code>--</code> would be treated as a literal string, not SQL syntax.</p>
        `);
      } else {
        renderExplanation(`
          <h3 class="ok">Normal Request — No Injection</h3>
          <p>The value <code>${esc(String(outcome.targetId))}</code> is a plain integer.
          The query ran safely and returned exactly one row.</p>
          <p>Now try an attack payload:</p>
          <ul>
            <li><a href="?id=1 OR 1=1" class="link-payload">?id=1 OR 1=1</a> — returns every user</li>
            <li><a href="?id=1--" class="link-payload">?id=1--</a> — comment strips trailing conditions</li>
            <li><a href="?id=0 UNION SELECT 1,username,password,role FROM users--" class="link-payload">?id=0 UNION SELECT …</a> — dumps usernames &amp; passwords</li>
            <li><a href="?id=1; DROP TABLE users--" class="link-payload">?id=1; DROP TABLE users--</a> — destructive wipe</li>
          </ul>
        `);
      }
    } else {
      renderError(`No user found for id=${outcome.targetId}.`);
      renderExplanation(`
        <h3 class="ok">No Result — But Still Vulnerable</h3>
        <p>
          id <code>${esc(String(outcome.targetId))}</code> doesn't exist in the database,
          so the page shows nothing. However the query was still built unsafely.
        </p>
        <p>Try <a href="?id=1" class="link-payload">?id=1</a> for a valid user,
        or <a href="?id=1 OR 1=1" class="link-payload">?id=1 OR 1=1</a> to bypass the WHERE clause entirely.</p>
      `);
    }
  }
}
