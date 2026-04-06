// VULNERABLE BY DESIGN — Educational purposes only
// Simulates stored XSS: user input is saved and rendered via innerHTML on every page load.

const STORAGE_KEY = "xss_stored_messages";

function loadMessages() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveMessages(messages) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function renderBoard() {
  const messages  = loadMessages();
  const boardOutput = document.getElementById("boardOutput");
  const rawDisplay  = document.getElementById("rawDisplay");

  if (messages.length === 0) {
    boardOutput.innerHTML = '<span class="board-empty">No messages yet — be the first to post.</span>';
    rawDisplay.textContent = "(empty)";
    return;
  }

  // ── Vulnerable: stored HTML is rendered directly via innerHTML ────────────
  const html = messages
    .map(m => `<div class="message-entry">
  <span class="message-author">${m.name}</span>
  <p class="message-text">${m.message}</p>
</div>`)
    .join("\n");

  rawDisplay.textContent = html;

  // VULNERABLE: persisted user content injected via innerHTML on every load
  boardOutput.innerHTML = html;
}

document.getElementById("postForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name    = document.getElementById("nameInput").value.trim();
  const message = document.getElementById("messageInput").value.trim();
  const explanation = document.getElementById("explanationBox");

  if (!name && !message) return;

  const messages = loadMessages();
  messages.push({ name, message });
  saveMessages(messages);

  document.getElementById("nameInput").value    = "";
  document.getElementById("messageInput").value = "";

  renderBoard();

  explanation.classList.remove("hidden");

  const isInjected = /<|>|script|onerror|onload|svg|img|iframe/i.test(name + message);

  if (isInjected) {
    explanation.innerHTML = `
      <h3>What happened?</h3>
      <p>Your payload was saved to storage and will execute for <em>every</em> visitor who loads this page.</p>
      <ul>
        <li>Unlike reflected XSS, the payload is stored server-side (here: <code>localStorage</code>) and served to all users.</li>
        <li>Every time the page loads, the stored HTML is inserted via <code>innerHTML</code> — triggering any script inside.</li>
        <li>Stored XSS is far more dangerous: no crafted URL needed, the victim just visits the normal page.</li>
        <li>Common targets: comment sections, profile bios, product reviews, support tickets.</li>
        <li>The fix: sanitise on input and escape on output. Use a library like DOMPurify before inserting HTML.</li>
      </ul>`;
  } else {
    explanation.innerHTML = `
      <h3>Message posted — no injection detected.</h3>
      <p>Try these payloads in the Name or Message field:</p>
      <ul>
        <li><code>&lt;img src=x onerror="alert('Stored XSS')"&gt;</code> — fires on every page load</li>
        <li><code>&lt;script&gt;alert('XSS')&lt;/script&gt;</code> — script tag stored and replayed</li>
        <li><code>&lt;svg onload="alert(document.cookie)"&gt;</code> — leaks cookies to any visitor</li>
        <li><code>&lt;b style="color:red"&gt;page defaced&lt;/b&gt;</code> — content injection visible to all</li>
        <li>Reload the page after posting — the payload fires again automatically.</li>
      </ul>`;
  }
});

// Render stored messages on every page load (this is what makes it "stored" XSS)
renderBoard();
