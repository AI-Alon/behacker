// Simulated bank account — VULNERABLE to race condition
// Real TOCTOU: check balance → delay → deduct (window allows concurrent debits)
let balance = 50.00;
const INITIAL_BALANCE = 50.00;

const balanceDisplay = document.getElementById('balanceDisplay');
const transferAmount = document.getElementById('transferAmount');
const concurrentCount = document.getElementById('concurrentCount');
const concurrentLabel = document.getElementById('concurrentLabel');
const singleBtn = document.getElementById('singleBtn');
const raceBtn   = document.getElementById('raceBtn');
const resetBtn  = document.getElementById('resetBtn');
const raceLog   = document.getElementById('raceLog');
const raceResult = document.getElementById('raceResult');
const explanationBox = document.getElementById('explanationBox');

concurrentCount.addEventListener('input', () => {
  concurrentLabel.textContent = `${concurrentCount.value} requests`;
});

singleBtn.addEventListener('click', async () => {
  const amount = parseFloat(transferAmount.value) || 50;
  raceLog.innerHTML = '';
  raceResult.classList.add('hidden');
  balance = INITIAL_BALANCE;
  updateBalance();
  const result = await vulnerableTransfer(amount, 'REQ-1');
  appendLog(result.ok
    ? `<span class="log-ok">[REQ-1] Transferred $${amount.toFixed(2)} — Balance: $${balance.toFixed(2)}</span>`
    : `<span class="log-err">[REQ-1] Rejected — Insufficient funds. Balance: $${balance.toFixed(2)}</span>`);
});

raceBtn.addEventListener('click', async () => {
  const amount = parseFloat(transferAmount.value) || 50;
  const n = parseInt(concurrentCount.value) || 10;
  raceLog.innerHTML = '';
  raceResult.classList.add('hidden');
  balance = INITIAL_BALANCE;
  updateBalance();

  appendLog(`<span class="log-race">[*] Firing ${n} concurrent requests for $${amount.toFixed(2)} each...</span>`);

  // Fire all concurrently — simulates HTTP race window
  const promises = Array.from({ length: n }, (_, i) =>
    vulnerableTransfer(amount, `REQ-${i+1}`)
  );
  const results = await Promise.all(promises);

  let successCount = 0;
  results.forEach((r, i) => {
    if (r.ok) {
      successCount++;
      appendLog(`<span class="log-ok">[REQ-${i+1}] ✓ Transfer approved — snapshot balance was $${r.snapshotBalance.toFixed(2)}</span>`);
    } else {
      appendLog(`<span class="log-err">[REQ-${i+1}] ✗ Rejected — insufficient funds</span>`);
    }
  });

  const totalTransferred = successCount * amount;
  raceResult.classList.remove('hidden');
  if (successCount > 1) {
    raceResult.className = 'result-box win';
    raceResult.textContent = `Race condition exploited! ${successCount} of ${n} requests succeeded. Transferred $${totalTransferred.toFixed(2)} from a $${INITIAL_BALANCE.toFixed(2)} balance. Overdraft: $${(totalTransferred - INITIAL_BALANCE).toFixed(2)}`;
    showExplanation(successCount, totalTransferred);
  } else {
    raceResult.className = 'result-box safe';
    raceResult.textContent = `Only 1 request succeeded. Try increasing concurrent requests or reducing transfer amount.`;
  }
});

resetBtn.addEventListener('click', () => {
  balance = INITIAL_BALANCE;
  updateBalance();
  raceLog.innerHTML = '';
  raceResult.classList.add('hidden');
  explanationBox.classList.add('hidden');
});

// VULNERABLE transfer: read balance, then "process" (async delay), then deduct
// The delay simulates DB read → business logic → DB write window
async function vulnerableTransfer(amount, reqId) {
  const snapshotBalance = balance; // TOCTOU: check at this moment
  await sleep(Math.random() * 20); // simulate processing time — race window
  if (snapshotBalance >= amount) {
    balance -= amount; // deduct using stale snapshot check
    updateBalance();
    return { ok: true, snapshotBalance };
  }
  return { ok: false, snapshotBalance };
}

function updateBalance() {
  balanceDisplay.textContent = `$${balance.toFixed(2)}`;
  balanceDisplay.className = balance < 0 ? 'bal-amount overdraft' : balance === 0 ? 'bal-amount depleted' : 'bal-amount';
}

function appendLog(html) {
  const line = document.createElement('div');
  line.innerHTML = html;
  raceLog.appendChild(line);
  raceLog.scrollTop = raceLog.scrollHeight;
}

function showExplanation(count, total) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Race Condition (TOCTOU — Time of Check / Time of Use)</h3>
    <p>${count} concurrent requests all passed the balance check simultaneously (snapshot balance = $${INITIAL_BALANCE.toFixed(2)}), then each deducted — transferring $${total.toFixed(2)} total from a $${INITIAL_BALANCE.toFixed(2)} account.</p>
    <ul>
      <li><strong>Root cause:</strong> Non-atomic check-then-act. The balance is read, a decision is made, and the update happens later — allowing multiple requests to race through the check before any deduction is applied.</li>
      <li><strong>Real examples:</strong> Gift card double-spending, coupon reuse, withdrawal overdrafts, loyalty point manipulation.</li>
      <li><strong>Fix:</strong> Use atomic database operations: <code>UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?</code> — check and deduct in one atomic statement. Or use pessimistic locking (<code>SELECT FOR UPDATE</code>) to serialize access per account.</li>
    </ul>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
