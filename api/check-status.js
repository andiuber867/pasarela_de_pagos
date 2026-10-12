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
    // Tomar qrId de los query params
    const qrId = req.query.qrId || (req.url.split('/').pop().split('?')[0]);

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
