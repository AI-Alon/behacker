// Simulated MD5 hash table (pre-computed, educational)
const HASH_DB = [
  { user: 'admin',   hash: '21232f297a57a5a743894a0e4a801fc3', plain: 'admin' },
  { user: 'alice',   hash: '7215ee9c7d9dc229d2921a40e899ec5f', plain: 'password' },
  { user: 'bob',     hash: '5f4dcc3b5aa765d61d8327deb882cf99', plain: 'password' },
  { user: 'carol',   hash: 'e10adc3949ba59abbe56e057f20f883e', plain: '123456' },
  { user: 'david',   hash: '25f9e794323b453885f5181f1b624d0b', plain: '123456789' },
  { user: 'eve',     hash: '827ccb0eea8a706c4c34a16891f84e7b', plain: '12345' },
  { user: 'frank',   hash: 'fcea920f7412b5da7be0cf42b8c93759', plain: 'hello' },
  { user: 'grace',   hash: 'd8578edf8458ce06fbc5bb76a58c5ca4', plain: 'qwerty' },
];

// Rainbow table (hash → plain) — simulated offline crack
const RAINBOW = Object.fromEntries(HASH_DB.map(r => [r.hash, r.plain]));

// Additional wordlist entries (common passwords)
const WORDLIST = ['password','123456','admin','qwerty','letmein','welcome','monkey','dragon','pass','test','1234','abc123','iloveyou','sunshine','master','hello','123456789','12345','password1','trustno1'];

let crackedSet = new Set();

const hashInput      = document.getElementById('hashInput');
const crackBtn       = document.getElementById('crackBtn');
const terminal       = document.getElementById('terminal');
const terminalOutput = document.getElementById('terminalOutput');
const explanationBox = document.getElementById('explanationBox');
const hashTable      = document.getElementById('hashTable');

// Build hash table rows on page load
HASH_DB.forEach(entry => {
  const row = document.createElement('div');
  row.className = 'hash-row';
  row.dataset.hash = entry.hash;
  row.innerHTML = `<span class="col-user">${entry.user}</span><span class="col-hash">${entry.hash}</span><span class="col-status">—</span>`;
  hashTable.appendChild(row);
});

const hashRows = document.querySelectorAll('.hash-row');

// Simple MD5 (browser-native via SubtleCrypto not available for MD5, so we use a lookup)
// For demo: md5-like simulation using known hashes
const KNOWN_MD5 = Object.fromEntries(HASH_DB.map(r => [r.plain, r.hash]));

// Also build a wordlist hash lookup for wordlist crack simulation
function fakeMD5(s) {
  // Return known hash or deterministic fake
  if (KNOWN_MD5[s]) return KNOWN_MD5[s];
  // Deterministic but fake for unknown
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(32, '0');
}

hashRows.forEach(row => {
  row.addEventListener('click', () => {
    hashInput.value = row.dataset.hash;
  });
});

crackBtn.addEventListener('click', async () => {
  const target = hashInput.value.trim().toLowerCase();
  if (!target) return;
  terminal.style.display = 'block';
  terminalOutput.textContent = '';

  appendTerm(`[*] Target hash: ${target}`);
  appendTerm(`[*] Algorithm: MD5`);
  appendTerm(`[*] Checking rainbow table...`);
  await sleep(300);

  if (RAINBOW[target]) {
    appendTerm(`[+] Rainbow table HIT: "${target}" → "${RAINBOW[target]}"`);
    markCracked(target, RAINBOW[target]);
    showExplanation('rainbow', RAINBOW[target]);
    return;
  }
  appendTerm(`[-] Not in rainbow table. Starting wordlist attack...`);
  await sleep(200);

  for (let i = 0; i < WORDLIST.length; i++) {
    const w = WORDLIST[i];
    const h = fakeMD5(w);
    appendTerm(`[.] Trying "${w}" → ${h.substring(0,16)}...`);
    await sleep(30);
    if (h === target) {
      appendTerm(`\n[+] CRACKED: "${target}" → "${w}"`);
      markCracked(target, w);
      showExplanation('wordlist', w);
      return;
    }
  }
  appendTerm(`\n[-] Not found in wordlist (${WORDLIST.length} words tried).`);
  appendTerm(`[!] Try a larger wordlist (rockyou.txt has 14M entries).`);
});


function markCracked(hash, plain) {
  crackedSet.add(hash);
  markCrackedByHash(hash);
}

function markCrackedByHash(hash) {
  hashRows.forEach(row => {
    if (row.dataset.hash === hash) {
      row.classList.add('cracked');
      const badge = row.querySelector('.col-status');
      if (badge) { badge.textContent = 'CRACKED'; badge.className = 'col-status cracked-badge'; }
    }
  });
}

function showExplanation(type, plain) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Weak Password Hashing (MD5 / SHA-1 without salt)</h3>
    <p>${type === 'rainbow' ? `The password <strong>"${plain}"</strong> was found instantly in a pre-computed rainbow table — no cracking required.` : type === 'wordlist' ? `The password <strong>"${plain}"</strong> matched a common wordlist entry in under a second.` : `All ${crackedSet.size} hashes were cracked in seconds using a rainbow table.`}</p>
    <ul>
      <li><strong>Why MD5 fails:</strong> MD5 and SHA-1 are fast by design — a GPU can compute <em>billions</em> per second, making brute-force trivial.</li>
      <li><strong>Rainbow tables:</strong> Pre-computed hash→plain lookups cover billions of common passwords. No cracking time needed.</li>
      <li><strong>Fix:</strong> Use <code>bcrypt</code>, <code>scrypt</code>, or <code>argon2id</code> — slow by design (100ms+ per hash), with a unique per-password salt. These cannot be rainbow-tabled.</li>
      <li><strong>Never use:</strong> <code>MD5</code>, <code>SHA-1</code>, <code>SHA-256</code> or any fast hash for passwords — even with a salt, they remain GPU-attackable.</li>
    </ul>`;
}

function appendTerm(line) {
  terminalOutput.textContent += line + '\n';
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
