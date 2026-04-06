// Simulated Node.js server state
let serverProto = {}; // represents Object.prototype on the server
let isAdmin = false;

const bodyInput    = document.getElementById('bodyInput');
const sendBtn      = document.getElementById('sendBtn');
const responseBox  = document.getElementById('responseBox');
const responseBar  = document.getElementById('responseBar');
const responseBody = document.getElementById('responseBody');
const probeBtn     = document.getElementById('probeBtn');
const probeResult  = document.getElementById('probeResult');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { bodyInput.value = h.dataset.body; });
});

sendBtn.addEventListener('click', () => {
  let body;
  try { body = JSON.parse(bodyInput.value); }
  catch { showResponse(400, { error: 'Invalid JSON' }); return; }

  // Vulnerable server-side merge
  const userSettings = { theme: 'light', notifications: true };
  serverMerge(userSettings, body);

  showResponse(200, { success: true, settings: userSettings });

  // Check if prototype was polluted
  const freshObj = Object.create(null); // simulate a new server-side object
  // In real Node.js, serverProto represents Object.prototype state
  if (serverProto.isAdmin !== undefined || serverProto.shell !== undefined) {
    showExplanation();
  }
});

probeBtn.addEventListener('click', () => {
  probeResult.classList.remove('hidden');
  // A fresh request creates a new object — check for prototype properties
  const polluted = Object.keys(serverProto).filter(k => !['constructor'].includes(k));
  if (polluted.length > 0) {
    isAdmin = serverProto.isAdmin === true || serverProto.isAdmin === 'true';
    probeResult.className = 'result-msg error';
    probeResult.textContent = `GET /api/whoami → { id: 101, email: "alice@securecorp.com", role: "user", isAdmin: ${isAdmin} }\n\nPolluted prototype keys: ${polluted.map(k => k + '=' + serverProto[k]).join(', ')}\n${isAdmin ? '⚠ isAdmin inherited from Object.prototype — privilege escalation achieved!' : ''}`;
    showExplanation();
  } else {
    probeResult.className = 'result-msg';
    probeResult.textContent = `GET /api/whoami → { id: 101, email: "alice@securecorp.com", role: "user", isAdmin: false }\n\nNo prototype pollution detected. Send a polluting body first.`;
  }
});

function serverMerge(target, source) {
  // VULNERABLE: does not block __proto__ or constructor keys
  for (const key of Object.keys(source)) {
    if (key === '__proto__') {
      // Simulate actual prototype pollution on our serverProto tracker
      for (const k of Object.keys(source[key])) {
        serverProto[k] = source[key][k];
        Object.prototype[k] = source[key][k]; // actually pollute for demo
      }
    } else if (key === 'constructor' && source[key].prototype) {
      for (const k of Object.keys(source[key].prototype)) {
        serverProto[k] = source[key].prototype[k];
        Object.prototype[k] = source[key].prototype[k];
      }
    } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      serverMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function showResponse(status, data) {
  responseBox.classList.remove('hidden');
  const cls = status < 300 ? 'status-ok' : 'status-err';
  const label = status === 200 ? '200 OK' : '400 Bad Request';
  responseBar.innerHTML = `<span>PATCH /api/user/settings</span><span class="${cls}">${label}</span>`;
  responseBody.textContent = JSON.stringify(data, null, 2);
}

function showExplanation() {
  explanationBox.classList.remove('hidden');
  const shellGadget = serverProto.shell !== undefined;
  explanationBox.innerHTML = `
    <h3>Server-Side Prototype Pollution</h3>
    <p>The <code>PATCH /api/user/settings</code> endpoint used a vulnerable recursive merge on the request body. The <code>__proto__</code> key bypassed the normal property assignment and modified <code>Object.prototype</code> on the Node.js process — persisting across all subsequent requests.</p>
    <ul>
      <li><strong>Persistence:</strong> Unlike client-side pollution which is isolated per browser tab, server-side pollution affects the entire Node.js process — all users' requests processed after the attack are affected.</li>
      ${shellGadget ? '<li><strong>RCE gadget:</strong> Properties like <code>shell</code> and <code>NODE_OPTIONS</code> are read by child_process and other Node.js internals — pollution can lead to Remote Code Execution via template engines (Pug, EJS, Handlebars) or spawn gadgets.</li>' : ''}
      <li><strong>Detection:</strong> Use <code>--frozen-intrinsics</code> Node.js flag, or periodically audit <code>Object.prototype</code> keys in production.</li>
      <li><strong>Fix:</strong> Freeze <code>Object.prototype</code> with <code>Object.freeze(Object.prototype)</code> at startup. Sanitize merge functions to reject <code>__proto__</code>, <code>constructor</code>, <code>prototype</code> keys. Use <code>JSON.parse(JSON.stringify(body))</code> — does not transfer prototype chains.</li>
    </ul>`;
}
