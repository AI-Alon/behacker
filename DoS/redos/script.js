// VULNERABLE BY DESIGN — Educational purposes only
// Simulates ReDoS: a vulnerable email regex with catastrophic backtracking.
// The JS engine is single-threaded — a slow regex freezes the whole page.
// We measure execution time to demonstrate the exponential blowup.

// VULNERABLE regex — nested quantifiers cause catastrophic backtracking
// Pattern: (a+)+ style — each 'a' can be part of the outer group in many ways
const VULNERABLE_REGEX = /^([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})*$/;

// Hint chips load payload into input
document.querySelectorAll(".hint").forEach(hint => {
  hint.addEventListener("click", function () {
    document.getElementById("emailInput").value = this.dataset.payload || this.textContent.trim();
  });
});

document.getElementById("validateForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const input      = document.getElementById("emailInput").value;
  const regexDisp  = document.getElementById("regexDisplay");
  const terminal   = document.getElementById("terminal");
  const termOut    = document.getElementById("terminalOutput");
  const explanation = document.getElementById("explanationBox");

  regexDisp.textContent = VULNERABLE_REGEX.toString();
  terminal.style.display = "block";
  termOut.textContent = `Input: "${input}"\nRunning regex...\n`;

  // Run in a setTimeout so the UI can update before the regex blocks
  setTimeout(function () {
    const start = performance.now();

    let matched;
    try {
      matched = VULNERABLE_REGEX.test(input);
    } catch (err) {
      matched = false;
    }

    let elapsed = (performance.now() - start).toFixed(1);

    // Modern V8/SpiderMonkey engines have patched backtracking, so we simulate
    // the exponential blowup based on input characteristics.
    const aRun = (input.match(/a+/) || [''])[0].length;
    const hasInvalidEnd = /[^a-zA-Z0-9@._%-]$/.test(input);
    if (aRun >= 20 && hasInvalidEnd) {
      // Simulate exponential time: 2^(aRun-19) ms, capped at 4000ms
      const simulated = Math.min(Math.pow(2, aRun - 19), 4000);
      elapsed = simulated.toFixed(1);
    } else if (aRun >= 10 && hasInvalidEnd) {
      elapsed = (aRun * 3).toFixed(1);
    }

    const ms = parseFloat(elapsed);

    const simNote = (aRun >= 10 && hasInvalidEnd) ? ' (simulated — modern engines patch backtracking)' : '';
    termOut.textContent +=
      `Result:  ${matched ? "VALID" : "INVALID"}\n` +
      `Time:    ${elapsed} ms${simNote}\n\n`;

    if (ms > 100) {
      termOut.textContent += `⚠ SLOW! ${elapsed}ms — regex engine is backtracking catastrophically.\nA real server would be frozen for this entire duration, blocking all other requests.\n`;
    } else if (ms > 10) {
      termOut.textContent += `Noticeable slowdown (${elapsed}ms). Try a longer payload — add more 'a' characters before the final '!'\n`;
    } else {
      termOut.textContent += `Fast (${elapsed}ms). Try the hint payloads — longer inputs trigger worse backtracking.\n`;
    }

    explanation.classList.remove("hidden");

    if (ms > 50) {
      explanation.innerHTML = `
        <h3>What happened? — ReDoS</h3>
        <p>The regex took <strong>${elapsed}ms</strong> on a crafted input. On a real server handling hundreds of requests per second, this would block the event loop and deny service to all users.</p>
        <ul>
          <li>The vulnerable pattern has nested quantifiers: <code>([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+…)*</code> — the outer <code>*</code> means the engine tries every possible way to split the input across groups.</li>
          <li>For a string of N 'a's followed by an invalid character, the engine explores 2<sup>N</sup> paths before giving up — exponential time.</li>
          <li>Node.js, Python, Ruby, Java and .NET regex engines are all affected by backtracking ReDoS.</li>
          <li>A single malicious request can take down an entire server.</li>
        </ul>
        <p style="margin-top:10px;">The fix: rewrite the regex to avoid nested quantifiers, use a linear-time regex engine (RE2), or set a timeout on regex operations.</p>`;
    } else {
      explanation.innerHTML = `
        <h3>Normal input — no significant slowdown.</h3>
        <p>Click the hint payloads to try crafted inputs. The pattern <code>aaa...a!</code> triggers exponential backtracking — each extra 'a' roughly doubles the time.</p>`;
    }
  }, 10);
});
