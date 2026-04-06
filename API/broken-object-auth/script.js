// Simulated REST API — no ownership check (BOLA / BFLA)
const DB = {
  users: {
    1: { id: 1, name: 'Alice Johnson', email: 'alice@securecorp.com', role: 'user',  phone: '+1-555-0101', ssn: '123-45-6789', balance: 1420.50 },
    2: { id: 2, name: 'Bob Martinez',  email: 'bob@securecorp.com',   role: 'user',  phone: '+1-555-0102', ssn: '987-65-4321', balance: 830.00  },
    3: { id: 3, name: 'Carol White',   email: 'carol@securecorp.com', role: 'admin', phone: '+1-555-0103', ssn: '555-44-3333', balance: 5000.00 },
  },
  orders: {
    1001: { id: 1001, userId: 1, items: ['Widget A','Widget B'], total: 149.99, status: 'shipped',  address: '123 Main St, Springfield' },
    1002: { id: 1002, userId: 2, items: ['Gadget X'],            total: 399.00, status: 'pending',  address: '456 Oak Ave, Shelbyville' },
    1003: { id: 1003, userId: 1, items: ['Premium Plan'],        total: 299.00, status: 'complete', address: '123 Main St, Springfield' },
    1004: { id: 1004, userId: 3, items: ['Confidential Order'],  total: 9999.00,status: 'pending',  address: '789 Pine Rd, Capital City' },
  },
  docs: {
    'doc-001': { id: 'doc-001', userId: 1, title: 'Q4 Financial Report', content: 'Revenue: $4.2M, Costs: $1.8M, EBITDA: $2.4M...' },
    'doc-002': { id: 'doc-002', userId: 2, title: 'HR Termination Letter - Bob', content: 'Dear Bob, After review...' },
    'doc-003': { id: 'doc-003', userId: 3, title: 'Admin Salary Sheet', content: 'CEO: $450k, CTO: $380k, CFO: $360k...' },
  }
};

// Current session: logged in as user ID 1 (Alice)
const SESSION_USER_ID = 1;

const methodSelect   = document.getElementById('methodSelect');
const endpointInput  = document.getElementById('endpointInput');
const bodyField      = document.getElementById('bodyField');
const bodyInput      = document.getElementById('bodyInput');
const sendBtn        = document.getElementById('sendBtn');
const responseBox    = document.getElementById('responseBox');
const explanationBox = document.getElementById('explanationBox');

methodSelect.addEventListener('change', () => {
  bodyField.classList.toggle('hidden', methodSelect.value === 'GET' || methodSelect.value === 'DELETE');
});

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => {
    endpointInput.value = h.textContent.trim();
  });
});

sendBtn.addEventListener('click', handleRequest);

function handleRequest() {
  const method   = methodSelect.value;
  const endpoint = endpointInput.value.trim();
  if (!endpoint) return;

  let status, data;

  // GET /api/users/:id
  let m = endpoint.match(/^\/api\/users\/(\d+)/);
  if (m && method === 'GET') {
    const u = DB.users[m[1]];
    if (!u) { status = 404; data = { error: 'User not found' }; }
    else { status = 200; data = u; showExplanation('idor', parseInt(m[1])); }
    return render(method, endpoint, status, data);
  }

  // DELETE /api/users/:id
  m = endpoint.match(/^\/api\/users\/(\d+)/);
  if (m && method === 'DELETE') {
    status = 204; data = null;
    showExplanation('delete', parseInt(m[1]));
    return render(method, endpoint, status, data);
  }

  // GET /api/orders/:id
  m = endpoint.match(/^\/api\/orders\/(\d+)$/);
  if (m && method === 'GET') {
    const o = DB.orders[m[1]];
    if (!o) { status = 404; data = { error: 'Order not found' }; }
    else { status = 200; data = o; showExplanation('idor', o.userId); }
    return render(method, endpoint, status, data);
  }

  // GET /api/docs/:id
  m = endpoint.match(/^\/api\/docs\/(doc-\d+)$/);
  if (m && method === 'GET') {
    const d = DB.docs[m[1]];
    if (!d) { status = 404; data = { error: 'Document not found' }; }
    else { status = 200; data = d; showExplanation('idor', d.userId); }
    return render(method, endpoint, status, data);
  }

  // GET /api/admin/users
  if (endpoint === '/api/admin/users' && method === 'GET') {
    status = 200; data = Object.values(DB.users);
    showExplanation('admin');
    return render(method, endpoint, status, data);
  }

  // PUT /api/users/:id
  m = endpoint.match(/^\/api\/users\/(\d+)/);
  if (m && method === 'PUT') {
    let body = {};
    try { body = JSON.parse(bodyInput.value); } catch {}
    const uid = parseInt(m[1]);
    const u = DB.users[uid];
    if (!u) { status = 404; data = { error: 'User not found' }; }
    else { Object.assign(u, body); status = 200; data = u; showExplanation('put', uid); }
    return render(method, endpoint, status, data);
  }

  status = 404; data = { error: 'Endpoint not found' };
  render(method, endpoint, status, data);
}

function render(method, endpoint, status, data) {
  responseBox.classList.remove('hidden');
  const cls = status < 300 ? 'status-200' : status === 403 ? 'status-403' : status === 204 ? 'status-204' : 'status-403';
  const label = status === 204 ? '204 No Content' : status === 200 ? '200 OK' : `${status}`;
  let headerHtml = `<div style="display:flex;justify-content:space-between;padding:6px 10px;background:#161b22;border-bottom:1px solid #30363d;font-family:monospace;font-size:.85rem;"><span>${method} ${escHtml(endpoint)}</span><span class="${cls}">${label}</span></div>`;
  let bodyHtml = '';
  if (data) {
    let html = JSON.stringify(data, null, 2);
    ['ssn','passwordHash','balance','content','address'].forEach(k => {
      const re = new RegExp(`("${k}":\\s*"?)([^",\\n]+)`, 'g');
      html = html.replace(re, `$1<span class="data-sensitive">$2</span>`);
    });
    bodyHtml = `<pre style="margin:0;padding:10px;font-size:.82rem;white-space:pre-wrap;">${html}</pre>`;
  } else {
    bodyHtml = `<pre style="margin:0;padding:10px;font-size:.82rem;">(empty response body)</pre>`;
  }
  responseBox.innerHTML = headerHtml + bodyHtml;
}

function showExplanation(type, resourceUserId) {
  explanationBox.classList.remove('hidden');
  const isOtherUser = resourceUserId && resourceUserId !== SESSION_USER_ID;
  if (type === 'admin') {
    explanationBox.innerHTML = `<h3>Broken Function-Level Authorization (BFLA)</h3>
      <p>The <code>/api/admin/users</code> endpoint returned all user records including SSNs and sensitive data — without checking if the caller has admin privileges. Any authenticated (or unauthenticated) user can call it.</p>
      <ul><li><strong>Fix:</strong> Check role/permission before executing privileged operations. Return 403 Forbidden if the caller is not an admin.</li></ul>`;
  } else if (type === 'delete') {
    explanationBox.innerHTML = `<h3>Broken Object-Level Authorization (BOLA)</h3>
      <p>The DELETE was accepted without verifying that the currently logged-in user (ID ${SESSION_USER_ID}) owns or has rights over the target resource. This allows any user to delete any other user's account.</p>
      <ul><li><strong>Fix:</strong> Before deleting, assert <code>resource.userId === currentUser.id</code> (or admin role). Reject with 403 otherwise.</li></ul>`;
  } else if (type === 'put') {
    explanationBox.innerHTML = `<h3>BOLA on Write Operation</h3>
      <p>The PUT request modified a user record without verifying ownership. User ${SESSION_USER_ID} successfully updated user ${resourceUserId}'s data.</p>
      <ul><li><strong>Fix:</strong> Verify <code>requestingUserId === targetUserId</code> or require admin role for cross-user updates.</li></ul>`;
  } else {
    explanationBox.innerHTML = `<h3>Broken Object-Level Authorization (BOLA / IDOR)</h3>
      <p>${isOtherUser ? `You (user ${SESSION_USER_ID}) accessed a resource belonging to user ${resourceUserId} — no ownership check was performed.` : 'You accessed your own resource — try incrementing/decrementing the ID to access other users\' data.'}</p>
      <ul>
        <li><strong>Root cause:</strong> The server uses the ID from the URL directly without checking <code>resource.userId === session.userId</code>.</li>
        <li><strong>Impact:</strong> Any user can read or modify any other user's orders, documents, financial records, PII.</li>
        <li><strong>Fix:</strong> Always filter queries with the authenticated user's ID: <code>WHERE id = ? AND user_id = ?</code>.</li>
      </ul>`;
  }
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
