const COUPONS = {
  'SAVE10':    { pct: 10, desc: '10% off',        type: 'pct' },
  'HALF50':    { pct: 50, desc: '50% off',        type: 'pct' },
  'FREESHIP':  { flat: 0, desc: 'Free shipping',  type: 'flat', value: 15 },
  'VIP25':     { pct: 25, desc: '25% VIP discount', type: 'pct' },
  'LOYALTY15': { pct: 15, desc: '15% loyalty',    type: 'pct' },
};

let basePrice = 120.00;
let currentPrice = 120.00;
let appliedCodes = []; // VULNERABLE: no deduplication check

const couponInput  = document.getElementById('couponInput');
const applyBtn     = document.getElementById('applyBtn');
const appliedList  = document.getElementById('appliedList');
const priceDisplay = document.getElementById('priceDisplay');
const checkoutBtn  = document.getElementById('checkoutBtn');
const orderResult  = document.getElementById('orderResult');
const explanationBox = document.getElementById('explanationBox');

document.querySelectorAll('.hint').forEach(h => {
  h.addEventListener('click', () => { couponInput.value = h.dataset.code; });
});

applyBtn.addEventListener('click', applyCode);
couponInput.addEventListener('keydown', e => { if (e.key === 'Enter') applyCode(); });

function applyCode() {
  const code = couponInput.value.trim().toUpperCase();
  if (!code) return;
  const coupon = COUPONS[code];
  if (!coupon) { alert('Invalid coupon code.'); return; }

  // VULNERABLE: server only validates coupon existence, not prior use
  const isDuplicate = appliedCodes.includes(code);
  appliedCodes.push(code);

  if (coupon.type === 'pct') {
    currentPrice = currentPrice * (1 - coupon.pct / 100);
  } else {
    currentPrice = Math.max(0, currentPrice - coupon.value);
  }
  currentPrice = Math.max(0, currentPrice);

  renderApplied(code, coupon, isDuplicate);
  updatePrice();
  couponInput.value = '';

  if (isDuplicate || appliedCodes.length >= 3 || currentPrice === 0) {
    showExplanation();
  }
}

function renderApplied(code, coupon, isDuplicate) {
  const tag = document.createElement('div');
  tag.className = `coupon-tag${isDuplicate ? ' duplicate' : ''}`;
  tag.innerHTML = `<span>${code} — ${coupon.desc}</span><span class="c-discount">${isDuplicate ? '⚠ DUPLICATE' : `-${coupon.pct || coupon.value}${coupon.type === 'pct' ? '%' : '$'}`}</span>`;
  appliedList.appendChild(tag);
}

function updatePrice() {
  priceDisplay.textContent = `$${currentPrice.toFixed(2)}`;
  if (currentPrice === 0) priceDisplay.className = 'price-display zero';
  else if (currentPrice < basePrice) priceDisplay.className = 'price-display discounted';
  else priceDisplay.className = 'price-display';
}

checkoutBtn.addEventListener('click', () => {
  orderResult.classList.remove('hidden');
  if (currentPrice === 0) {
    orderResult.className = 'result-box refund';
    orderResult.textContent = `Order placed for $0.00 — obtained $${basePrice.toFixed(2)} of goods for free via coupon stacking!`;
    showExplanation();
  } else {
    orderResult.className = 'result-box success';
    orderResult.textContent = `Order placed. Charged: $${currentPrice.toFixed(2)} (saved $${(basePrice - currentPrice).toFixed(2)}).`;
    if (appliedCodes.length >= 2) showExplanation();
  }
});

function showExplanation() {
  explanationBox.classList.remove('hidden');
  const dupes = appliedCodes.filter((c, i) => appliedCodes.indexOf(c) !== i);
  explanationBox.innerHTML = `
    <h3>Coupon Stacking Vulnerability</h3>
    <p>The server validated each coupon individually but never checked whether a code had already been applied. ${dupes.length > 0 ? `Duplicate codes used: <strong>${[...new Set(dupes)].join(', ')}</strong>.` : 'Combining multiple incompatible discount codes drove the price to $' + currentPrice.toFixed(2) + '.'}</p>
    <ul>
      <li><strong>Root cause:</strong> Coupon validation is stateless — no session-level record of applied codes.</li>
      <li><strong>Impact:</strong> Arbitrary discounts, free products, financial loss.</li>
      <li><strong>Fix:</strong> Track applied coupon codes in the order/session server-side. Before applying, assert <code>NOT EXISTS (SELECT 1 FROM order_coupons WHERE order_id=? AND code=?)</code>. Also define explicit coupon combination rules (e.g. only one percentage-off code per order).</li>
    </ul>`;
}
