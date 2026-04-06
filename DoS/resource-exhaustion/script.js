// VULNERABLE BY DESIGN — Educational purposes only
// Simulates resource exhaustion: no input size limit allows a massive payload
// to consume all available CPU time, blocking the JS thread (simulating server freeze).

const MAX_SAFE_WORDS = 10000;

function processDocument(text) {
  // Simulate server-side processing: word frequency count
  const words = text.split(/\s+/).filter(Boolean);
  const freq  = {};
  for (const w of words) {
    const key = w.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key) freq[key] = (freq[key] || 0) + 1;
  }
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { wordCount: words.length, uniqueWords: Object.keys(freq).length, topWords: sorted };
}

function renderStats(stats, elapsed, input) {
  const statsBox  = document.getElementById("statsBox");
  const terminal  = document.getElementById("terminal");
  const termOut   = document.getElementById("terminalOutput");
  const explanation = document.getElementById("explanationBox");

  const sizeKb    = (new Blob([input]).size / 1024).toFixed(1);
  const isHuge    = stats.wordCount > MAX_SAFE_WORDS;

  statsBox.classList.remove("hidden");
  statsBox.innerHTML =
    `<span class="${isHuge ? "warn" : "ok"}">Input size: ${sizeKb} KB — ${stats.wordCount.toLocaleString()} words</span>\n` +
    `Unique words:  ${stats.uniqueWords.toLocaleString()}\n` +
    `Processing time: ${elapsed.toFixed(1)} ms\n` +
    `Top words: ${stats.topWords.map(([w, c]) => `${w}(${c})`).join(", ") || "(none)"}\n` +
    (isHuge ? `\n<span class="warn">⚠ SERVER OVERLOADED — no size limit means any user can trigger this.</span>` : "");

  terminal.style.display = "block";
  termOut.textContent =
    `[POST /api/process] body_size=${sizeKb}KB words=${stats.wordCount.toLocaleString()}\n` +
    `Processing... ${elapsed.toFixed(1)}ms elapsed\n` +
    (isHuge
      ? `WARN: request consumed ${elapsed.toFixed(0)}ms of CPU — event loop blocked.\n       Other requests queued behind this one are timing out.\n`
      : `OK: processed in ${elapsed.toFixed(1)}ms\n`);

  explanation.classList.remove("hidden");

  if (isHuge) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>The server spent <strong>${elapsed.toFixed(0)}ms</strong> processing a ${sizeKb}KB payload. With no size limit, an attacker can flood the server with huge inputs and deny service to all other users.</p>
      <ul>
        <li>Resource exhaustion DoS doesn't require special payloads — just volume or size.</li>
        <li>A single-threaded server (Node.js) is fully blocked while processing — all other requests wait.</li>
        <li>Targets: JSON parsing, XML processing, image resizing, search indexing, PDF generation.</li>
        <li>No special privileges needed — any unauthenticated endpoint is a target.</li>
        <li>The fix: enforce <code>Content-Length</code> limits, stream-parse large inputs, use worker threads for CPU-heavy tasks, and rate-limit by IP.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Normal document — processed quickly.</h3>
      <p>Click <strong>Inject 500 000-word Payload</strong> to simulate a resource exhaustion attack and observe the processing time spike.</p>`;
  }
}

document.getElementById("submitForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const text  = document.getElementById("docInput").value;
  const start = performance.now();
  const stats = processDocument(text);
  renderStats(stats, performance.now() - start, text);
});

document.getElementById("bombBtn").addEventListener("click", function () {
  // Generate a 500k-word bomb
  const word    = "securecorp ";
  const payload = word.repeat(500000);
  document.getElementById("docInput").value = payload.slice(0, 200) + "... [500,000 words total]";

  const start = performance.now();
  const stats = processDocument(payload);
  renderStats(stats, performance.now() - start, payload);
});
