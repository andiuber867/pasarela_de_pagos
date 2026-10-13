/**
 * Frontend SaaS Pasarela de Cobros QR Interoperable
 * Soporte Multi-Cliente y Escucha en Tiempo Real
 */

const BANCOS_BOLIVIA = {
  '1001': 'Banco Central de Bolivia',
  '1002': 'Banco Nacional de Bolivia (BNB)',
  '1003': 'Banco Mercantil Santa Cruz',
  '1004': 'Banco de Crédito de Bolivia (BCP)',
  '1007': 'Banco BISA',
  '1008': 'Banco Unión',
  '1016': 'Banco Económico',
  '1017': 'Banco Solidario (BancoSol)',
  '1018': 'Banco Ganadero (GanaMóvil)',
  '1020': 'Banco Fortaleza',
  '1022': 'Banco FIE',
  '1023': 'Banco Pyme Ecofuturo',
  '1024': 'Banco Prodem'
};

const state = {
  selectedClientId: 'default',
  activeQrId: null,
  activeAmount: 0,
  activeDesc: '',
  pollInterval: null,
  pollSeconds: 0,
  counterInterval: null
};

// Elementos del DOM
const clientSelector = document.getElementById('clientSelector');
const displayClientName = document.getElementById('displayClientName');
const displayBusinessName = document.getElementById('displayBusinessName');
const displayAccountNumber = document.getElementById('displayAccountNumber');

const paymentForm = document.getElementById('paymentForm');
const amountInput = document.getElementById('amountInput');
const descInput = document.getElementById('descInput');
const btnGenerate = document.getElementById('btnGenerate');
const quickChips = document.querySelectorAll('.chip-btn');

// Vistas
const viewIdle = document.getElementById('viewIdle');
const viewWaiting = document.getElementById('viewWaiting');
const viewSuccess = document.getElementById('viewSuccess');

// Espera
const qrImageElement = document.getElementById('qrImageElement');
const waitingAmount = document.getElementById('waitingAmount');
const waitingDesc = document.getElementById('waitingDesc');
const pollCounter = document.getElementById('pollCounter');
const btnCancelQR = document.getElementById('btnCancelQR');

// Recibo
const receiptAmount = document.getElementById('receiptAmount');
const receiptBank = document.getElementById('receiptBank');
const receiptPayer = document.getElementById('receiptPayer');
const receiptAccount = document.getElementById('receiptAccount');
const receiptDateTime = document.getElementById('receiptDateTime');
const receiptTrx = document.getElementById('receiptTrx');
const receiptQrId = document.getElementById('receiptQrId');
const btnNewPayment = document.getElementById('btnNewPayment');

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar clientes
  loadClients();

  // Cambio de cliente
  if (clientSelector) {
    clientSelector.addEventListener('change', (e) => {
      state.selectedClientId = e.target.value;
      updateClientDisplay(state.selectedClientId);
    });
  }

  // Chips de monto rápido
  quickChips.forEach(btn => {
    btn.addEventListener('click', () => {
      amountInput.value = parseFloat(btn.dataset.val).toFixed(2);
      amountInput.focus();
    });
  });

  // Envío del formulario
  paymentForm.addEventListener('submit', handleFormSubmit);

  // Acciones de cancelación y nuevo pago
  btnCancelQR.addEventListener('click', cancelPayment);
  btnNewPayment.addEventListener('click', resetToIdle);
});

async function loadClients() {
  try {
    const res = await fetch('/api?action=get-clients');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.clients) {
        clientSelector.innerHTML = '';
        data.clients.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.name} (${c.accountMasked})`;
          clientSelector.appendChild(opt);
        });
        updateClientDisplay(clientSelector.value);
      }
    }
  } catch (e) {
    console.warn('Usando configuración predeterminada de cliente');
  }
}

async function updateClientDisplay(clientId) {
  try {
    const res = await fetch(`/api?action=client-info&clientId=${clientId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.client) {
        displayClientName.textContent = data.client.name;
        displayBusinessName.textContent = data.client.businessName;
        displayAccountNumber.textContent = data.client.accountCredit;
      }
    }
  } catch (e) {}
}

function switchView(viewName) {
  viewIdle.classList.remove('active');
  viewWaiting.classList.remove('active');
  viewSuccess.classList.remove('active');

  if (viewName === 'waiting') viewWaiting.classList.add('active');
  else if (viewName === 'success') viewSuccess.classList.add('active');
  else viewIdle.classList.add('active');
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const amount = parseFloat(amountInput.value);
  const description = descInput.value.trim() || 'Cobro por Servicio';

  if (!amount || isNaN(amount) || amount <= 0) {
    alert('Ingresa un monto válido mayor a 0');
    return;
  }

  btnGenerate.classList.add('loading');
  btnGenerate.disabled = true;

  try {
    const response = await fetch('/api?action=generate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Client-Id': state.selectedClientId
      },
      body: JSON.stringify({
        amount: amount,
        description: description,
        clientId: state.selectedClientId
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Error al generar el QR en el Banco');
    }

    state.activeQrId = data.qrId;
    state.activeAmount = amount;
    state.activeDesc = description;

    qrImageElement.src = `data:image/png;base64,${data.qrImage}`;
    waitingAmount.textContent = `Bs. ${amount.toFixed(2)}`;
    waitingDesc.textContent = description;

    switchView('waiting');
    startPolling(data.qrId, state.selectedClientId);

  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    btnGenerate.classList.remove('loading');
    btnGenerate.disabled = false;
  }
}

function startPolling(qrId, clientId) {
  stopPolling();

  state.pollSeconds = 0;
  pollCounter.textContent = '0';

  state.counterInterval = setInterval(() => {
    state.pollSeconds += 1;
    pollCounter.textContent = state.pollSeconds;
  }, 1000);

  state.pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api?action=status&qrId=${qrId}&clientId=${clientId}`);
      if (!res.ok) return;

      const data = await res.json();

      if (data.success && data.isPaid) {
        stopPolling();
        triggerConfetti();
        showReceipt(data.payment);
      }
    } catch (err) {
      console.warn('Verificando conexión...', err);
    }
  }, 3000);
}

function stopPolling() {
  if (state.pollInterval) {
    clearInterval(state.pollInterval);
    state.pollInterval = null;
  }
  if (state.counterInterval) {
    clearInterval(state.counterInterval);
    state.counterInterval = null;
  }
}

function cancelPayment() {
  stopPolling();
  state.activeQrId = null;
  switchView('idle');
}

function resetToIdle() {
  stopPolling();
  state.activeQrId = null;
  amountInput.value = '';
  switchView('idle');
  amountInput.focus();
}

function showReceipt(payment) {
  switchView('success');

  const p = payment || {};
  receiptAmount.textContent = (p.amount || state.activeAmount).toFixed(2);

  const bankCode = String(p.senderBankCode || '');
  const bankName = BANCOS_BOLIVIA[bankCode] || (bankCode ? `Banco ASFI ${bankCode}` : 'Banca Móvil Nacional');
  receiptBank.textContent = bankName;

  receiptPayer.textContent = p.senderName || 'Cliente Autenticado';
  receiptAccount.textContent = p.senderAccount || '****** (Ofuscada)';

  const date = p.paymentDate ? p.paymentDate.split('T')[0] : new Date().toLocaleDateString();
  const time = p.paymentTime || new Date().toLocaleTimeString();
  receiptDateTime.textContent = `${date} ${time}`;

  receiptTrx.textContent = p.transactionId || (state.activeQrId ? state.activeQrId.slice(-8) : '--');
  receiptQrId.textContent = state.activeQrId || '--';
}

function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#3b82f6', '#60a5fa', '#ffffff']
    });
  }
}
