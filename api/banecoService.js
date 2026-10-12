/**
 * Módulo de integración con API Market del Banco Económico (Bolivia)
 * Arquitectura modular y segura con cero dependencias externas (utiliza https nativo de Node.js)
 */

const https = require('https');

const BANECO_CONFIG = {
  baseUrl: process.env.BANECO_BASE_URL || 'https://apimkt.baneco.com.bo/ApiGateway',
  aesKey: process.env.BANECO_AES_KEY || '86E5A680C6CF4BD58298F5F485E036C2',
  userName: process.env.BANECO_USER || 'A79766910',
  password: process.env.BANECO_PASSWORD || '1117',
  accountCredit: process.env.BANECO_ACCOUNT || '1001730630'
};

// Cache de Bearer Token en memoria (para no autenticar en cada request innecesariamente)
let tokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * Petición HTTPS genérica para la API de Baneco
 */
function banecoRequest(endpoint, method = 'GET', data = null, bearerToken = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BANECO_CONFIG.baseUrl + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PasarelaPagos/1.0.0'
      },
      timeout: 15000
    };

    let postData = null;
    if (data) {
      postData = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (bearerToken) {
      options.headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          // A veces los endpoints encrypt devuelven strings con comillas
          const clean = body.trim().replace(/^"|"$/g, '');
          resolve(clean);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout de conexión con Banco Económico'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Cifra un texto utilizando el endpoint de seguridad de Baneco con la llave AES-256
 */
async function encryptText(text) {
  const encodedText = encodeURIComponent(text);
  const result = await banecoRequest(
    `/api/authentication/encrypt?text=${encodedText}&aesKey=${BANECO_CONFIG.aesKey}`,
    'GET'
  );
  return typeof result === 'string' ? result : String(result);
}

/**
 * Obtiene un Bearer Token válido
 */
async function getAuthToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token;
  }

  const encryptedPassword = await encryptText(BANECO_CONFIG.password);
  const authResponse = await banecoRequest('/api/authentication/authenticate', 'POST', {
    userName: BANECO_CONFIG.userName,
    password: encryptedPassword
  });

  if (authResponse && authResponse.token && authResponse.responseCode === 0) {
    tokenCache.token = authResponse.token;
    // Expiración por defecto 20 minutos
    tokenCache.expiresAt = now + (20 * 60 * 1000);
    return authResponse.token;
  }

  throw new Error(authResponse.message || 'Error de autenticación con Banco Económico');
}

/**
 * Genera un código QR dinámico de cobro
 */
async function generatePaymentQR({ amount, description, transactionId }) {
  const token = await getAuthToken();
  const encryptedAccount = await encryptText(BANECO_CONFIG.accountCredit);

  // Fecha de vencimiento: 24 horas después
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dueDate = tomorrow.toISOString().split('T')[0];

  const trxId = transactionId || `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const payload = {
    transactionId: trxId,
    accountCredit: encryptedAccount,
    currency: 'BOB',
    amount: parseFloat(amount),
    description: description || 'Cobro mediante Pasarela QR',
    dueDate: dueDate,
    singleUse: true,
    modifyAmount: false
  };

  const response = await banecoRequest('/api/qrsimple/generateQR', 'POST', payload, token);

  if (response && response.responseCode === 0 && response.qrId) {
    return {
      success: true,
      qrId: response.qrId,
      qrImage: response.qrImage,
      transactionId: trxId,
      amount: parseFloat(amount),
      description: payload.description,
      dueDate: dueDate,
      currency: 'BOB'
    };
  }

  throw new Error(response.message || 'Error al generar el QR con el banco');
}

/**
 * Consulta el estado de un QR en tiempo real
 */
async function checkQRStatus(qrId) {
  const token = await getAuthToken();
  const response = await banecoRequest(`/api/qrsimple/v2/statusQR/${qrId}`, 'GET', null, token);

  if (response && response.responseCode === 0) {
    /**
     * statusQrCode:
     * 0: Activo / Pendiente de pago
     * 1: Pagado
     * 9: Anulado
     */
    const isPaid = response.statusQrCode === 1;
    const paymentData = (response.payment && response.payment.length > 0) ? response.payment[0] : null;

    return {
      success: true,
      qrId: qrId,
      status: response.statusQrCode,
      statusLabel: isPaid ? 'PAGADO' : (response.statusQrCode === 9 ? 'ANULADO' : 'PENDIENTE'),
      isPaid: isPaid,
      payment: paymentData
    };
  }

  throw new Error(response.message || 'Error al consultar el estado del QR');
}

module.exports = {
  BANECO_CONFIG,
  encryptText,
  getAuthToken,
  generatePaymentQR,
  checkQRStatus
};
