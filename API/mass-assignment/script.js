// Simulated user account state
const userDB = {
  101: { id: 101, name: 'Alice Johnson', email: 'alice@securecorp.com', role: 'user', isAdmin: false, balance: 50.00, plan: 'free' }
};

const bodyEditor     = document.getElementById('bodyEditor');
const sendBtn        = document.getElementById('sendBtn');
const responseBox    = document.getElementById('responseBox');
const explanationBox = document.getElementById('explanationBox');
const injectChips    = document.querySelectorAll('.hint[data-field]');

injectChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const fieldStr = chip.dataset.field; // e.g. '"role": "admin"'
    try {
      const obj = JSON.parse(bodyEditor.value);
      // Parse the field string as a mini JSON object
      const parsed = JSON.parse('{' + fieldStr + '}');
      Object.assign(obj, parsed);
      bodyEditor.value = JSON.stringify(obj, null, 2);
    } catch {
      // If current body is invalid, just append the field
      try {
        const parsed = JSON.parse('{' + fieldStr + '}');
        bodyEditor.value = JSON.stringify(parsed, null, 2);
      } catch {}
    }
  });
});

const ENDPOINT = '/api/register';

sendBtn.addEventListener('click', () => {
  let body;
  try {
    body = JSON.parse(bodyEditor.value);
  } catch {
    showResponse(400, { error: 'Invalid JSON in request body' }, null, null, []);
    return;
  }

  // Simulate a new user registration (uid 999 for new registrations)
  const newUser = { id: 999, name: body.username || 'unknown', email: body.email || '', role: 'user', isAdmin: false, balance: 0, plan: 'free' };

  // VULNERABLE: mass assignment — apply all body fields directly
  const privilegedFields = [];
  Object.keys(body).forEach(k => {
    if (['role','isAdmin','balance','plan','uid','verified'].includes(k)) privilegedFields.push(k);
    newUser[k] = body[k];
  });

  showResponse(200, { success: true, user: newUser }, privilegedFields);
  if (privilegedFields.length > 0) showExplanation(privilegedFields);
});

function showResponse(status, data, privileged) {
  responseBox.classList.remove('hidden');
  const okClass  = status < 300 ? 'status-ok'  : 'status-err';
  const statusTxt = status === 200 ? '200 OK' : status === 400 ? '400 Bad Request' : '404 Not Found';

  let bodyStr = JSON.stringify(data, null, 2);
  if (privileged && privileged.length > 0) {
    privileged.forEach(f => {
      const val = JSON.stringify(data.user && data.user[f] !== undefined ? data.user[f] : '');
      bodyStr = bodyStr.replace(
        new RegExp(`("${f}":\\s*)${val.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`),
        `$1<span class="highlight">${val}</span>`
      );
    });
  }

  responseBox.innerHTML =
    `<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#161b22;border-bottom:1px solid #30363d;font-family:monospace;font-size:.85rem;">` +
    `<span>POST ${ENDPOINT}</span><span class="${okClass}">${statusTxt}</span></div>` +
    `<pre style="margin:0;padding:10px;font-size:.82rem;white-space:pre-wrap;">${bodyStr}</pre>`;
}

function showExplanation(fields) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Mass Assignment Vulnerability</h3>
    <p>The API accepted and applied <strong>${fields.map(f=>`<code>${f}</code>`).join(', ')}</strong> — fields that should never be user-controlled. Because the server binds the entire request body to the model object without a whitelist, any JSON field becomes writable.</p>
    <ul>
      <li><strong>Root cause:</strong> ORM/framework auto-binding (e.g. Rails <code>update(params)</code>, Django <code>serializer.save()</code>) without specifying which fields are allowed.</li>
      <li><strong>Impact:</strong> Privilege escalation (become admin), financial fraud (set your own balance), feature unlocking (upgrade plan for free).</li>
      <li><strong>Fix:</strong> Use an explicit field allowlist — <code>update(params.permit(:name, :email))</code> — never bind raw request data to sensitive model fields.</li>
    </ul>`;
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
