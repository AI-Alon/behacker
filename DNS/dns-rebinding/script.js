const steps = document.querySelectorAll('.tl-step');
const simulateBtn = document.getElementById('simulateBtn');
const resetBtn    = document.getElementById('resetBtn');
const dnsLog      = document.getElementById('dnsLog');
const exfilBox    = document.getElementById('exfilBox');
const explanationBox = document.getElementById('explanationBox');

let running = false;

simulateBtn.addEventListener('click', async () => {
  if (running) return;
  running = true;
  dnsLog.innerHTML = '';
  exfilBox.classList.add('hidden');
  explanationBox.classList.add('hidden');
  steps.forEach(s => { s.classList.remove('active','done'); });

  // Phase 1
  activateStep(0);
  appendLog(`<span class="log-resolve">[DNS] attacker.com → 1.2.3.4 (attacker server)  TTL=5s</span>`);
  await sleep(600);
  appendLog(`<span class="log-resolve">[HTTP] Browser loads attacker.com — malicious JS injected</span>`);
  await sleep(800);
  doneStep(0);

  // Phase 2
  activateStep(1);
  appendLog(`<span class="log-rebind">[DNS] TTL expired for attacker.com</span>`);
  await sleep(600);
  appendLog(`<span class="log-rebind">[DNS] attacker changes A record: attacker.com → 127.0.0.1  TTL=1s</span>`);
  await sleep(800);
  doneStep(1);

  // Phase 3
  activateStep(2);
  appendLog(`<span class="log-resolve">[JS] XHR to http://attacker.com:8080/admin</span>`);
  await sleep(400);
  appendLog(`<span class="log-rebind">[DNS] attacker.com → 127.0.0.1 (rebind successful)</span>`);
  await sleep(400);
  appendLog(`<span class="log-resolve">[HTTP] Request reaches victim's localhost:8080</span>`);
  await sleep(800);
  doneStep(2);

  // Phase 4
  activateStep(3);
  await sleep(400);
  appendLog(`<span class="log-exfil">[EXFIL] localhost:8080/admin response sent to attacker.com/collect</span>`);
  appendLog(`<span class="log-exfil">[DATA] {"users":[{"id":1,"role":"admin","token":"abc123"}]}</span>`);
  await sleep(600);
  doneStep(3);

  exfilBox.classList.remove('hidden');
  exfilBox.textContent = `Attack complete. Victim's local service at localhost:8080 was accessed from the browser via DNS rebinding. Response exfiltrated to attacker.`;
  showExplanation();
  running = false;
});

resetBtn.addEventListener('click', () => {
  steps.forEach(s => { s.classList.remove('active','done'); });
  dnsLog.innerHTML = '';
  exfilBox.classList.add('hidden');
  explanationBox.classList.add('hidden');
  running = false;
});

function activateStep(i) { steps[i]?.classList.add('active'); }
function doneStep(i) { steps[i]?.classList.remove('active'); steps[i]?.classList.add('done'); }

function appendLog(html) {
  const line = document.createElement('div');
  line.innerHTML = html;
  dnsLog.appendChild(line);
  dnsLog.scrollTop = dnsLog.scrollHeight;
}

function showExplanation() {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>DNS Rebinding Attack</h3>
    <p>DNS rebinding exploits the browser's reliance on DNS for same-origin enforcement. By changing DNS mid-session (after the page loads), the attacker makes the browser believe <code>attacker.com</code> is the same origin as <code>127.0.0.1</code> — bypassing the Same-Origin Policy entirely.</p>
    <ul>
      <li><strong>Requirements:</strong> Attacker controls a domain with a short TTL (1–5s) and can update the A record. Victim visits attacker's page (phishing, ad, etc.).</li>
      <li><strong>Targets:</strong> Local admin panels (routers, IoT devices, localhost:3000), internal corporate services not exposed externally, cloud metadata endpoints.</li>
      <li><strong>Real-world use:</strong> Attacking home routers (DNS rebinding → router admin), local dev servers, internal APIs on corporate networks.</li>
      <li><strong>Defenses:</strong>
        <ul>
          <li>Services on localhost: check the <code>Host</code> header and reject requests not matching expected hostnames</li>
          <li>Use <code>--disable-web-security</code> only for testing, never production</li>
          <li>Routers/devices: disable DNS rebinding protection bypass features</li>
          <li>Network: configure DNS to not resolve public domains to private IPs (DNS rebinding protection)</li>
        </ul>
      </li>
    </ul>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
