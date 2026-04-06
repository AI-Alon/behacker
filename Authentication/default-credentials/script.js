// VULNERABLE BY DESIGN — Educational purposes only
// Simulates default credential access: device shipped with well-known factory credentials.

// Factory default — never changed by the administrator
const DEFAULT_PAIRS = [
  { username: "admin",      password: "admin"      },
  { username: "admin",      password: "password"   },
  { username: "admin",      password: "1234"       },
  { username: "admin",      password: "12345"      },
  { username: "admin",      password: ""           },
  { username: "root",       password: "root"       },
  { username: "root",       password: "toor"       },
  { username: "root",       password: ""           },
  { username: "user",       password: "user"       },
  { username: "guest",      password: "guest"      },
  { username: "guest",      password: ""           },
  { username: "support",    password: "support"    },
  { username: "supervisor", password: "supervisor" },
];

// The device's actual credentials (never changed from factory default)
const DEVICE_USERNAME = "admin";
const DEVICE_PASSWORD = "admin";

function check(username, password) {
  return username === DEVICE_USERNAME && password === DEVICE_PASSWORD;
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username   = document.getElementById("username").value;
  const password   = document.getElementById("password").value;
  const errorMsg   = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");
  const explanation = document.getElementById("explanationBox");

  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");

  if (check(username, password)) {
    successMsg.textContent = `Access granted with default credentials: ${username} / ${password || "(blank)"}`;
    successMsg.classList.remove("hidden");
    showExplanation(username, password);
  } else {
    errorMsg.classList.remove("hidden");
    explanation.classList.remove("hidden");
    explanation.innerHTML = `
      <h3>Not quite — keep trying the list.</h3>
      <p>Try the pairs shown above. The device was never configured after deployment.</p>`;
  }
});

document.getElementById("autoBtn").addEventListener("click", function () {
  const autoLog = document.getElementById("autoLog");
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");

  autoLog.innerHTML = "";
  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");

  let i = 0;

  function next() {
    if (i >= DEFAULT_PAIRS.length) return;
    const pair = DEFAULT_PAIRS[i++];
    const success = check(pair.username, pair.password);

    const line = document.createElement("div");
    line.className = success ? "hit" : "fail";
    line.textContent = `[${String(i).padStart(2, "0")}] ${pair.username} / ${pair.password || "(blank)"}  →  ${success ? "HIT ✓" : "fail"}`;
    autoLog.appendChild(line);
    autoLog.scrollTop = autoLog.scrollHeight;

    if (success) {
      successMsg.textContent = `Access granted with default credentials: ${pair.username} / ${pair.password || "(blank)"}`;
      successMsg.classList.remove("hidden");
      showExplanation(pair.username, pair.password);
      return;
    }

    setTimeout(next, 150);
  }

  next();
});

function showExplanation(username, password) {
  const explanation = document.getElementById("explanationBox");
  explanation.classList.remove("hidden");
  explanation.innerHTML = `
    <h3>What happened?</h3>
    <p>The device accepted <code>${username} / ${password || "(blank)"}</code> — its factory-default credentials were never changed.</p>
    <ul>
      <li>Manufacturers ship devices with documented default credentials (often in public manuals).</li>
      <li>Tools like <em>Shodan</em> index exposed devices; attackers try default pairs immediately after discovery.</li>
      <li>Routers, IP cameras, NAS devices, printers, and industrial systems are common targets.</li>
      <li>Default credentials are publicly listed on sites like <em>Default Password DB</em> and <em>CIRT.net</em>.</li>
    </ul>
    <p style="margin-top:10px;">The fix: force a credential change on first login, disable default accounts entirely, and alert if factory credentials are still in use after deployment.</p>`;
}
