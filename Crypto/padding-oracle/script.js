// AES-CBC Padding Oracle simulation
// Simulated 16-byte block cipher (educational, not real AES)
// Cookie format: base64(IV + ciphertext) where plaintext = "user=alice;role=user"

// We simulate blocks as hex strings for display purposes
const BLOCK_SIZE = 16;

// Simulated "encrypted" session cookie (2 blocks: IV + 1 ciphertext block)
// Plaintext (padded): "user=alice;role=u" (block 1), "ser;role=user\x03\x03\x03" conceptually
// We represent blocks as arrays of byte values for the simulation
let IV_BLOCK  = [0x5a, 0x3f, 0x1c, 0x7e, 0x9b, 0x2d, 0x4a, 0x6f, 0x8c, 0x0e, 0x3b, 0x5d, 0x7a, 0x9c, 0x1e, 0x4f];
let CT_BLOCK  = [0xd4, 0x8f, 0x3a, 0x2c, 0x6e, 0xb5, 0x1d, 0x9f, 0x4a, 0x7c, 0x2e, 0x8b, 0x5f, 0x3d, 0x9a, 0x1c];
// Known decrypted block (for oracle simulation): "user=alice;role=u"
const KNOWN_PLAIN = [0x75,0x73,0x65,0x72,0x3d,0x61,0x6c,0x69,0x63,0x65,0x3b,0x72,0x6f,0x6c,0x65,0x3d];

const oracleLog     = document.getElementById('oracleLog');
const responseBox   = document.getElementById('responseBox');
const byteGrid      = document.getElementById('byteGrid');
const decryptBtn    = document.getElementById('decryptBtn');
const forgeBtn      = document.getElementById('forgeBtn');
const explanationBox= document.getElementById('explanationBox');

let modifiedIV = [...IV_BLOCK];
let flippedBytes = new Set();
let forgedResult = null;

// Build byte grid (IV block, separator, CT block)
function buildGrid() {
  byteGrid.innerHTML = '';
  modifiedIV.forEach((b, i) => {
    const cell = document.createElement('div');
    cell.className = `byte-cell iv-cell${flippedBytes.has(i) ? ' flipped' : ''}`;
    cell.textContent = b.toString(16).padStart(2,'0');
    cell.title = `IV byte [${i}]`;
    cell.addEventListener('click', () => flipByte(i));
    byteGrid.appendChild(cell);
  });
  // Separator
  const sep = document.createElement('div');
  sep.className = 'byte-cell separator';
  byteGrid.appendChild(sep);
  CT_BLOCK.forEach((b, i) => {
    const cell = document.createElement('div');
    cell.className = 'byte-cell';
    cell.textContent = b.toString(16).padStart(2,'0');
    cell.title = `CT byte [${i}] (read-only)`;
    byteGrid.appendChild(cell);
  });
}

function flipByte(idx) {
  if (flippedBytes.has(idx)) {
    modifiedIV[idx] = IV_BLOCK[idx];
    flippedBytes.delete(idx);
  } else {
    modifiedIV[idx] = modifiedIV[idx] ^ 0xff; // XOR with 0xff to flip all bits
    flippedBytes.add(idx);
  }
  buildGrid();
  sendProbe(modifiedIV, CT_BLOCK, false);
}

// Oracle: returns true if decrypted bytes have valid PKCS#7 padding
function paddingOracle(iv, ct) {
  // XOR ct with internal key (simulated): decrypted = XOR(ct, KEY) ^ IV
  // We simulate: intermediate = KNOWN_PLAIN XOR IV_BLOCK, so
  // decrypted[i] = KNOWN_PLAIN[i] XOR IV_BLOCK[i] XOR iv[i]
  const decrypted = ct.map((_, i) => KNOWN_PLAIN[i] ^ IV_BLOCK[i] ^ iv[i]);
  // Check PKCS#7 padding
  const lastByte = decrypted[BLOCK_SIZE - 1];
  if (lastByte < 1 || lastByte > BLOCK_SIZE) return false;
  for (let i = BLOCK_SIZE - lastByte; i < BLOCK_SIZE; i++) {
    if (decrypted[i] !== lastByte) return false;
  }
  return true;
}

function decryptedText(iv) {
  return iv.map((_, i) => KNOWN_PLAIN[i] ^ IV_BLOCK[i] ^ iv[i]);
}

function sendProbe(iv, ct, autoFull) {
  const valid = paddingOracle(iv, ct);
  const decBytes = decryptedText(iv);
  const text = String.fromCharCode(...decBytes.map(b => b >= 32 && b < 127 ? b : 0x2e));

  responseBox.className = `response-box ${valid ? 'ok' : 'err'}`;
  responseBox.textContent = valid
    ? `200 OK — Valid padding detected!\nDecrypted: "${text}"`
    : `500 Internal Server Error — Invalid padding`;

  const changed = [...flippedBytes];
  appendLog(`<span class="${valid ? 'log-ok' : 'log-err'}">[probe] IV[${changed.join(',')||'orig'}] → ${valid ? '✓ VALID padding' : '✗ Invalid padding'}</span>`);

  if (valid && autoFull) {
    appendLog(`<span class="log-found">[→] Valid padding! Decrypted block: "${text}"</span>`);
    showExplanation();
  }
}

decryptBtn.addEventListener('click', () => {
  sendProbe(modifiedIV, CT_BLOCK, true);
});

forgeBtn.addEventListener('click', async () => {
  // Auto-forge: target plaintext "user=admin;role=a"
  const target = 'user=admin;role=a';
  const targetBytes = target.split('').map(c => c.charCodeAt(0));

  appendLog(`<span class="log-info">[*] Auto-forging: target = "${target}"</span>`);
  await sleep(300);

  // For each byte position, compute the IV byte that will produce the target plaintext
  // decrypted[i] = KNOWN_PLAIN[i] XOR IV_BLOCK[i] XOR new_iv[i]
  // we want decrypted[i] = targetBytes[i]
  // so: new_iv[i] = targetBytes[i] XOR KNOWN_PLAIN[i] XOR IV_BLOCK[i]
  const forgedIV = targetBytes.map((t, i) => t ^ KNOWN_PLAIN[i] ^ IV_BLOCK[i]);

  for (let i = 0; i < BLOCK_SIZE; i++) {
    modifiedIV[i] = forgedIV[i];
    flippedBytes.add(i);
    buildGrid();
    await sleep(60);
  }

  const valid = paddingOracle(forgedIV, CT_BLOCK);
  const decBytes = decryptedText(forgedIV);
  const decText  = String.fromCharCode(...decBytes.map(b => b >= 32 && b < 127 ? b : 0x2e));

  appendLog(`<span class="log-found">[+] Forged IV computed. Sending cookie...</span>`);
  await sleep(300);
  appendLog(`<span class="log-ok">[+] Server accepted! Decrypted as: "${decText}"</span>`);

  const forgedCookieVal = btoa(forgedIV.map(b=>String.fromCharCode(b)).join('') +
    CT_BLOCK.map(b=>String.fromCharCode(b)).join(''));
  responseBox.className = 'response-box ok';
  responseBox.textContent = `200 OK — Authenticated as: "${decText}"\nForged cookie: ${forgedCookieVal}`;
  showExplanation();
  buildGrid();
});


function appendLog(html) {
  const line = document.createElement('div');
  line.innerHTML = html;
  oracleLog.appendChild(line);
  oracleLog.scrollTop = oracleLog.scrollHeight;
}

function showExplanation() {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Padding Oracle Attack on AES-CBC</h3>
    <p>A padding oracle leaks whether decrypted ciphertext has valid PKCS#7 padding — a single bit of information that allows an attacker to decrypt any ciphertext block or forge arbitrary plaintext, <em>without knowing the key</em>.</p>
    <ul>
      <li><strong>Mechanism:</strong> XOR bits of the IV (or preceding ciphertext block) to flip bits in the decrypted output. When the oracle returns "valid padding", you've learned an intermediate byte value.</li>
      <li><strong>Forging:</strong> Once you know the intermediate values, you can compute an IV that decrypts to any chosen plaintext — e.g., changing <code>role=user</code> to <code>role=admin</code>.</li>
      <li><strong>Real examples:</strong> POODLE (SSL 3.0), Lucky13 (TLS), ASP.NET ViewState, Java crypto libraries.</li>
      <li><strong>Fix:</strong> Use authenticated encryption (AES-GCM or AES-CCM) which validates integrity <em>before</em> decryption — any tampering returns a MAC failure, not a padding error. Never use AES-CBC with a padding oracle.</li>
    </ul>`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Initialize
buildGrid();
responseBox.textContent = 'Click a byte in the IV block to flip it, then send a probe.';
