const { checkQRStatus } = require('./banecoService');

module.exports = async (req, res) => {
  // Manejo de errores global para atrapar el error exacto y devolverlo en JSON
  try {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    let qrId = null;
    if (req.query && req.query.qrId) {
      qrId = req.query.qrId;
    } else {
      const urlObj = new URL(req.url, 'http://localhost');
      qrId = urlObj.searchParams.get('qrId') || urlObj.pathname.split('/').filter(Boolean).pop();
      if (qrId === 'check-status') qrId = null;
    }

    if (!qrId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Parámetro qrId es requerido' }));
      return;
    }

    const result = await checkQRStatus(qrId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      diagnostics: {
        errorName: err.name,
        errorMessage: err.message,
        errorStack: err.stack
      }
    }));
  }
};
