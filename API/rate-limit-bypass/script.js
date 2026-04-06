// Simulated server: blocks after 3 attempts from same IP within 60s
// Correct OTP for admin account
const CORRECT_OTP = '4829';
const OTP_DIGITS = 4;
const TOTAL = Math.pow(10, OTP_DIGITS); // 0000–9999
const TARGET_EMAIL = 'admin@securecorp.com';

let serverState = {};   // IP -> { count, blocked }
let currentIP = '10.0.0.1';
let isRunning = false;
let stopFlag  = false;

const xffInput       = document.getElementById('xffInput');
const requestLog     = document.getElementById('requestLog');
const explanationBox = document.getElementById('explanationBox');

// Manual OTP form submission
document.getElementById('otpForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const otp = document.getElementById('otpInput').value.trim();
  const ip  = xffInput.value.trim() || currentIP;
  if (!otp) return;
  if (!serverState[ip]) serverState[ip] = { count: 0, blocked: false };
  const st = serverState[ip];
  if (st.count >= 3) {
    st.blocked = true;
    appendLog(`<span class="log-blocked">[${otp}] 429 Rate limited on ${ip}</span>`);
    return;
  }
  st.count++;
  if (otp === CORRECT_OTP) {
    appendLog(`<span class="log-ok">[${otp}] 200 OK — CORRECT OTP FOUND!</span>`);
    showResult(otp);
    showExplanation();
  } else {
    appendLog(`<span class="log-err">[${otp}] 401 Invalid OTP (IP: ${ip}, attempt ${st.count}/3)</span>`);
  }
});

document.getElementById('autoBtn').addEventListener('click', () => {
  if (isRunning) {
    stopFlag = true;
    return;
  }
  serverState = {};
  requestLog.innerHTML = '';
  explanationBox.classList.add('hidden');
  isRunning = true;
  stopFlag  = false;
  currentIP = xffInput.value.trim() || '10.0.0.1';
  bruteForce(0);
});

function makeRequest(otp) {
  const ip = xffInput.value.trim() || currentIP;
  if (!serverState[ip]) serverState[ip] = { count: 0, blocked: false };
  const st = serverState[ip];
  if (st.count >= 3) {
    st.blocked = true;
    return { status: 429, body: 'Too Many Requests', blocked: true };
  }
  st.count++;
  if (otp === CORRECT_OTP) return { status: 200, body: 'OTP verified — login granted', correct: true };
  return { status: 401, body: 'Invalid OTP' };
}

function rotateIP() {
  // Parse current IP, increment last octet
  const parts = currentIP.split('.');
  let last = parseInt(parts[3]);
  last = (last + 1) % 256 || 1;
  parts[3] = last;
  currentIP = parts.join('.');
  // Update header input
  xffInput.value = currentIP;
}

async function bruteForce(start) {
  for (let i = start; i < TOTAL; i++) {
    if (stopFlag) { isRunning = false; return; }
    const otp = String(i).padStart(OTP_DIGITS, '0');
    const resp = makeRequest(otp);

    if (resp.blocked) {
      appendLog(`<span class="log-blocked">[${otp}] 429 Rate limited on ${currentIP}</span>`);
      rotateIP();
      appendLog(`<span class="log-rotated">[→] Rotated IP to ${currentIP}</span>`);
      // Retry same OTP with new IP
      i--;
      await sleep(30);
      continue;
    }

    if (resp.correct) {
      appendLog(`<span class="log-ok">[${otp}] 200 OK — CORRECT OTP FOUND!</span>`);
      isRunning = false;
      showResult(otp);
      showExplanation();
      return;
    } else {
      appendLog(`<span class="log-err">[${otp}] 401 Incorrect</span>`);
    }

    if (i % 20 === 0) await sleep(1);
  }
  isRunning = false;
}

function appendLog(html) {
  const line = document.createElement('div');
  line.innerHTML = html;
  requestLog.appendChild(line);
  requestLog.scrollTop = requestLog.scrollHeight;
}

function showResult(otp) {
  const line = document.createElement('div');
  line.className = 'log-ok';
  line.style.cssText = 'margin-top:8px;padding:8px;background:#1a3a1a;border:1px solid #2ea043;border-radius:4px;';
  line.textContent = `Success! OTP "${otp}" accepted for ${TARGET_EMAIL}. Total IPs rotated: ${Object.keys(serverState).length}`;
  requestLog.appendChild(line);
  requestLog.scrollTop = requestLog.scrollHeight;
}

function showExplanation() {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Rate Limit Bypass via IP Header Spoofing</h3>
    <p>Many APIs trust the <code>X-Forwarded-For</code> header to identify client IPs — but this header is freely settable by the client. Rotating its value bypasses per-IP rate limits, allowing unlimited brute-force attempts.</p>
    <ul>
      <li><strong>Common bypass headers:</strong> <code>X-Forwarded-For</code>, <code>X-Real-IP</code>, <code>CF-Connecting-IP</code>, <code>True-Client-IP</code></li>
      <li><strong>Impact:</strong> OTP brute-force, password enumeration, account takeover at scale.</li>
      <li><strong>Fix:</strong> Rate-limit on the authenticated user/account identity, not just IP. Do not trust client-supplied IP headers unless coming from a trusted proxy. Use per-account lockout (e.g. lock after 5 failures regardless of IP).</li>
    </ul>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
