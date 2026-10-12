const { checkQRStatus } = require('./banecoService');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let qrId = null;
    if (req.query && req.query.qrId) {
      qrId = req.query.qrId;
    } else {
      const urlObj = new URL(req.url, 'http://localhost');
      qrId = urlObj.searchParams.get('qrId') || urlObj.pathname.split('/').filter(Boolean).pop();
      if (qrId === 'check-status') qrId = null;
    }

    if (!qrId) {
      return res.status(400).json({
        success: false,
        message: 'Parámetro qrId es requerido'
      });
    }

    const result = await checkQRStatus(qrId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error verificando QR:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error al verificar estado del QR'
    });
  }
};
