/**
 * Frontend de la Pasarela de Cobros QR
 * Banco Económico - Pagos Simple Interoperables
 */

// Catálogo de bancos de Bolivia según código ASFI
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

// Estado de la aplicación
const state = {
  activeQrId: null,
  activeAmount: 0,
  activeDesc: '',
  pollInterval: null,
  pollSeconds: 0,
  counterInterval: null
};

// Elementos del DOM
const paymentForm = document.getElementById('paymentForm');
const amountInput = document.getElementById('amountInput');
const descInput = document.getElementById('descInput');
const btnGenerate = document.getElementById('btnGenerate');
const quickBtns = document.querySelectorAll('.quick-btn');

// Vistas
const viewIdle = document.getElementById('viewIdle');
const viewWaiting = document.getElementById('viewWaiting');
const viewSuccess = document.getElementById('viewSuccess');

// Elementos de Espera
const qrImageElement = document.getElementById('qrImageElement');
const waitingAmount = document.getElementById('waitingAmount');
const waitingDesc = document.getElementById('waitingDesc');
const pollCounter = document.getElementById('pollCounter');
const btnCancelQR = document.getElementById('btnCancelQR');

// Elementos del Recibo
const receiptAmount = document.getElementById('receiptAmount');
const receiptBank = document.getElementById('receiptBank');
const receiptPayer = document.getElementById('receiptPayer');
const receiptAccount = document.getElementById('receiptAccount');
const receiptDateTime = document.getElementById('receiptDateTime');
const receiptTrx = document.getElementById('receiptTrx');
const receiptQrId = document.getElementById('receiptQrId');
const btnNewPayment = document.getElementById('btnNewPayment');

// Inicialización de eventos
document.addEventListener('DOMContentLoaded', () => {
  // Botones de monto rápido
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      amountInput.value = parseFloat(btn.dataset.val).toFixed(2);
      amountInput.focus();
    });
  });

  // Envío de formulario
  paymentForm.addEventListener('submit', handleFormSubmit);

  // Botón cancelar
  btnCancelQR.addEventListener('click', cancelPayment);

  // Botón nuevo pago
  btnNewPayment.addEventListener('click', resetToIdle);
});

/**
 * Cambiar entre vistas de la pasarela
 */
function switchView(viewName) {
  viewIdle.classList.remove('active');
  viewWaiting.classList.remove('active');
  viewSuccess.classList.remove('active');

  if (viewName === 'waiting') viewWaiting.classList.add('active');
  else if (viewName === 'success') viewSuccess.classList.add('active');
  else viewIdle.classList.add('active');
}

/**
 * Procesar solicitud de nuevo cobro
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const amount = parseFloat(amountInput.value);
  const description = descInput.value.trim() || 'Cobro por Servicio';

  if (!amount || isNaN(amount) || amount <= 0) {
    alert('Por favor ingresa un monto válido mayor a 0');
    return;
  }

  // Activar loader en el botón
  btnGenerate.classList.add('loading');
  btnGenerate.disabled = true;

  try {
    const response = await fetch('/api/generate-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        description: description
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Error al generar el QR con el banco');
    }

    // Configurar estado
    state.activeQrId = data.qrId;
    state.activeAmount = amount;
    state.activeDesc = description;

    // Pintar datos en la vista de espera
    qrImageElement.src = `data:image/png;base64,${data.qrImage}`;
    waitingAmount.textContent = `Bs. ${amount.toFixed(2)}`;
    waitingDesc.textContent = description;

    switchView('waiting');
    startPolling(data.qrId);

  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    btnGenerate.classList.remove('loading');
    btnGenerate.disabled = false;
  }
}

/**
 * Iniciar el chequeo en tiempo real con el Banco
 */
function startPolling(qrId) {
  stopPolling();

  state.pollSeconds = 0;
  pollCounter.textContent = '0';

  // Contador de segundos
  state.counterInterval = setInterval(() => {
    state.pollSeconds += 1;
    pollCounter.textContent = state.pollSeconds;
  }, 1000);

  // Consulta al banco cada 3 segundos
  state.pollInterval = setInterval(async () => {
    try {
      let res = await fetch(`/api/check-status?qrId=${qrId}`);
      if (!res.ok) {
        res = await fetch(`/api/check-status/${qrId}`);
      }
      if (!res.ok) return;

      const data = await res.json();

      if (data.success && data.isPaid) {
        // ¡PAGADO CON ÉXITO!
        stopPolling();
        triggerSuccessCelebration();
        showReceipt(data.payment);
      }
    } catch (err) {
      console.warn('Fallo momentáneo de verificación de red:', err);
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

/**
 * Mostrar pantalla de éxito y recibo bancario
 */
function showReceipt(payment) {
  switchView('success');

  const p = payment || {};
  receiptAmount.textContent = (p.amount || state.activeAmount).toFixed(2);

  // Identificar banco emisor
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

/**
 * Animación de confeti de victoria
 */
function triggerSuccessCelebration() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#0066ff', '#ffffff']
    });
  }
}
