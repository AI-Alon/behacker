// VULNERABLE BY DESIGN — Educational purposes only
// Simulates brute-force: no rate limiting, no account lockout, no CAPTCHA.

const CORRECT_USERNAME = "admin";
const CORRECT_PASSWORD = "sunshine1"; // intentionally weak

const WORDLIST = [
  "123456", "password", "password1", "123456789", "qwerty",
  "letmein", "monkey", "dragon", "master", "abc123",
  "iloveyou", "welcome", "admin", "sunshine1", "princess",
];

let attemptCount = 0;

function check(username, password) {
  return username === CORRECT_USERNAME && password === CORRECT_PASSWORD;
}

function logAttempt(username, password, success) {
  attemptCount++;
  const log = document.getElementById("attemptLog");
  const line = document.createElement("div");
  line.className = success ? "hit" : "fail";
  line.textContent = `[${String(attemptCount).padStart(3, "0")}] ${username}:${password}  →  ${success ? "HIT ✓" : "fail"}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorMsg   = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");
  const explanation = document.getElementById("explanationBox");

  errorMsg.classList.add("hidden");
  successMsg.classList.add("hidden");

  const success = check(username, password);
  logAttempt(username, password, success);

  if (success) {
    successMsg.classList.remove("hidden");
    showExplanation(true);
  } else {
    errorMsg.classList.remove("hidden");
    explanation.classList.remove("hidden");
    explanation.innerHTML = `
      <h3>No lockout — keep trying.</h3>
      <p>A real attacker would automate this. The password is a common word — click <strong>Run Auto Brute-Force</strong> to simulate a wordlist attack.</p>`;
  }
});

document.getElementById("autoBtn").addEventListener("click", function () {
  attemptCount = 0;
  document.getElementById("attemptLog").innerHTML = "";

  let i = 0;

  function next() {
    if (i >= WORDLIST.length) return;
    const pw = WORDLIST[i++];
    const success = check(CORRECT_USERNAME, pw);
    logAttempt(CORRECT_USERNAME, pw, success);

    if (success) {
      document.getElementById("successMsg").classList.remove("hidden");
      document.getElementById("errorMsg").classList.add("hidden");
      showExplanation(true);
      return;
    }
    setTimeout(next, 120);
  }

  next();
});

function showExplanation(cracked) {
  const explanation = document.getElementById("explanationBox");
  explanation.classList.remove("hidden");

  if (cracked) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>The password was found by trying common passwords one by one — the server never slowed down or blocked the attacker.</p>
      <ul>
        <li>No rate limiting — the server accepts unlimited attempts per second.</li>
        <li>No account lockout — even 1000 failed attempts don't lock the account.</li>
        <li>No CAPTCHA — no human verification between attempts.</li>
        <li>Weak password — <code>sunshine1</code> appears in every common wordlist.</li>
        <li>Real tools like Hydra or Burp Intruder can make hundreds of requests per second.</li>
      </ul>
      <p style="margin-top:10px;">The fix: rate limiting (e.g. max 5 attempts / minute), exponential back-off, account lockout after N failures, CAPTCHA, and strong password policies.</p>`;
  }
}
