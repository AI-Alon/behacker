// Simulated AWS EC2 Instance Metadata Service (IMDSv1)
const METADATA = {
  'http://169.254.169.254/latest/meta-data/': `ami-id\nami-launch-index\nami-manifest-path\nhostname\niam/\ninstance-id\ninstance-type\nlocal-ipv4\nplacement/\npublic-hostname\npublic-ipv4\nreservation-id`,
  'http://169.254.169.254/latest/meta-data/iam/security-credentials/': `ec2-prod-role`,
  'http://169.254.169.254/latest/meta-data/iam/security-credentials/ec2-prod-role': JSON.stringify({
    Code: 'Success',
    LastUpdated: '2024-01-15T08:23:00Z',
    Type: 'AWS-HMAC',
    AccessKeyId: 'ASIA4XKJBWBMOX9VQDFZ',
    SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYSSRFTEST',
    Token: 'FwoGZXIvYXdzEJr//////////wEaDKrandom+session+token+here+AAAA==',
    Expiration: '2024-01-15T14:23:00Z'
  }, null, 2),
  'http://169.254.169.254/latest/user-data': `#!/bin/bash\n# Bootstrap script — DO NOT EXPOSE\nexport DB_HOST=db.internal\nexport DB_PASS=Sup3rS3cr3t!2024\nexport ADMIN_TOKEN=tok_admin_9182736450abc\napt-get update -y\npip install -r /opt/app/requirements.txt\nsystemctl start app`,
  'http://169.254.169.254/latest/meta-data/hostname': `ip-10-0-1-42.ec2.internal`,
  'http://169.254.169.254/latest/meta-data/instance-id': `i-0abc1234def56789a`,
  'http://169.254.169.254/latest/meta-data/public-ipv4': `54.210.123.45`,
  'http://169.254.169.254/latest/meta-data/local-ipv4': `10.0.1.42`,
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token': JSON.stringify({
    access_token: 'ya29.c.GCP_ACCESS_TOKEN_EXAMPLE_1234567890abcdef',
    expires_in: 3599,
    token_type: 'Bearer'
  }, null, 2),
};

const urlInput   = document.getElementById('urlInput');
const fetchBtn   = document.getElementById('fetchBtn');
const responseBox  = document.getElementById('responseBox');
const responseBar  = document.getElementById('responseBar');
const responseBody = document.getElementById('responseBody');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { urlInput.value = h.dataset.url; });
});

fetchBtn.addEventListener('click', fetchMeta);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchMeta(); });

function fetchMeta() {
  const url = urlInput.value.trim();
  if (!url) return;
  responseBox.classList.remove('hidden');

  const data = METADATA[url];
  if (data) {
    responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-ok">200 OK</span>`;
    responseBody.textContent = data;
    showExplanation(url);
  } else if (url.includes('169.254.169.254') || url.includes('metadata.google')) {
    responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-ok">200 OK</span>`;
    responseBody.textContent = `(endpoint exists but path not in this simulation — try one of the quick targets)`;
  } else {
    responseBar.innerHTML = `<span>GET ${escHtml(url)}</span><span class="status-err">Connection refused</span>`;
    responseBody.textContent = `Not a metadata endpoint. Try 169.254.169.254.`;
  }
}

function showExplanation(url) {
  explanationBox.classList.remove('hidden');
  let critical = '';
  if (url.includes('security-credentials/ec2-prod-role')) {
    critical = '<li><strong>Critical:</strong> The IAM credentials (AccessKeyId, SecretAccessKey, Token) can be used immediately with the AWS CLI: <code>aws s3 ls</code>, <code>aws iam list-users</code>, etc. — with full EC2 instance permissions.</li>';
  } else if (url.includes('user-data')) {
    critical = '<li><strong>Critical:</strong> User-data scripts often contain bootstrap secrets, DB passwords, and API tokens — embedded by developers who assume this endpoint is internal-only.</li>';
  } else if (url.includes('token') && url.includes('google')) {
    critical = '<li><strong>Critical:</strong> The GCP access token can be used immediately to call GCP APIs with the service account\'s permissions.</li>';
  }
  explanationBox.innerHTML = `
    <h3>Cloud Metadata SSRF</h3>
    <p>The IMDSv1 endpoint at <code>169.254.169.254</code> responds to any request from the instance — including those forwarded by an SSRF vulnerability. It requires no authentication and returns credentials with the instance's full IAM role permissions.</p>
    <ul>
      <li><strong>Why it's dangerous:</strong> IAM credentials from the metadata service may have broad AWS permissions (S3, EC2, RDS, SecretsManager).</li>
      ${critical}
      <li><strong>Real incidents:</strong> Capital One breach (2019) — attacker used SSRF to steal IAM credentials from metadata service, accessed 100M customer records.</li>
      <li><strong>Fix:</strong> Enforce IMDSv2 (requires PUT token exchange — blocks simple SSRF). Block <code>169.254.169.254</code> at the WAF/network level. Apply minimal IAM permissions (least privilege).</li>
    </ul>`;
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
