// API SaaS Multi-Cliente y Multi-Usuario para Pasarela Banco Económico
const https = require('https');

// Catálogo de Cuentas / Clientes Registrados en el SaaS
// Puedes agregar clientes aquí o enviarlos de forma dinámica vía API / Headers / Query
const CLIENTS_DB = {
  // 1. Tu cuenta predeterminada
  default: {
    id: 'default',
    name: 'BRANDON ALEXANDER RODRIGUEZ',
    businessName: 'Soluciones Digitales (Default)',
    accountCredit: '1001730630',
    userName: 'A79766910',
    password: '1117',
    aesKey: '86E5A680C6CF4BD58298F5F485E036C2',
    baseUrl: 'https://apimkt.baneco.com.bo/ApiGateway'
  },
  // 2. Alias de tu cuenta
  brandon: {
    id: 'brandon',
    name: 'BRANDON ALEXANDER RODRIGUEZ',
    businessName: 'Soluciones Digitales Brandon',
    accountCredit: '1001730630',
    userName: 'A79766910',
    password: '1117',
    aesKey: '86E5A680C6CF4BD58298F5F485E036C2',
    baseUrl: 'https://apimkt.baneco.com.bo/ApiGateway'
  },
  // 3. Cliente Demo / Sandbox para pruebas
  demo: {
    id: 'demo',
    name: 'COMERCIO DEMO PRUEBAS',
    businessName: 'Tienda Virtual Demo S.R.L.',
    accountCredit: '1001730630',
    userName: 'A79766910',
    password: '1117',
    aesKey: '86E5A680C6CF4BD58298F5F485E036C2',
    baseUrl: 'https://apimkt.baneco.com.bo/ApiGateway'
  }
};

// Cache de tokens por cada cliente (para no re-autenticar innecesariamente)
const tokenCaches = {};

function getClientConfig(clientId, customCredentials) {
  // Si envían credenciales dinámicas en la petición (por ejemplo, desde un formulario o SaaS)
  if (customCredentials && customCredentials.accountCredit && customCredentials.aesKey && customCredentials.userName && customCredentials.password) {
    return {
      id: customCredentials.id || 'custom',
      name: customCredentials.name || 'Cliente Personalizado',
      businessName: customCredentials.businessName || 'Comercio Registrado',
      accountCredit: String(customCredentials.accountCredit).replace(/[^0-9]/g, ''),
      userName: String(customCredentials.userName).trim(),
      password: String(customCredentials.password).trim(),
      aesKey: String(customCredentials.aesKey).trim(),
      baseUrl: customCredentials.baseUrl || 'https://apimkt.baneco.com.bo/ApiGateway'
    };
  }

  const cid = (clientId || 'default').toLowerCase().trim();
  return CLIENTS_DB[cid] || CLIENTS_DB['default'];
}

function banecoRequest(config, endpoint, method = 'GET', data = null, bearerToken = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.baseUrl + endpoint);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      rejectUnauthorized: false,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PasarelaSaaS/2.0.0'
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

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout de conexion con el Banco')); });
    req.on('error', err => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function encryptText(config, text) {
  const encodedText = encodeURIComponent(text);
  const result = await banecoRequest(config, `/api/authentication/encrypt?text=${encodedText}&aesKey=${config.aesKey}`);
  return typeof result === 'string' ? result : String(result);
}

async function getAuthToken(config) {
  const cacheKey = `${config.userName}_${config.aesKey}`;
  const now = Date.now();

  if (tokenCaches[cacheKey] && tokenCaches[cacheKey].expiresAt > now + 60000) {
    return tokenCaches[cacheKey].token;
  }

  const encryptedPassword = await encryptText(config, config.password);
  const authResponse = await banecoRequest(config, '/api/authentication/authenticate', 'POST', {
    userName: config.userName,
    password: encryptedPassword
  });

  if (authResponse && authResponse.token && authResponse.responseCode === 0) {
    tokenCaches[cacheKey] = {
      token: authResponse.token,
      expiresAt: now + (20 * 60 * 1000)
    };
    return authResponse.token;
  }

  throw new Error(authResponse.message || 'Error de autenticacion con el Banco');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Id');

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
    // 1. LISTAR CLIENTES CONFIGURADOS (Para el Switcher de clientes en la interfaz)
    if (action === 'get-clients') {
      const list = Object.values(CLIENTS_DB).map(c => ({
        id: c.id,
        name: c.name,
        businessName: c.businessName,
        accountMasked: `******${c.accountCredit.slice(-4)}`
      }));
      return send(200, { success: true, clients: list });
    }

    // 2. OBTENER INFORMACIÓN DE UN CLIENTE ESPECÍFICO
    if (action === 'client-info') {
      const clientId = parsedUrl.searchParams.get('clientId') || 'default';
      const config = getClientConfig(clientId);
      return send(200, {
        success: true,
        client: {
          id: config.id,
          name: config.name,
          businessName: config.businessName,
          accountCredit: config.accountCredit,
          accountMasked: `******${config.accountCredit.slice(-4)}`
        }
      });
    }

    // 3. GENERAR CÓDIGO QR
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
      if (!amount || amount <= 0) {
        return send(400, { success: false, message: 'El monto debe ser un numero mayor a 0' });
      }

      // Obtener configuración del cliente solicitado
      const clientId = body.clientId || req.headers['x-client-id'] || parsedUrl.searchParams.get('clientId') || 'default';
      const clientConfig = getClientConfig(clientId, body.customCredentials);

      const token = await getAuthToken(clientConfig);
      const accountEnc = await encryptText(clientConfig, clientConfig.accountCredit);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const trxId = `TX-${Date.now()}`;

      const resp = await banecoRequest(clientConfig, '/api/qrsimple/generateQR', 'POST', {
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
          description: description,
          clientId: clientConfig.id,
          clientName: clientConfig.name,
          accountCredit: clientConfig.accountCredit
        });
      }
      return send(500, { success: false, message: resp.message || 'Error del Banco al generar QR' });
    }

    // 4. VERIFICAR ESTADO DEL QR (STATUS)
    const qrId = parsedUrl.searchParams.get('qrId');
    if (!qrId) return send(400, { success: false, message: 'qrId es requerido' });

    const clientId = parsedUrl.searchParams.get('clientId') || req.headers['x-client-id'] || 'default';
    const clientConfig = getClientConfig(clientId);

    const token = await getAuthToken(clientConfig);
    const resp = await banecoRequest(clientConfig, `/api/qrsimple/v2/statusQR/${qrId}`, 'GET', null, token);

    if (resp && resp.responseCode === 0) {
      const isPaid = resp.statusQrCode === 1;
      const paymentData = (resp.payment && resp.payment.length > 0) ? resp.payment[0] : null;
      return send(200, {
        success: true,
        qrId: qrId,
        status: resp.statusQrCode,
        statusLabel: isPaid ? 'PAGADO' : 'PENDIENTE',
        isPaid: isPaid,
        payment: paymentData,
        client: {
          id: clientConfig.id,
          name: clientConfig.name,
          accountCredit: clientConfig.accountCredit
        }
      });
    }
    return send(500, { success: false, message: resp.message || 'Error verificando QR en el banco' });

  } catch (error) {
    return send(500, { success: false, message: error.message });
  }
};
