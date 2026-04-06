const payloadUrlInput = document.getElementById('payloadUrl');
const displayLabelInput = document.getElementById('displayLabel');
const generateBtn = document.getElementById('generateBtn');
const scanBtn     = document.getElementById('scanBtn');
const signLabel   = document.getElementById('signLabel');
const qrCanvas    = document.getElementById('qrCanvas');
const decodedUrl  = document.getElementById('decodedUrl');
const victimResult= document.getElementById('victimResult');
const explanationBox = document.getElementById('explanationBox');

let currentPayload = '';

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => {
    payloadUrlInput.value  = h.dataset.url;
    displayLabelInput.value = h.dataset.label;
  });
});

generateBtn.addEventListener('click', () => {
  currentPayload = payloadUrlInput.value.trim();
  const label    = displayLabelInput.value.trim();
  if (!currentPayload) return;

  // Update display
  signLabel.textContent = label || currentPayload;
  renderQR(currentPayload);
  decodedUrl.textContent = currentPayload;

  const isMalicious = isMaliciousUrl(currentPayload);
  decodedUrl.style.color = isMalicious ? '#fca5a5' : '#b5e8a0';
  victimResult.classList.add('hidden');

  showExplanation('generate', currentPayload, label);
});

scanBtn.addEventListener('click', () => {
  if (!currentPayload) { alert('Generate a QR code first.'); return; }
  victimResult.classList.remove('hidden');
  const isMalicious = isMaliciousUrl(currentPayload);
  victimResult.className = isMalicious ? 'result-msg error' : 'result-msg';
  victimResult.textContent = isMalicious
    ? `Victim scanned QR. Browser navigated to:\n${currentPayload}\n\nThis is a malicious destination! The victim saw "${displayLabelInput.value}" on the sign — they had no way to know the actual URL without decoding the QR code first.`
    : `Victim navigated to: ${currentPayload}\n(URL appears legitimate in this simulation)`;
  if (isMalicious) showExplanation('scan', currentPayload);
});

function isMaliciousUrl(url) {
  return url.includes('evil') || url.includes('javascript:') || url.includes('bit.ly') ||
    url.includes('evil.com') || url.includes('phish') || url.includes('onerror') ||
    (url.includes('.com.') && !url.startsWith('https://securecorp.com'));
}

// Minimal QR-like visualization (not a real QR encoder — just visual representation)
function renderQR(data) {
  const size = 13;
  const cells = [];
  // Deterministic "pattern" based on data hash
  let seed = 0;
  for (let i = 0; i < data.length; i++) seed = (seed * 31 + data.charCodeAt(i)) >>> 0;
  function rng() { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; return (seed >>> 0) / 0xFFFFFFFF; }

  for (let r = 0; r < size; r++) {
    cells.push([]);
    for (let c = 0; c < size; c++) {
      // Fixed finder patterns (top-left, top-right, bottom-left corners)
      const inFinder = (r < 3 && c < 3) || (r < 3 && c >= size-3) || (r >= size-3 && c < 3);
      const borderFinder = (r <= 3 && c <= 3) || (r <= 3 && c >= size-4) || (r >= size-4 && c <= 3);
      let dark;
      if (inFinder) dark = (r === 0 || r === 2 || c === 0 || c === 2 || (r===1&&c===1));
      else if (borderFinder) dark = false;
      else dark = rng() > 0.5;
      cells[r].push(dark);
    }
  }

  const cellSize = Math.floor(120 / size);
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${size},${cellSize}px);gap:0;background:#fff;padding:6px;border-radius:4px;width:fit-content;margin:0 auto`;
  cells.forEach(row => {
    row.forEach(dark => {
      const cell = document.createElement('div');
      cell.style.cssText = `width:${cellSize}px;height:${cellSize}px;background:${dark ? '#000' : '#fff'}`;
      grid.appendChild(cell);
    });
  });
  qrCanvas.innerHTML = '';
  qrCanvas.appendChild(grid);
}

function showExplanation(type, url, label) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>QRishing — Malicious QR Code Attack</h3>
    <p>${type === 'scan'
      ? `The victim scanned a QR code labeled <em>"${escHtml(label || displayLabelInput.value)}"</em> and was redirected to <code>${escHtml(url)}</code> — without any visual warning.`
      : `A QR code was generated for <code>${escHtml(url)}</code> but displayed as <em>"${escHtml(label || url)}"</em>. Humans cannot read QR codes — the visual label is completely disconnected from the encoded URL.`}</p>
    <ul>
      <li><strong>Physical attack:</strong> Attackers print malicious QR stickers and place them over legitimate QR codes in public spaces — parking meters, menus, posters, package delivery notifications.</li>
      <li><strong>No URL preview:</strong> Unlike hyperlinks, QR codes give no visual indication of the destination before scanning. Most QR scanner apps do not warn users about malicious URLs.</li>
      <li><strong>Common payloads:</strong> Phishing login pages, cookie-stealing scripts, OAuth consent screen spoofs, malware downloads.</li>
      <li><strong>Defense:</strong> Use a QR scanner that previews the URL before opening. Always verify QR codes on payment terminals physically match the expected vendor. Be skeptical of QR codes in unexpected locations or on physical stickers that appear added on top of printed material.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
