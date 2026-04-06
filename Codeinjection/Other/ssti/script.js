// VULNERABLE BY DESIGN — Educational purposes only
// Simulates SSTI (Server-Side Template Injection) using a Jinja2-like syntax.
// Real SSTI happens server-side in engines like Jinja2, Twig, Freemarker, etc.

// ── Simulated server context (normally only accessible server-side) ───────────
const SERVER_VARS = {
  name:     "Guest",
  role:     "Viewer",
  date:     new Date().toDateString(),
  secret:   "FLAG{ssti_template_pwned}",
  config:   { debug: true, db_url: "postgres://admin:hunter2@db:5432/prod", version: "2.4.1" },
  users:    [
    { id: 1, username: "admin",  email: "admin@securecorp.io"  },
    { id: 2, username: "alice",  email: "alice@securecorp.io"  },
    { id: 3, username: "bob",    email: "bob@securecorp.io"    },
  ],
};

// ── Simulated Jinja2-like template engine (vulnerable) ───────────────────────
// Supports: {{expr}}  {% if cond %}...{% endif %}  {% for x in list %}...{% endfor %}
function renderTemplate(template, userNameInput) {
  // Merge user-supplied name into context
  const ctx = Object.assign({}, SERVER_VARS, { name: userNameInput });

  let output = template;
  let injected = false;

  // ── Process {% for %} blocks ─────────────────────────────────────────────
  output = output.replace(
    /\{%\s*for\s+(\w+)\s+in\s+([\w.]+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_, varName, listExpr, body) => {
      injected = true;
      const list = resolveExpr(listExpr, ctx);
      if (!Array.isArray(list)) return `[not iterable: ${listExpr}]`;
      return list.map(item => {
        const innerCtx = Object.assign({}, ctx, { [varName]: item });
        return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (__, expr) =>
          String(resolveExpr(expr, innerCtx) ?? "")
        );
      }).join("");
    }
  );

  // ── Process {% if %} blocks ──────────────────────────────────────────────
  output = output.replace(
    /\{%\s*if\s+([\w.]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g,
    (_, expr, body) => {
      injected = true;
      return resolveExpr(expr, ctx) ? body : "";
    }
  );

  // ── Process {{ expr }} ───────────────────────────────────────────────────
  output = output.replace(/\{\{\s*([\w.|]+)\s*\}\}/g, (_, expr) => {
    const val = resolveExpr(expr, ctx);
    if (val === undefined) return `{{ ${expr} }}`;
    // Accessing anything beyond the basic 3 variables counts as injection
    if (!["name","role","date"].includes(expr.split(".")[0])) injected = true;
    return String(val);
  });

  return { output, injected };
}

// Resolve a dot-path expression against a context object
function resolveExpr(expr, ctx) {
  // Handle Jinja2-style filters (e.g. users|length)
  const [path, filter] = expr.split("|").map(s => s.trim());
  let val = path.split(".").reduce((obj, key) => {
    if (obj == null) return undefined;
    return obj[key];
  }, ctx);

  if (filter === "length" && val != null) return Array.isArray(val) ? val.length : String(val).length;
  if (filter === "upper"  && val != null) return String(val).toUpperCase();
  if (filter === "lower"  && val != null) return String(val).toLowerCase();

  return val;
}

// ── DOM wiring ────────────────────────────────────────────────────────────────
document.getElementById("templateForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const nameInput   = document.getElementById("nameInput").value || "Guest";
  const templateStr = document.getElementById("templateInput").value;
  const tplDisplay  = document.getElementById("tplDisplay");
  const outputBox   = document.getElementById("outputBox");
  const explanation = document.getElementById("explanationBox");

  tplDisplay.textContent = templateStr;

  const { output, injected } = renderTemplate(templateStr, nameInput);

  outputBox.classList.remove("hidden");
  outputBox.innerHTML = `<div class="rendered-label">Rendered output:</div><div class="rendered-content">${escapeHtml(output)}</div>`;

  explanation.classList.remove("hidden");

  if (injected) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>Your template accessed server-side variables or executed template logic beyond what was intended.</p>
      <ul>
        <li>The template engine evaluated <code>{{ expr }}</code> blocks against the full server context — not just the user-facing variables.</li>
        <li>In real Jinja2, this escalates further: <code>{{''.__class__.__mro__[1].__subclasses__()}}</code> can reach Python internals and execute OS commands.</li>
        <li>An attacker can read config, credentials, internal state, and in many engines achieve full RCE.</li>
        <li>The fix: never render user-supplied strings as templates. Render a fixed template with user data passed as safe context variables.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Normal template — no injection detected.</h3>
      <p>Try these payloads in the Template field:</p>
      <ul>
        <li><code>{{secret}}</code> — reads the secret flag from server context</li>
        <li><code>{{config.db_url}}</code> — leaks the database connection string</li>
        <li><code>{{config}}</code> — dumps the entire config object</li>
        <li><code>{{users|length}} users registered</code> — accesses the users list</li>
        <li><code>{% for u in users %}{{u.username}} — {{u.email}}<br>{% endfor %}</code> — iterates and dumps all users</li>
        <li><code>{% if config.debug %}DEBUG MODE IS ON{% endif %}</code> — conditional on server config</li>
      </ul>`;
  }
});

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
