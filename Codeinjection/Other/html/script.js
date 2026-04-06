// VULNERABLE BY DESIGN — Educational purposes only
// Simulates HTML injection: user input is set via innerHTML without sanitisation.

const INJECTION_PATTERNS = [
  /<img\b/i,
  /<script\b/i,
  /<iframe\b/i,
  /<a\b/i,
  /<form\b/i,
  /<input\b/i,
  /<style\b/i,
  /<svg\b/i,
  /<marquee\b/i,
  /<h[1-6]\b/i,
  /<p\b/i,
  /<div\b/i,
];

function detectInjection(str) {
  return INJECTION_PATTERNS.some(p => p.test(str));
}

document.getElementById("commentForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name    = document.getElementById("nameInput").value;
  const comment = document.getElementById("commentInput").value;

  // ── Vulnerable: concatenates raw input into HTML string ──────────────────
  const html = `<div class="comment-entry">
  <span class="comment-author">${name}</span>
  <p class="comment-text">${comment}</p>
</div>`;

  const outputBox      = document.getElementById("outputBox");
  const rawDisplay     = document.getElementById("rawDisplay");
  const explanationBox = document.getElementById("explanationBox");

  // Show raw string
  rawDisplay.textContent = html;

  // VULNERABLE: render via innerHTML — injected tags execute
  outputBox.innerHTML = html;

  // Detect and explain
  const injected = detectInjection(name) || detectInjection(comment);
  explanationBox.classList.remove("hidden");

  if (injected) {
    explanationBox.innerHTML = `
      <h3>What happened?</h3>
      <p>Your input contained HTML tags that were rendered directly by the browser.</p>
      <ul>
        <li>The app used <code>innerHTML</code> to write your input into the page.</li>
        <li>Any HTML tags in your input are treated as real markup — not as text.</li>
        <li>An attacker can inject links, images, forms, iframes, or phishing content.</li>
        <li>With <code>&lt;script&gt;</code> tags this escalates to XSS — arbitrary JavaScript execution.</li>
        <li>The fix: use <code>textContent</code> or escape <code>&lt;</code> → <code>&amp;lt;</code> before inserting.</li>
      </ul>`;
  } else {
    explanationBox.innerHTML = `
      <h3>Normal input — no HTML tags detected.</h3>
      <p>Try these payloads in the Name or Comment field:</p>
      <ul>
        <li><code>&lt;h1&gt;Injected Heading&lt;/h1&gt;</code> — injects a heading element</li>
        <li><code>&lt;img src=x onerror="alert('XSS')"&gt;</code> — broken image triggers JS</li>
        <li><code>&lt;a href="https://evil.com"&gt;Click here to claim your prize&lt;/a&gt;</code> — phishing link</li>
        <li><code>&lt;marquee&gt;defaced&lt;/marquee&gt;</code> — moving text, page defacement</li>
        <li><code>&lt;iframe src="https://example.com"&gt;&lt;/iframe&gt;</code> — embeds another page</li>
      </ul>`;
  }
});
