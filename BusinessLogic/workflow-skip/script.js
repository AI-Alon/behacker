// Simulated checkout session — tracks which steps were completed
let completedSteps = new Set();
let currentStep = 1;

const STEPS = {
  1: { title: 'Cart',    desc: 'Review your items before proceeding to checkout.' },
  2: { title: 'Address', desc: 'Enter your shipping address.' },
  3: { title: 'Payment', desc: 'Enter payment details to complete your order.' },
  4: { title: 'Confirm', desc: 'Order confirmation.' },
};

const stepNodes   = document.querySelectorAll('.step-node');
const stepSelect  = document.getElementById('stepSelect');
const navigateBtn = document.getElementById('navigateBtn');
const stepContent = document.getElementById('stepContent');
const explanationBox = document.getElementById('explanationBox');

navigateBtn.addEventListener('click', () => {
  const target = parseInt(stepSelect.value);
  navigateTo(target);
});

function navigateTo(target) {
  currentStep = target;
  updateStepBar(target);
  renderStepContent(target);
}

function updateStepBar(active) {
  stepNodes.forEach(node => {
    const n = parseInt(node.dataset.step);
    node.classList.remove('active', 'completed', 'skipped');
    if (n === active) node.classList.add('active');
    else if (completedSteps.has(n)) node.classList.add('completed');
    else if (n < active && !completedSteps.has(n)) node.classList.add('skipped');
  });
}

function renderStepContent(step) {
  const skippedSteps = [];
  for (let s = 1; s < step; s++) {
    if (!completedSteps.has(s)) skippedSteps.push(s);
  }

  if (step === 4 && skippedSteps.length > 0) {
    // VULNERABLE: no server-side enforcement of step sequence
    completedSteps.add(4);
    stepContent.innerHTML = `
      <h4>Step 4: Order Confirmed</h4>
      <div class="skipped-warning">⚠ Steps ${skippedSteps.map(s => STEPS[s].title).join(', ')} were skipped!</div>
      <div class="order-confirmed" style="margin-top:12px">
        ✓ Order #ORD-${Math.floor(Math.random()*90000+10000)} confirmed!<br>
        Payment step was bypassed — order processed without payment verification.
      </div>`;
    showExplanation(skippedSteps);
  } else if (step === 3 && skippedSteps.includes(2)) {
    stepContent.innerHTML = `
      <h4>Step 3: Payment</h4>
      <div class="skipped-warning">⚠ Address step was skipped — a secure app would redirect you back to step 2.</div>
      <p style="margin-top:10px">In this vulnerable app, you can proceed to payment without an address.</p>
      <button class="btn-primary" style="margin-top:12px" onclick="completeStep(3)">Complete Payment</button>`;
    showExplanation(skippedSteps);
  } else {
    stepContent.innerHTML = `
      <h4>Step ${step}: ${STEPS[step].title}</h4>
      <p>${STEPS[step].desc}</p>
      ${step < 4 ? `<button class="btn-primary" style="margin-top:12px" onclick="completeStep(${step})">Complete & Continue</button>` : ''}`;
  }
}

window.completeStep = function(step) {
  completedSteps.add(step);
  const next = step + 1;
  stepSelect.value = String(next);
  navigateTo(next);
};

function showExplanation(skipped) {
  explanationBox.classList.remove('hidden');
  explanationBox.innerHTML = `
    <h3>Workflow Skip / Forced Browsing</h3>
    <p>By navigating directly to <strong>step ${currentStep}</strong>, the following steps were bypassed: <strong>${skipped.map(s => STEPS[s].title).join(', ')}</strong>. The server accepted the final confirmation without verifying that all previous steps were completed.</p>
    <ul>
      <li><strong>Root cause:</strong> The server trusts the client to follow the correct sequence. No server-side state machine enforces step order.</li>
      <li><strong>Impact:</strong> Skipping payment → free goods. Skipping identity verification → unauthorized account actions.</li>
      <li><strong>Fix:</strong> Implement a server-side state machine. Before processing any step, verify that all prerequisite steps were completed in the current session. Never rely on the client's URL navigation to enforce workflow.</li>
    </ul>`;
}

// Initialize
renderStepContent(1);
