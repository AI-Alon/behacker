// VULNERABLE BY DESIGN — Educational purposes only
// Simulates verbose error leakage: the server runs with DEBUG=true and returns
// full stack traces, internal paths, library versions, and query details on errors.

const SERVER_META = {
  framework:  "Express 4.18.2",
  node:       "Node.js v18.12.1",
  db:         "MySQL 8.0.31",
  appPath:    "/var/www/securecorp/app",
  dbUser:     "root",
  dbHost:     "localhost",
  dbName:     "securecorp_prod",
};

const VALID_SORT_FIELDS = ["price", "name", "rating", "created_at"];
const PRODUCTS = [
  { id: 1, name: "Laptop Pro 15",   price: 1299, rating: 4.5 },
  { id: 2, name: "Wireless Mouse",  price: 29,   rating: 4.2 },
  { id: 3, name: "USB-C Hub",       price: 49,   rating: 4.0 },
];

function buildStackTrace(errorType, message, query) {
  return `<span class="frame-func">Error</span>: ${escapeHtml(message)}
    at <span class="frame-file">${SERVER_META.appPath}/routes/products.js</span>:<span class="frame-func">searchProducts</span> (line 47)
    at <span class="frame-file">${SERVER_META.appPath}/middleware/validate.js</span>:<span class="frame-func">runQuery</span> (line 23)
    at <span class="frame-file">${SERVER_META.appPath}/node_modules/mysql2/lib/connection.js</span>:<span class="frame-func">Connection.query</span> (line 130)
    at <span class="frame-file">${SERVER_META.appPath}/node_modules/express/lib/router/layer.js</span>:<span class="frame-func">Layer.handle</span> (line 95)

<span style="color:#b45309;">Debug info (DEBUG=true):</span>
  Framework:  ${SERVER_META.framework}
  Runtime:    ${SERVER_META.node}
  Database:   ${SERVER_META.db} @ ${SERVER_META.dbHost} (user: ${SERVER_META.dbUser}, db: ${SERVER_META.dbName})
  App path:   ${SERVER_META.appPath}
  ${query ? `Query attempted:\n  ${escapeHtml(query)}` : ""}`;
}

function handleSearch(query, sort, limit) {
  // Empty query
  if (!query || query.trim() === "") {
    return {
      type: "error",
      status: 500,
      errorType: "ValidationError",
      message: "search query must not be empty",
      trace: buildStackTrace("ValidationError", "search query must not be empty", null),
    };
  }

  // Invalid sort field
  if (!VALID_SORT_FIELDS.includes(sort)) {
    const sqlAttempt = `SELECT * FROM products WHERE name LIKE '%${query}%' ORDER BY \`${sort}\` LIMIT ${limit}`;
    return {
      type: "error",
      status: 500,
      errorType: "QueryError",
      message: `Unknown column '${sort}' in 'order clause'`,
      trace: buildStackTrace("QueryError", `Unknown column '${sort}' in 'order clause'`, sqlAttempt),
    };
  }

  // Non-numeric limit
  const limitNum = parseInt(limit, 10);
  if (isNaN(limitNum)) {
    return {
      type: "error",
      status: 500,
      errorType: "TypeError",
      message: `Invalid value for LIMIT: "${limit}" — expected integer`,
      trace: buildStackTrace("TypeError", `Invalid value for LIMIT: "${limit}"`, `SELECT * FROM products ... LIMIT ${limit}`),
    };
  }

  // Negative limit
  if (limitNum < 0) {
    return {
      type: "error",
      status: 500,
      errorType: "QueryError",
      message: `You have an error in your SQL syntax near 'LIMIT ${limitNum}'`,
      trace: buildStackTrace("QueryError", `You have an error in your SQL syntax near 'LIMIT ${limitNum}'`,
        `SELECT * FROM products WHERE name LIKE '%${query}%' ORDER BY \`${sort}\` LIMIT ${limitNum}`),
    };
  }

  // Huge limit — simulated memory error
  if (limitNum > 10000) {
    return {
      type: "error",
      status: 500,
      errorType: "RangeError",
      message: `Result set too large: query returned ${limitNum.toLocaleString()} rows, max allowed is 10000. Increase memory limit or reduce LIMIT.`,
      trace: buildStackTrace("RangeError", "Result set too large", `SELECT * FROM products ... LIMIT ${limitNum}`),
    };
  }

  // SQL in query — leaks query construction
  if (query.includes("'") || query.includes("--") || query.includes(";")) {
    const sqlAttempt = `SELECT * FROM products WHERE name LIKE '%${query}%' ORDER BY \`${sort}\` LIMIT ${limitNum}`;
    return {
      type: "error",
      status: 500,
      errorType: "QueryError",
      message: `You have an error in your SQL syntax near '${query.slice(0,20)}' at line 1`,
      trace: buildStackTrace("QueryError", `SQL syntax error near '${query.slice(0,20)}'`, sqlAttempt),
    };
  }

  // Success
  const results = PRODUCTS.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, Math.min(limitNum, 3));
  return { type: "ok", results };
}

document.querySelectorAll(".hint").forEach(h => {
  h.addEventListener("click", () => {
    if (h.dataset.q !== undefined) document.getElementById("queryInput").value = h.dataset.q;
    if (h.dataset.s !== undefined) document.getElementById("sortInput").value  = h.dataset.s;
    if (h.dataset.l !== undefined) document.getElementById("limitInput").value = h.dataset.l;
  });
});

document.getElementById("searchForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const query  = document.getElementById("queryInput").value;
  const sort   = document.getElementById("sortInput").value.trim();
  const limit  = document.getElementById("limitInput").value.trim();

  const responseBox = document.getElementById("responseBox");
  const explanation = document.getElementById("explanationBox");

  responseBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  const result = handleSearch(query, sort, limit);

  if (result.type === "ok") {
    responseBox.innerHTML =
      `<div class="response-ok">HTTP/1.1 200 OK\n\n` +
      JSON.stringify({ results: result.results, count: result.results.length }, null, 2) +
      `</div>`;
    explanation.innerHTML = `
      <h3>Normal response — no error triggered.</h3>
      <p>Try the hint payloads to trigger different error types. Each one leaks a different piece of internal information:</p>
      <ul>
        <li><strong>Empty query</strong> — validation error with stack trace and app path</li>
        <li><strong>Invalid sort field</strong> — database error leaks the full SQL query and DB version</li>
        <li><strong>Non-numeric limit</strong> — type error reveals the parameter name and expected type</li>
        <li><strong>SQL in query</strong> — syntax error echoes the unsanitised input back in the message</li>
      </ul>`;
  } else {
    responseBox.innerHTML =
      `<div class="response-error">` +
      `<div class="error-header">HTTP/1.1 500 Internal Server Error — DEBUG MODE</div>` +
      `<div class="error-type">${escapeHtml(result.errorType)}</div>` +
      `<div class="error-msg">${escapeHtml(result.message)}</div>` +
      `<div class="error-trace">${result.trace}</div>` +
      `</div>`;

    explanation.innerHTML = `
      <h3>What happened? — Verbose error leaked.</h3>
      <p>The server returned a full stack trace with internal details because <code>DEBUG=true</code> is set in production.</p>
      <ul>
        <li><strong>Stack trace</strong> reveals internal file paths, line numbers, and function names — a roadmap for the attacker.</li>
        <li><strong>Framework & library versions</strong> allow the attacker to look up known CVEs for those exact versions.</li>
        <li><strong>Database details</strong> (host, user, DB name, query structure) aid SQL injection and credential attacks.</li>
        <li><strong>App path</strong> confirms the directory structure, helping path traversal attacks.</li>
        <li>The fix: disable debug mode in production. Return generic error messages to clients. Log full details server-side only.</li>
      </ul>`;
  }
});

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
