// VULNERABLE BY DESIGN — Educational purposes only
// Simulates credential stuffing: leaked username:password pairs tested against this site.
// Users who reused passwords from a breached service are compromised.

// Fictional breach dump — pairs "stolen" from another service
const BREACH_DUMP = [
  { username: "alice@example.com",   password: "qwerty123"   },
  { username: "bob@example.com",     password: "hunter2"     },
  { username: "carol@example.com",   password: "iloveyou"    },
  { username: "dave@example.com",    password: "letmein99"   },
  { username: "eve@example.com",     password: "sunshine1"   },
  { username: "frank@example.com",   password: "pass1234"    },
  { username: "grace@example.com",   password: "dragon2020"  },
  { username: "heidi@example.com",   password: "monkey123"   },
  { username: "ivan@securecorp.com", password: "abc123"      },
  { username: "judy@securecorp.com", password: "welcome2024" },
];

// Secure Corp's actual user database — some users reused their breached password
const SITE_USERS = {
  "alice@example.com":   "different_password",  // changed after breach
  "bob@example.com":     "hunter2",             // REUSED — vulnerable
  "carol@example.com":   "newpassword!",         // changed
  "dave@example.com":    "letmein99",            // REUSED — vulnerable
  "eve@example.com":     "sunshine1",            // REUSED — vulnerable
  "ivan@securecorp.com": "securecorp_only_pw",  // unique password — safe
  "judy@securecorp.com": "welcome2024",          // REUSED — vulnerable
};

function checkLogin(username, password) {
  return SITE_USERS[username] && SITE_USERS[username] === password;
}

// Render the breach dump list
window.addEventListener("DOMContentLoaded", function () {
  const credList = document.getElementById("credList");
  credList.innerHTML = BREACH_DUMP
    .map(c => `<div>${c.username}:${c.password}</div>`)
    .join("");
});

document.getElementById("stuffBtn").addEventListener("click", function () {
  const resultsLog = document.getElementById("resultsLog");
  const explanation = document.getElementById("explanationBox");

  resultsLog.innerHTML = "";
  let i = 0;
  let hits = 0;

  function next() {
    if (i >= BREACH_DUMP.length) {
      explanation.classList.remove("hidden");
      explanation.innerHTML = `
        <h3>What happened?</h3>
        <p>${hits} of ${BREACH_DUMP.length} credential pairs worked on this site — those users reused their breached password.</p>
        <ul>
          <li>Credential stuffing uses <em>real</em> username/password pairs from previous data breaches — not guesses.</li>
          <li>Success rates are low per-account (~0.1–2%) but attackers test millions of pairs automatically.</li>
          <li>Unlike brute force, each attempt uses a <em>correct password for some site</em> — harder to detect by pattern.</li>
          <li>The attacker does not need to know which service the victim reused their password on.</li>
        </ul>
        <p style="margin-top:10px;">The fix: enforce unique passwords (breach-password checking via HaveIBeenPwned API), require MFA, and use per-IP rate limiting + anomaly detection on login attempts.</p>`;
      return;
    }

    const cred = BREACH_DUMP[i++];
    const success = checkLogin(cred.username, cred.password);
    if (success) hits++;

    const line = document.createElement("div");
    line.className = success ? "hit" : "fail";
    line.textContent = `[${String(i).padStart(2, "0")}] ${cred.username}:${cred.password}  →  ${success ? "HIT ✓  (password reused!)" : "fail"}`;
    resultsLog.appendChild(line);
    resultsLog.scrollTop = resultsLog.scrollHeight;

    setTimeout(next, 200);
  }

  next();
});
