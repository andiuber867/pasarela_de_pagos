# 💳 Pasarela de Pagos QR Interoperable (Banco Económico - Bolivia)

Pasarela de pagos web modular, ultra-rápida y ligera para cobros mediante Códigos QR con acreditación en tiempo real utilizando la API oficial de **Banco Económico S.A.** (Red Pago Simple del BCB).

## ✨ Características

- ⚡ **Generación Dinámica de QR:** Permite ingresar cualquier monto en Bolivianos (BOB) y genera un QR interoperable al instante.
- 🔄 **Verificación en Tiempo Real:** Sondea el estado del pago cada 3 segundos contra el core bancario.
- 🟢 **Confirmación Instantánea y Recibo:** Al recibir el pago desde cualquier banco de Bolivia (BNB, BCP, BancoSol, Unión, etc.), la pantalla cambia a verde con confeti y despliega el recibo detallado con titular, banco origen, hora y código de transacción.
- 📦 **Cero dependencias pesadas:** Construido usando JavaScript nativo (módulos HTTPS de Node.js).
- ☁️ **Listo para desplegar en Vercel:** Incluye configuración de funciones Serverless en `vercel.json` y carpeta `/api`.

---

## 📁 Estructura del Proyecto

```text
d:/Pasarela de Pagos/
├── api/
│   ├── banecoService.js     # Módulo central con encriptación AES-256 y consumo de Baneco
│   ├── generate-qr.js       # Serverless function / API: POST /api/generate-qr
│   └── check-status.js      # Serverless function / API: GET /api/check-status
├── public/
│   ├── index.html           # Interfaz fintech moderna y responsiva
│   ├── style.css            # Estilos oscuros elegantes con animaciones y scanner
│   └── app.js               # Controlador del frontend y polling en tiempo real
├── server.js                # Servidor local Node.js para pruebas sin dependencias
├── vercel.json              # Configuración lista para producción en Vercel
└── package.json             # Manifiesto del proyecto
```

---

## 🚀 Cómo Ejecutar Localmente

Solo necesitas tener instalado Node.js:

```bash
node server.js
```

Abre en tu navegador:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ☁️ Despliegue en Vercel

1. Sube esta carpeta a tu repositorio en GitHub o ejecuta mediante el CLI de Vercel:
   ```bash
   npx vercel
   ```
2. *(Opcional)* Puedes configurar en las variables de entorno de tu proyecto en el dashboard de Vercel las siguientes keys:
   - `BANECO_BASE_URL`: `https://apimkt.baneco.com.bo/ApiGateway`
   - `BANECO_AES_KEY`: Tu llave de cifrado proporcionada por el banco
   - `BANECO_USER`: Tu usuario asignado (`A79766910`)
   - `BANECO_PASSWORD`: Tu PIN / contraseña de API
   - `BANECO_ACCOUNT`: Tu cuenta de abonos sin guiones (`1001730630`)
