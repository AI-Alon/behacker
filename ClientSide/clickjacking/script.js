// VULNERABLE BY DESIGN — Educational purposes only
// Simulates clickjacking: a transparent iframe containing a dangerous action
// is overlaid on a decoy page. The victim thinks they click a harmless button
// but actually triggers the hidden action underneath.

const revealToggle = document.getElementById("revealToggle");
const targetFrame  = document.getElementById("targetFrame");
const deleteBtn    = document.getElementById("deleteBtn");
const clickResult  = document.getElementById("clickResult");
const explanation  = document.getElementById("explanationBox");

// Toggle overlay visibility
revealToggle.addEventListener("change", function () {
  if (this.checked) {
    targetFrame.classList.add("revealed");
  } else {
    targetFrame.classList.remove("revealed");
  }
});

// The hidden "Delete Account" button — what the victim actually clicks
deleteBtn.addEventListener("click", function () {
  clickResult.classList.remove("hidden");
  clickResult.textContent =
    "Account deleted! POST /api/account/delete was triggered.\n" +
    "The victim thought they clicked \"Claim Prize\" — they actually clicked \"Delete Account\".";

  explanation.classList.remove("hidden");
  explanation.innerHTML = `
    <h3>What happened?</h3>
    <p>The victim clicked the "Claim Prize" button on the decoy page — but the transparent iframe was positioned so the real "Delete Account" button sat directly underneath it.</p>
    <ul>
      <li>The target page has no <code>X-Frame-Options</code> or <code>Content-Security-Policy: frame-ancestors</code> header, so it can be embedded in any iframe.</li>
      <li>The iframe is made invisible with <code>opacity: 0</code> but <code>pointer-events: all</code> — clicks pass through to the hidden frame.</li>
      <li>The attacker aligns the dangerous button precisely under an appealing decoy element.</li>
      <li>Toggle "Reveal iframe overlay" above to see the two layers simultaneously.</li>
    </ul>
    <p style="margin-top:10px;">The fix: add <code>X-Frame-Options: DENY</code> (or <code>SAMEORIGIN</code>) to HTTP response headers, or use <code>Content-Security-Policy: frame-ancestors 'none'</code>. This prevents other sites from embedding your pages in iframes.</p>`;
});

// Clicking the decoy button without hitting the hidden iframe area
document.querySelector(".decoy-btn").addEventListener("click", function (e) {
  // Only fires if targetFrame is revealed (pointer-events go to iframe otherwise)
  if (revealToggle.checked) return; // in revealed mode, click goes to iframe
  clickResult.classList.remove("hidden");
  clickResult.textContent = "You clicked the decoy button directly (iframe not aligned here). Try clicking it without revealing the overlay.";
});
