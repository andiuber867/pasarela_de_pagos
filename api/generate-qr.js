const { generatePaymentQR } = require('./banecoService');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const { amount, description, transactionId } = body || {};

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe ingresar un monto válido mayor a 0 (ej. 10.50)'
      });
    }

    const result = await generatePaymentQR({
      amount: parseFloat(amount),
      description: description || 'Pago de servicio',
      transactionId: transactionId
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error generando QR:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error interno al generar código QR'
    });
  }
};
