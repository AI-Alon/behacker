// Simulated GraphQL schema (including hidden admin types)
const SCHEMA = {
  queryType: { name: 'Query' },
  mutationType: { name: 'Mutation' },
  types: [
    { name: 'Query', fields: [
      { name: 'me',            type: 'User',           args: [] },
      { name: 'post',          type: 'Post',           args: [{ name: 'id', type: 'ID!' }] },
      { name: 'posts',         type: '[Post]',         args: [] },
      { name: 'adminUsers',    type: '[User]',         args: [],               description: 'INTERNAL: list all users' },
      { name: 'adminDumpDB',   type: 'DatabaseExport', args: [],               description: 'INTERNAL: full DB export' },
      { name: 'userByToken',   type: 'User',           args: [{ name: 'resetToken', type: 'String!' }] },
    ]},
    { name: 'Mutation', fields: [
      { name: 'login',         type: 'AuthPayload',    args: [{ name: 'email', type: 'String!' },{ name: 'password', type: 'String!' }] },
      { name: 'createPost',    type: 'Post',           args: [{ name: 'title', type: 'String!' }] },
      { name: 'adminSetRole',  type: 'User',           args: [{ name: 'userId', type: 'ID!' },{ name: 'role', type: 'String!' }], description: 'INTERNAL: change user role' },
      { name: 'adminResetAll', type: 'Boolean',        args: [],               description: 'INTERNAL: wipe all user data' },
    ]},
    { name: 'User', fields: [
      { name: 'id',       type: 'ID' }, { name: 'email', type: 'String' },
      { name: 'role',     type: 'String' }, { name: 'passwordHash', type: 'String', description: 'INTERNAL' },
      { name: 'resetToken', type: 'String', description: 'INTERNAL' },
    ]},
    { name: 'Post',           fields: [{ name: 'id', type: 'ID' }, { name: 'title', type: 'String' }] },
    { name: 'AuthPayload',    fields: [{ name: 'token', type: 'String' }, { name: 'user', type: 'User' }] },
    { name: 'DatabaseExport', fields: [{ name: 'tables', type: '[String]' }, { name: 'rows', type: 'Int' }, { name: 's3Url', type: 'String' }] },
  ]
};

const QUERY_RESPONSES = {
  introspection: () => buildIntrospectionResponse(),
  adminUsers: () => ({ data: { adminUsers: [
    { id: '1', email: 'admin@securecorp.com', role: 'admin', passwordHash: '$2b$12$abc...hashed', resetToken: 'tok_9f8e7d6c5b4a' },
    { id: '101', email: 'alice@securecorp.com', role: 'user', passwordHash: '$2b$12$def...hashed', resetToken: null },
  ]}}),
  adminDumpDB: () => ({ data: { adminDumpDB: { tables: ['users','orders','payments','sessions'], rows: 148392, s3Url: 's3://securecorp-backups/dump-2024-01-15.sql.gz' }}}),
  adminSetRole: (args) => ({ data: { adminSetRole: { id: args.userId || '101', email: 'alice@securecorp.com', role: args.role || 'admin' }}}),
  adminResetAll: () => ({ data: { adminResetAll: true }, extensions: { warning: 'ALL USER DATA WIPED' }}),
  me: () => ({ data: { me: { id: '101', email: 'alice@securecorp.com', role: 'user' }}}),
};

const queryEditor  = document.getElementById('queryEditor');
const responseBox  = document.getElementById('responseBox');
const runBtn       = document.getElementById('runBtn');
const chips        = document.querySelectorAll('.hint[data-query]');
const explanationBox = document.getElementById('explanationBox');

const SAMPLE_QUERIES = {
  introspection: `{ __schema { queryType { name } mutationType { name } types { name fields { name type { name } description } } } }`,
  adminUsers:   `{ adminUsers { id email role passwordHash resetToken } }`,
  adminDumpDB:  `{ adminDumpDB { tables rows s3Url } }`,
  adminSetRole: `mutation { adminSetRole(userId: "101", role: "admin") { id email role } }`,
  adminResetAll:`mutation { adminResetAll }`,
  me:           `{ me { id email role } }`,
};

chips.forEach(chip => {
  chip.addEventListener('click', () => { queryEditor.value = SAMPLE_QUERIES[chip.dataset.query] || ''; });
});

runBtn.addEventListener('click', () => executeQuery(queryEditor.value.trim()));

function executeQuery(q) {
  if (!q) return;
  let result;
  if (q.includes('__schema') || q.includes('__type')) {
    result = QUERY_RESPONSES.introspection();
    showExplanation('introspection');
  } else if (q.includes('adminUsers')) {
    result = QUERY_RESPONSES.adminUsers();
    showExplanation('sensitive');
  } else if (q.includes('adminDumpDB')) {
    result = QUERY_RESPONSES.adminDumpDB();
    showExplanation('sensitive');
  } else if (q.includes('adminSetRole')) {
    const m = q.match(/role:\s*"([^"]+)"/);
    result = QUERY_RESPONSES.adminSetRole({ role: m ? m[1] : 'admin' });
    showExplanation('sensitive');
  } else if (q.includes('adminResetAll')) {
    result = QUERY_RESPONSES.adminResetAll();
    showExplanation('sensitive');
  } else if (q.includes('me')) {
    result = QUERY_RESPONSES.me();
  } else {
    result = { errors: [{ message: 'Unknown query field', locations: [{ line: 1, column: 3 }] }] };
  }
  renderResponse(result);
}

function renderSchemaTree() {
  let html = '';
  SCHEMA.types.forEach(type => {
    const sensitive = ['DatabaseExport'].includes(type.name) || type.name.toLowerCase().includes('admin');
    const cls = sensitive ? 't-sensitive' : 't-type';
    html += `<span class="${cls}">type ${type.name}</span> {\n`;
    type.fields.forEach(f => {
      const fCls = f.description && f.description.includes('INTERNAL') ? 't-sensitive' : 't-field';
      html += `  <span class="${fCls}">${f.name}</span>: <span class="t-value">${f.type}</span>`;
      if (f.description) html += ` <span style="color:#484f58">  # ${f.description}</span>`;
      html += '\n';
    });
    html += '}\n\n';
  });
  return html;
}

function renderResponse(obj) {
  let json = JSON.stringify(obj, null, 2);
  // Colorize sensitive keys
  const sensitiveKeys = ['passwordHash','resetToken','s3Url','adminUsers','adminDumpDB','adminSetRole','adminResetAll'];
  sensitiveKeys.forEach(k => {
    const re = new RegExp(`"(${k})"`, 'g');
    json = json.replace(re, '<span class="json-sensitive">"$1"</span>');
  });
  json = json.replace(/"([^"]+)":/g, (m, k) => {
    if (sensitiveKeys.some(s => m.includes(s))) return m;
    return `<span class="json-key">"${k}"</span>:`;
  });
  responseBox.classList.remove('hidden');
  responseBox.innerHTML = json;
}

function showExplanation(type) {
  explanationBox.classList.remove('hidden');
  if (type === 'introspection') {
    explanationBox.innerHTML = `
      <h3>GraphQL Introspection Enabled in Production</h3>
      <p>Introspection lets any client query the full schema — all types, fields, queries, mutations, and descriptions. In production this exposes internal admin operations and sensitive field names.</p>
      <ul>
        <li>The schema revealed hidden admin queries: <code>adminUsers</code>, <code>adminDumpDB</code>, <code>adminSetRole</code>, <code>adminResetAll</code>.</li>
        <li>Internal field descriptions like <em>"INTERNAL"</em> and sensitive types like <code>DatabaseExport</code> are visible.</li>
        <li><strong>Fix:</strong> Disable introspection in production (<code>introspection: false</code>). Use field-level authorization so admin resolvers reject unauthenticated/unauthorized callers.</li>
      </ul>`;
  } else {
    explanationBox.innerHTML = `
      <h3>Unauthenticated Access to Admin Queries</h3>
      <p>Even if introspection were disabled, the admin mutations are callable without any authorization check. The server resolved <code>adminUsers</code> / <code>adminDumpDB</code> / <code>adminSetRole</code> for an unauthenticated request.</p>
      <ul>
        <li>Attacker retrieved all user password hashes and reset tokens in one query.</li>
        <li>Attacker obtained a direct S3 link to a full database backup.</li>
        <li><strong>Fix:</strong> Every resolver must verify the caller's identity and role. Authorization belongs in the resolver, not just in the client UI.</li>
      </ul>`;
  }
}

function buildIntrospectionResponse() {
  return { data: { __schema: { queryType: SCHEMA.queryType, mutationType: SCHEMA.mutationType, types: SCHEMA.types.map(t => ({ name: t.name, fields: t.fields.map(f => ({ name: f.name, description: f.description || null, type: { name: f.type } })) })) } } };
}
