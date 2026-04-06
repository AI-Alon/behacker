const PRODUCTS = [
  { id: 1, name: 'Widget Pro',    price: 49.99 },
  { id: 2, name: 'Gadget Plus',   price: 89.99 },
  { id: 3, name: 'Premium Plan',  price: 199.00 },
  { id: 4, name: 'Support Add-on', price: 29.99 },
];

const DISCOUNTS = { 'SAVE10': 0.10, 'HALF50': 0.50, 'BLACKFRIDAY': 0.30 };

let cart = [];

const productList  = document.getElementById('productList');
const cartItemsEl  = document.getElementById('cartItems');
const cartTotals   = document.getElementById('cartTotals');
const discountCode = document.getElementById('discountCode');
const qtyOverride  = document.getElementById('qtyOverride');
const applyDiscount= document.getElementById('applyDiscount');
const checkoutBtn  = document.getElementById('checkoutBtn');
const orderResult  = document.getElementById('orderResult');
const explanationBox = document.getElementById('explanationBox');

let appliedDiscount = 0;

// Render products
PRODUCTS.forEach(p => {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `<div class="product-info"><div class="prod-name">${p.name}</div><div class="prod-price">$${p.price.toFixed(2)}</div></div>
    <button class="btn-add" data-id="${p.id}">Add to Cart</button>`;
  card.querySelector('.btn-add').addEventListener('click', () => addToCart(p));
  productList.appendChild(card);
});

function addToCart(p) {
  cart.push({ ...p });
  renderCart();
}

function renderCart() {
  if (cart.length === 0) {
    cartItemsEl.innerHTML = '<p class="empty-cart">No items yet.</p>';
    cartTotals.innerHTML = '';
    return;
  }
  const qty = parseInt(qtyOverride.value) || 1;
  cartItemsEl.innerHTML = cart.map(item =>
    `<div class="cart-item"><span class="ci-name">${item.name}</span><span class="ci-price">$${item.price.toFixed(2)}</span></div>`
  ).join('');

  const subtotal = cart.reduce((s, i) => s + i.price, 0);
  const discountAmount = subtotal * appliedDiscount;
  const afterDiscount  = subtotal - discountAmount;
  const total = afterDiscount * qty; // VULNERABLE: qty not validated server-side

  const negClass = total < 0 ? 'negative' : 'positive';
  cartTotals.innerHTML = `
    <div class="total-row"><span class="t-label">Subtotal</span><span class="t-val">$${subtotal.toFixed(2)}</span></div>
    ${appliedDiscount > 0 ? `<div class="total-row"><span class="t-label">Discount (${(appliedDiscount*100).toFixed(0)}%)</span><span class="t-val">-$${discountAmount.toFixed(2)}</span></div>` : ''}
    <div class="total-row"><span class="t-label">Qty multiplier</span><span class="t-val">×${qty}</span></div>
    <div class="total-row grand"><span class="t-label">Total</span><span class="t-val ${negClass}">$${total.toFixed(2)}</span></div>`;
}

qtyOverride.addEventListener('input', renderCart);

applyDiscount.addEventListener('click', () => {
  const code = discountCode.value.trim().toUpperCase();
  if (DISCOUNTS[code]) {
    appliedDiscount = DISCOUNTS[code];
    renderCart();
  } else {
    alert('Invalid discount code.');
  }
});

checkoutBtn.addEventListener('click', () => {
  if (cart.length === 0) return;
  const qty   = parseInt(qtyOverride.value) || 1;
  const subtotal = cart.reduce((s, i) => s + i.price, 0);
  const total = (subtotal * (1 - appliedDiscount)) * qty;

  orderResult.classList.remove('hidden');
  if (total < 0) {
    orderResult.className = 'refund';
    orderResult.textContent = `Order placed! Total: $${total.toFixed(2)} — A refund of $${Math.abs(total).toFixed(2)} has been issued to your account.`;
    showExplanation(total, qty);
  } else if (total === 0) {
    orderResult.className = 'success';
    orderResult.textContent = 'Order placed for $0.00 — items obtained for free!';
    showExplanation(total, qty);
  } else {
    orderResult.className = 'success';
    orderResult.textContent = `Order placed. Total charged: $${total.toFixed(2)}.`;
  }
});

function showExplanation(total, qty) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Negative Price / Logic Bypass</h3>
    <p>The server accepted <strong>qty = ${qty}</strong> without validation. By submitting a negative quantity (or combining a large discount with a negative quantity), the total became <strong>$${total.toFixed(2)}</strong> — causing the system to issue a refund rather than charge the customer.</p>
    <ul>
      <li><strong>Root cause:</strong> No server-side validation that quantity > 0 and that the total is always ≥ $0 before processing.</li>
      <li><strong>Impact:</strong> Free products, refunds on purchases, financial loss to the merchant.</li>
      <li><strong>Fix:</strong> Validate all numeric inputs server-side: <code>assert qty > 0</code>, <code>assert total >= 0</code>. Never trust client-supplied prices or totals — always recompute from trusted product data.</li>
    </ul>`;
}
