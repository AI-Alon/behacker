// VULNERABLE BY DESIGN — Educational purposes only
// Simulates SQL injection via a search input field.
// Real vulnerability: backend concatenates the search term into a LIKE query.

// ── Simulated "database" ──────────────────────────────────────────────────────
const PRODUCTS = [
  { id: 1, name: "Wireless Mouse",       category: "Electronics", price: "$29.99",  stock: 142 },
  { id: 2, name: "Mechanical Keyboard",  category: "Electronics", price: "$89.99",  stock: 57  },
  { id: 3, name: "USB-C Hub",            category: "Electronics", price: "$39.99",  stock: 203 },
  { id: 4, name: "Standing Desk",        category: "Furniture",   price: "$349.00", stock: 18  },
  { id: 5, name: "Ergonomic Chair",      category: "Furniture",   price: "$279.00", stock: 34  },
  { id: 6, name: "Notebook (A5)",        category: "Stationery",  price: "$8.49",   stock: 500 },
  { id: 7, name: "Ballpoint Pens x10",   category: "Stationery",  price: "$4.99",   stock: 800 },
];

// Hidden "admin" table that only leaks via injection
const USERS = [
  { id: 1, username: "admin",  email: "admin@securecorp.io",  password: "password123" },
  { id: 2, username: "alice",  email: "alice@securecorp.io",  password: "qwerty"      },
  { id: 3, username: "bob",    email: "bob@securecorp.io",    password: "letmein"     },
];

// ── Column headers for display ────────────────────────────────────────────────
const PRODUCT_COLS = ["id", "name", "category", "price", "stock"];
const USER_COLS    = ["id", "username", "email", "password"];

// ── Simulated vulnerable SQL evaluator ───────────────────────────────────────
// Mimics: SELECT * FROM products WHERE name LIKE '%<term>%'
function simulateSQLQuery(term) {
  const raw = `SELECT * FROM products WHERE name LIKE '%${term}%'`;

  // ── Destructive ──────────────────────────────────────────────────────────
  if (/drop\s+table/i.test(raw)) {
    return { query: raw, result: [], cols: [], injected: true, destructive: true,
             message: "DROP TABLE detected! (simulated) — DB wiped." };
  }

  // ── UNION injection — detect what table is targeted ──────────────────────
  if (/union\s+select/i.test(raw)) {
    const usersTarget = /\bfrom\s+users\b/i.test(raw);
    const leakedData  = usersTarget ? USERS : PRODUCTS;
    const leakedCols  = usersTarget ? USER_COLS : PRODUCT_COLS;
    return {
      query: raw, result: leakedData, cols: leakedCols,
      injected: true, union: true,
      message: usersTarget
        ? "UNION injection — users table leaked! Credentials exposed."
        : "UNION injection — products table data returned via UNION.",
    };
  }

  // ── Always-true (closes LIKE and ORs in a tautology) ─────────────────────
  // e.g.  %' OR '1'='1   or   %' OR 1=1--
  const alwaysTrue = [
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /'\s*OR\s*1\s*=\s*1/i,
    /'\s*OR\s*true\b/i,
    /'\s*OR\s*'[^']+'\s*=\s*'[^']+/i,
  ];
  if (alwaysTrue.some(p => p.test(raw))) {
    return { query: raw, result: PRODUCTS, cols: PRODUCT_COLS,
             injected: true, all: true,
             message: "OR injection — WHERE clause is always true. All products returned." };
  }

  // ── Comment stripping ────────────────────────────────────────────────────
  const stripped = raw.replace(/--.*$/, "").replace(/#.*$/, "").trim();

  // ── Normal LIKE match ────────────────────────────────────────────────────
  // Extract the literal between % and %
  const likeMatch = stripped.match(/LIKE\s+'%(.*)%'/i);
  const pattern   = likeMatch ? likeMatch[1].toLowerCase() : "";
  const results   = PRODUCTS.filter(p => p.name.toLowerCase().includes(pattern));

  return {
    query: raw, result: results, cols: PRODUCT_COLS,
    injected: false,
    message: results.length > 0
      ? `${results.length} product(s) matched.`
      : "No products matched.",
  };
}

// ── DOM wiring ────────────────────────────────────────────────────────────────
const form           = document.getElementById("searchForm");
const searchInput    = document.getElementById("searchInput");
const queryDisplay   = document.getElementById("queryDisplay");
const resultsSection = document.getElementById("resultsSection");
const resultsHead    = document.getElementById("resultsHead");
const resultsBody    = document.getElementById("resultsBody");
const resultCount    = document.getElementById("resultCount");
const errorMsg       = document.getElementById("errorMsg");
const explanationBox = document.getElementById("explanationBox");

form.addEventListener("submit", function (e) {
  e.preventDefault();

  // Reset
  resultsSection.classList.add("hidden");
  errorMsg.classList.add("hidden");
  explanationBox.classList.add("hidden");
  resultsHead.innerHTML = "";
  resultsBody.innerHTML = "";

  const term    = searchInput.value;
  const outcome = simulateSQLQuery(term);

  queryDisplay.textContent = outcome.query;

  if (outcome.destructive) {
    errorMsg.textContent = outcome.message;
    errorMsg.classList.remove("hidden");
    showExplanation(true, outcome.message);
    return;
  }

  if (outcome.result && outcome.result.length > 0) {
    // Build table header from cols
    resultsHead.innerHTML = "<tr>" + outcome.cols.map(c =>
      `<th>${c.charAt(0).toUpperCase() + c.slice(1)}</th>`
    ).join("") + "</tr>";

    // Build rows
    outcome.result.forEach(row => {
      resultsBody.innerHTML += "<tr>" +
        outcome.cols.map(c => `<td>${row[c]}</td>`).join("") +
        "</tr>";
    });

    resultCount.textContent = `(${outcome.result.length} row${outcome.result.length !== 1 ? "s" : ""})`;
    resultsSection.classList.remove("hidden");

    if (outcome.union) {
      resultsSection.querySelector(".results-title").style.color = "#f8c555";
    }

    showExplanation(outcome.injected, outcome.message);
  } else {
    errorMsg.textContent = "No results found.";
    errorMsg.classList.remove("hidden");
    if (outcome.injected) showExplanation(true, outcome.message);
  }
});

function showExplanation(injected, message) {
  explanationBox.classList.remove("hidden");
  if (injected) {
    explanationBox.innerHTML = `
      <h3>What happened?</h3>
      <p>${message}</p>
      <ul>
        <li>The search term was inserted <strong>directly</strong> into the SQL LIKE clause with no escaping.</li>
        <li>A single quote <code>'</code> in the input closes the string literal, letting you append arbitrary SQL.</li>
        <li>From there you can add <code>OR</code> tautologies, <code>UNION SELECT</code> from other tables, or even <code>DROP TABLE</code>.</li>
        <li>The fix: use <strong>parameterized queries</strong> — the term is passed as a bound value, not concatenated text.</li>
      </ul>`;
  } else {
    explanationBox.innerHTML = `
      <h3>Normal search — no injection detected.</h3>
      <p>Try these payloads in the search box to see injection in action:</p>
      <ul>
        <li><code>' OR '1'='1</code> — always-true, returns all products</li>
        <li><code>' OR 1=1--</code> — numeric tautology with comment</li>
        <li><code>' UNION SELECT id,username,email,password FROM users--</code> — leak the users table</li>
        <li><code>'; DROP TABLE products--</code> — simulated destructive query</li>
      </ul>`;
  }
}
