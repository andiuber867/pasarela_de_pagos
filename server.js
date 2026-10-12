const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const generateQrHandler = require('./api/generate-qr');
const checkStatusHandler = require('./api/check-status');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Adaptador Vercel Serverless -> Node HTTP Nativo
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  };
  req.query = parsedUrl.query;

  // Ruta 1: Generar QR
  if (pathname === '/api/generate-qr') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }
      await generateQrHandler(req, res);
    });
    return;
  }

  // Ruta 2: Verificar Estado
  if (pathname.startsWith('/api/check-status')) {
    const parts = pathname.split('/');
    if (parts.length >= 4 && parts[3]) {
      req.query.qrId = parts[3];
    }
    await checkStatusHandler(req, res);
    return;
  }

  // Servir archivos estáticos de /public
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Seguridad básica: evitar path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Acceso denegado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Pasarela de Pagos Banco Económico ACTIVA`);
  console.log(`🌐 Servidor local: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
