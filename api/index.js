// Endpoint único todo-en-uno para Vercel Serverless
const https = require('https');

const BANECO_CONFIG = {
  baseUrl: 'https://apimkt.baneco.com.bo/ApiGateway',
  aesKey: '86E5A680C6CF4BD58298F5F485E036C2',
  userName: 'A79766910',
  password: '1117',
  accountCredit: '1001730630'
};

let tokenCache = { token: null, expiresAt: 0 };

function banecoRequest(endpoint, method = 'GET', data = null, bearerToken = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BANECO_CONFIG.baseUrl + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      rejectUnauthorized: false,
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
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body.trim().replace(/^"|"$/g, ''));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout de conexion con Banco')); });
    req.on('error', err => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function encryptText(text) {
  const encodedText = encodeURIComponent(text);
  const result = await banecoRequest(`/api/authentication/encrypt?text=${encodedText}&aesKey=${BANECO_CONFIG.aesKey}`);
  return typeof result === 'string' ? result : String(result);
}

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
    tokenCache.expiresAt = now + (20 * 60 * 1000);
    return authResponse.token;
  }
  throw new Error(authResponse.message || 'Error de autenticacion con Banco');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const send = (code, data) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };

  const parsedUrl = new URL(req.url, 'http://localhost');
  const action = parsedUrl.searchParams.get('action') || (req.method === 'POST' ? 'generate' : 'status');

  try {
    if (action === 'generate' || (req.method === 'POST' && !parsedUrl.searchParams.get('qrId'))) {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
      } else if (!body) {
        body = await new Promise(resolve => {
          let buf = '';
          req.on('data', c => { buf += c; });
          req.on('end', () => {
            try { resolve(JSON.parse(buf)); } catch (e) { resolve({}); }
          });
        });
      }

      const amount = parseFloat(body.amount);
      const description = body.description || 'Cobro por Servicio';
      if (!amount || amount <= 0) return send(400, { success: false, message: 'Monto invalido' });

      const token = await getAuthToken();
      const accountEnc = await encryptText(BANECO_CONFIG.accountCredit);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const trxId = `TX-${Date.now()}`;

      const resp = await banecoRequest('/api/qrsimple/generateQR', 'POST', {
        transactionId: trxId,
        accountCredit: accountEnc,
        currency: 'BOB',
        amount: amount,
        description: description,
        dueDate: tomorrow,
        singleUse: true,
        modifyAmount: false
      }, token);

      if (resp && resp.responseCode === 0 && resp.qrId) {
        return send(200, {
          success: true,
          qrId: resp.qrId,
          qrImage: resp.qrImage,
          transactionId: trxId,
          amount: amount,
          description: description
        });
      }
      return send(500, { success: false, message: resp.message || 'Error al generar QR' });
    }

    // ACCIÓN STATUS
    const qrId = parsedUrl.searchParams.get('qrId');
    if (!qrId) return send(400, { success: false, message: 'qrId es requerido' });

    const token = await getAuthToken();
    const resp = await banecoRequest(`/api/qrsimple/v2/statusQR/${qrId}`, 'GET', null, token);

    if (resp && resp.responseCode === 0) {
      const isPaid = resp.statusQrCode === 1;
      const paymentData = (resp.payment && resp.payment.length > 0) ? resp.payment[0] : null;
      return send(200, {
        success: true,
        qrId: qrId,
        status: resp.statusQrCode,
        statusLabel: isPaid ? 'PAGADO' : 'PENDIENTE',
        isPaid: isPaid,
        payment: paymentData
      });
    }
    return send(500, { success: false, message: resp.message || 'Error verificando QR' });

  } catch (error) {
    return send(500, { success: false, message: error.message });
  }
};
