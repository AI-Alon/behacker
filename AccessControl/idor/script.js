// VULNERABLE BY DESIGN — Educational purposes only
// Simulates IDOR: invoice records are fetched by sequential ID with no ownership check.

const CURRENT_USER = { uid: 101, username: "alice" };

const INVOICES = {
  1: { id: 1, owner_uid: 101, owner: "alice",   amount: "$120.00", item: "Security Training Course",   date: "2024-11-01" },
  2: { id: 2, owner_uid: 101, owner: "alice",   amount: "$45.50",  item: "VPN Subscription",          date: "2024-11-14" },
  3: { id: 3, owner_uid: 102, owner: "bob",     amount: "$980.00", item: "Hardware Security Key x10", date: "2024-10-22" },
  4: { id: 4, owner_uid: 102, owner: "bob",     amount: "$200.00", item: "Conference Ticket",         date: "2024-10-30" },
  5: { id: 5, owner_uid: 103, owner: "carol",   amount: "$55.00",  item: "Domain Registration",       date: "2024-09-05" },
  6: { id: 6, owner_uid: 103, owner: "carol",   amount: "$3200.00","item": "Pentest Report (Q3)",     date: "2024-09-18" },
  7: { id: 7, owner_uid: 1,   owner: "admin",   amount: "$15000.00","item":"Annual Server License",   date: "2024-08-01" },
  8: { id: 8, owner_uid: 1,   owner: "admin",   amount: "$500.00", item: "CEO Expense Report",        date: "2024-08-15" },
};

document.getElementById("fetchForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const id          = parseInt(document.getElementById("invoiceId").value, 10);
  const reqDisplay  = document.getElementById("requestDisplay");
  const responseBox = document.getElementById("responseBox");
  const explanation = document.getElementById("explanationBox");

  // ── Vulnerable: fetches by ID with no ownership check ────────────────────
  reqDisplay.textContent =
    `GET /api/invoices/${id}\n` +
    `Cookie: session=alice_session_token\n\n` +
    `// Server runs: SELECT * FROM invoices WHERE id = ${id}\n` +
    `// Missing:     AND owner_uid = ${CURRENT_USER.uid}`;

  const invoice = INVOICES[id];
  responseBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  if (!invoice) {
    responseBox.innerHTML = `<span class="err" style="color:#fca5a5;">404 Not Found — invoice #${id} does not exist.</span>`;
    explanation.innerHTML = `<h3>No record found.</h3><p>Try IDs 1–8.</p>`;
    return;
  }

  const isOwn = invoice.owner_uid === CURRENT_USER.uid;

  responseBox.innerHTML =
    `<span class="${isOwn ? "own" : "other"}">` +
    `${isOwn ? "200 OK (your invoice)" : "200 OK ← IDOR! This belongs to " + invoice.owner}\n` +
    `</span>` +
    `{\n` +
    `  "id":     ${invoice.id},\n` +
    `  "owner":  "${invoice.owner}" (uid: ${invoice.owner_uid}),\n` +
    `  "item":   "${invoice.item}",\n` +
    `  "amount": "${invoice.amount}",\n` +
    `  "date":   "${invoice.date}"\n` +
    `}`;

  if (!isOwn) {
    explanation.innerHTML = `
      <h3>What happened? — IDOR</h3>
      <p>You fetched invoice #${id} which belongs to <code>${invoice.owner}</code> — the server returned it because it only checked that <em>a</em> session existed, not that the session owner matches the record owner.</p>
      <ul>
        <li>IDOR (Insecure Direct Object Reference) occurs when user-supplied input directly references a data object with no authorisation check.</li>
        <li>Sequential integer IDs make enumeration trivial — try 1, 2, 3… until you find something interesting.</li>
        <li>Common targets: invoices, orders, medical records, private messages, user profiles.</li>
        <li>The fix: <code>WHERE id = ? AND owner_uid = session.uid</code> — always scope queries to the authenticated user.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Your own invoice — no IDOR.</h3>
      <p>Try IDs <strong>3–8</strong> to access other users' invoices. IDs 7–8 belong to the admin account.</p>`;
  }
});
