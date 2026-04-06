// Vulnerable deep merge utility
function vulnerableMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object') {
      if (!target[key]) target[key] = {};
      vulnerableMerge(target[key], source[key]); // recurses into __proto__!
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Vulnerable query string parser
function parseQuery(qs) {
  const params = {};
  if (!qs || !qs.startsWith('?')) return params;
  qs.slice(1).split('&').forEach(pair => {
    const [k, v] = pair.split('=').map(decodeURIComponent);
    setNested(params, k, v); // VULNERABLE: sets __proto__ keys
  });
  return params;
}

function setNested(obj, path, value) {
  // path like "__proto__[isAdmin]" or "a[b][c]"
  const parts = path.replace(/\[([^\]]+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const queryInput = document.getElementById('queryInput');
const parseBtn   = document.getElementById('parseBtn');
const jsonInput  = document.getElementById('jsonInput');
const mergeBtn   = document.getElementById('mergeBtn');
const protoState = document.getElementById('protoState');
const accessBtn  = document.getElementById('accessBtn');
const accessResult = document.getElementById('accessResult');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { queryInput.value = h.dataset.q; });
});

parseBtn.addEventListener('click', () => {
  const qs = queryInput.value.trim();
  const parsed = parseQuery(qs);
  renderProtoState();
  showExplanation('parse', qs);
});

mergeBtn.addEventListener('click', () => {
  let src;
  try { src = JSON.parse(jsonInput.value); }
  catch { alert('Invalid JSON'); return; }
  const userConfig = { theme: 'light' };
  vulnerableMerge(userConfig, src);
  renderProtoState();
  showExplanation('merge', JSON.stringify(src));
});

accessBtn.addEventListener('click', () => {
  const freshObj = {};  // new object — no own isAdmin property
  accessResult.classList.remove('hidden');
  if (freshObj.isAdmin === true || freshObj.isAdmin === 'true') {
    accessResult.className = 'result-msg error';
    accessResult.textContent = `Access GRANTED — Object.prototype.isAdmin = "${freshObj.isAdmin}" inherited by all objects. Admin panel unlocked!`;
    showExplanation('gadget');
  } else if (Object.prototype.role === 'admin') {
    accessResult.className = 'result-msg error';
    accessResult.textContent = `Access GRANTED via role — Object.prototype.role = "admin". Admin panel unlocked!`;
    showExplanation('gadget');
  } else {
    accessResult.className = 'result-msg';
    accessResult.textContent = `Access DENIED — prototype not yet polluted. Try injecting __proto__[isAdmin]=true via query string or merge.`;
  }
});

function renderProtoState() {
  const proto = Object.prototype;
  const injected = [];
  const safe = ['constructor','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toString','valueOf','toLocaleString'];
  for (const k in proto) {
    if (!safe.includes(k)) {
      injected.push(`<span class="p-key">${escHtml(k)}</span>: <span class="p-val">${escHtml(String(proto[k]))}</span>`);
    }
  }
  if (injected.length === 0) {
    protoState.innerHTML = `<span class="p-clean">Object.prototype — clean (no injected properties)</span>`;
  } else {
    protoState.innerHTML = `Object.prototype {\n  ${injected.join('\n  ')}\n}`;
  }
}

function showExplanation(type, payload) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Client-Side Prototype Pollution</h3>
    <p>${type === 'gadget'
      ? 'The access control check on a fresh object returned true because <code>Object.prototype</code> was polluted — the property is now inherited by <em>every</em> object in the application.'
      : `The ${type === 'parse' ? 'query string parser' : 'deep merge function'} processed <code>${escHtml(payload)}</code> and wrote to <code>Object.prototype</code>.`}</p>
    <ul>
      <li><strong>Root cause:</strong> Recursive merge or parser that doesn't block <code>__proto__</code>, <code>constructor</code>, or <code>prototype</code> as keys.</li>
      <li><strong>Impact:</strong> Any property added to <code>Object.prototype</code> becomes a default on every plain object — enabling auth bypass, XSS via gadget chains, and logic flaws.</li>
      <li><strong>Fix:</strong> Block <code>__proto__</code>, <code>constructor</code>, <code>prototype</code> in all merge/parse functions. Use <code>Object.create(null)</code> for config objects. Use <code>Object.hasOwn(obj, key)</code> instead of <code>obj[key]</code> for security checks.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
renderProtoState();
