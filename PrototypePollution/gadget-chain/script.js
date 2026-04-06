// Vulnerable query parser (same as client-side lab)
function setNested(obj, path, value) {
  const parts = path.replace(/\[([^\]]+)\]/g, '.$1').split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function parseQuery(qs) {
  const params = {};
  if (!qs || !qs.startsWith('?')) return params;
  qs.slice(1).split('&').forEach(pair => {
    const [k, v] = pair.split('=').map(decodeURIComponent);
    if (k) setNested(params, k, v);
  });
  return params;
}

// VULNERABLE widget renderer — reads options.innerHTML with no sanitization
function renderWidget(options) {
  const el = document.createElement('div');
  el.style.cssText = 'padding:12px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#c9d1d9;font-size:0.9rem;';
  const merged = Object.assign({}, options); // inherits from Object.prototype!
  if (merged.innerHTML) {
    el.innerHTML = merged.innerHTML; // GADGET: uses polluted property as HTML
  } else if (merged.src) {
    const img = document.createElement('img');
    img.src = merged.src;
    if (merged.onerror) img.setAttribute('onerror', merged.onerror);
    el.appendChild(img);
  } else if (merged.template) {
    el.innerHTML = merged.template; // another gadget
  } else {
    el.textContent = '✓ Notification: Your settings were saved.';
  }
  return el;
}

const queryInput   = document.getElementById('queryInput');
const pollutBtn    = document.getElementById('pollutBtn');
const renderBtn    = document.getElementById('renderBtn');
const widgetOutput = document.getElementById('widgetOutput');
const protoDiff    = document.getElementById('protoDiff');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { queryInput.value = h.dataset.q; });
});

pollutBtn.addEventListener('click', () => {
  const qs = queryInput.value.trim();
  parseQuery(qs); // side effect: pollutes Object.prototype
  renderProtoDiff();
  explanationBox.classList.add('hidden');
});

renderBtn.addEventListener('click', () => {
  widgetOutput.innerHTML = '';
  const widget = renderWidget({}); // empty options — relies on prototype fallback
  widgetOutput.appendChild(widget);

  const proto = Object.prototype;
  const hasGadget = proto.innerHTML || proto.src || proto.template;
  if (hasGadget) {
    showExplanation('triggered');
  } else {
    widgetOutput.textContent = '✓ Notification: Your settings were saved. (No pollution active — try polluting first)';
  }
});

function renderProtoDiff() {
  const safe = ['constructor','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toString','valueOf','toLocaleString'];
  const injected = [];
  for (const k in Object.prototype) {
    if (!safe.includes(k)) {
      injected.push(`<span class="p-key">${escHtml(k)}</span>: <span class="p-val">${escHtml(String(Object.prototype[k]))}</span>`);
    }
  }
  if (injected.length === 0) {
    protoDiff.innerHTML = `<span style="color:#484f58;font-style:italic">Object.prototype — clean</span>`;
  } else {
    protoDiff.innerHTML = `Object.prototype {\n  ${injected.join('\n  ')}\n}`;
    showExplanation('polluted');
  }
}

function showExplanation(type) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Prototype Pollution → Gadget Chain → ${type === 'triggered' ? 'XSS Triggered' : 'Pollution Applied'}</h3>
    <p>${type === 'triggered'
      ? 'The widget renderer read <code>options.innerHTML</code> — which was <em>undefined</em> on the options object itself, so it fell back to <code>Object.prototype.innerHTML</code> — your injected payload. The renderer then set it as <code>el.innerHTML</code>, executing the script.'
      : 'Object.prototype was polluted. Now click "Render Notification Widget" to trigger the gadget.'}</p>
    <ul>
      <li><strong>Gadget:</strong> Code that reads a property with a fallback to the prototype and uses it unsafely (as HTML, as a URL, in <code>eval()</code>).</li>
      <li><strong>Chain:</strong> Pollution source (query string) → polluted prototype → gadget (widget renderer) → XSS.</li>
      <li><strong>Common library gadgets:</strong> jQuery's <code>$.extend</code>, lodash's <code>_.merge</code>, <code>qs</code> package (patched), Handlebars template engine.</li>
      <li><strong>Fix:</strong> Sanitize HTML before setting <code>innerHTML</code>. Use <code>Object.hasOwn(options, 'innerHTML')</code> to check own properties only. Block prototype-polluting keys in all parsers.</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
renderProtoDiff();
