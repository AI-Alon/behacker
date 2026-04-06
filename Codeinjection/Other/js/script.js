// VULNERABLE BY DESIGN — Educational purposes only
// Simulates JS injection: user input is passed to eval() without sanitisation.

// Simulated server-side context variables (normally set by the backend)
const SERVER_CONTEXT = {
  role:    "Viewer",
  secret:  "FLAG{js_injection_pwned}",
  apiKey:  "sk-securecorp-abc123xyz",
};

document.getElementById("greetForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name        = document.getElementById("nameInput").value;
  const codeDisplay = document.getElementById("codeDisplay");
  const outputBox   = document.getElementById("outputBox");
  const explanation = document.getElementById("explanationBox");

  // ── Vulnerable: builds a JS expression string and evals it ───────────────
  const code = `"Hello, " + "${name}" + "! Welcome to Secure Corp."`;
  codeDisplay.textContent = code;

  outputBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  let result;
  let errored = false;

  try {
    // VULNERABLE: eval executes whatever the user injected
    result = eval(code); // eslint-disable-line no-eval
  } catch (err) {
    result = `[Error: ${err.message}]`;
    errored = true;
  }

  outputBox.textContent = String(result);

  // Detect injection (anything beyond a plain name)
  const isInjected = /[";+\-*/\\()\[\]{}]/.test(name);

  if (isInjected || errored) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>Your input broke out of the string literal and injected JavaScript that was executed by <code>eval()</code>.</p>
      <ul>
        <li>The app built a JS expression string by concatenating your input, then passed it to <code>eval()</code>.</li>
        <li>A <code>"</code> in your input closes the string literal — anything after runs as code.</li>
        <li>From there you can read variables, call functions, or exfiltrate data available in scope.</li>
        <li>The fix: never use <code>eval()</code> with user input. Use safe DOM APIs or template literals with proper escaping.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Normal input — no injection detected.</h3>
      <p>Try these payloads in the Name field:</p>
      <ul>
        <li><code>" + SERVER_CONTEXT.secret + "</code> — reads the secret variable from scope</li>
        <li><code>" + SERVER_CONTEXT.apiKey + "</code> — leaks the API key</li>
        <li><code>" + Object.keys(SERVER_CONTEXT) + "</code> — enumerates available keys</li>
        <li><code>" + JSON.stringify(SERVER_CONTEXT) + "</code> — dumps the entire context object</li>
        <li><code>"; alert('injected'); //</code> — runs arbitrary JS (alert as proof)</li>
      </ul>`;
  }
});
