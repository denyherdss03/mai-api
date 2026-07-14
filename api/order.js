/**
 * api/order.js
 * Endpoint: POST /api/order
 * Recibe pedido, verifica comprobante con IA, guarda en Supabase y envia a Telegram.
 */

import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

import { handleCors } from '../utils/cors.js';
import { validateOrderFields, validateImageFile, validateProductoExists, PRECIOS } from '../utils/validator.js';
import { sendOrderToTelegram } from '../lib/telegram.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      multiples: false,
      keepExtensions: true,
    });
    form.parse(req, (err, fields, files) => {
      if (err) { reject(err); return; }
      resolve({ fields, files });
    });
  });
}

function normalizeField(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function generateOrderId() {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `MAI-${uuid.substring(0, 8)}`;
}

function getFormattedDateTime() {
  const now = new Date();
  const timeZone = 'America/Lima';
  const fecha = now.toLocaleDateString('es-PE', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = now.toLocaleTimeString('es-PE', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  return { fecha, hora };
}

function cleanupTempFile(file) {
  if (file && file.filepath) {
    try { fs.unlinkSync(file.filepath); } catch (e) { console.error('Error limpiando archivo:', e.message); }
  }
}

async function verificarComprobante(imageBuffer, mimeType) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const base64Image = imageBuffer.toString('base64');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Eres un verificador de comprobantes de pago para una tienda peruana. Analiza esta imagen y determina si muestra algun tipo de pago o transaccion de dinero. APRUEBA (responde SI) si la imagen muestra cualquiera de estos casos: 1) Captura de pantalla de Yape, Plin, BCP, Interbank, BBVA, Scotiabank, Agora, Lemon Cash, Dale, Lukita, Tunki u otra billetera o banco. 2) Foto tomada con camara a un celular o pantalla donde se vea un comprobante de pago, transferencia o transaccion de dinero. 3) Voucher o recibo de pago fotografiado. 4) Cualquier imagen que muestre una transaccion, transferencia o movimiento de dinero, aunque sea foto de baja calidad o tomada en angulo. RECHAZA (responde NO) solo si la imagen es claramente: meme, selfie, rostro de persona, paisaje, animal, comida, captura de videojuego, contenido sexual, contenido violento, logo sin contexto de pago, o cualquier imagen que definitivamente no tenga relacion con un pago o transaccion de dinero. En caso de duda, responde SI. Responde UNICAMENTE con SI o NO.',
            },
          ],
        },
      ],
    });

    const respuesta = response.content[0].text.trim().toUpperCase();
    return respuesta.startsWith('SI');

  } catch (error) {
    console.error('Error verificando comprobante con IA:', error);
    return true;
  }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  // Rate Limiting
  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: rateLimit.error
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Metodo no permitido. Solo se acepta POST.' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return res.status(400).json({ success: false, error: 'Content-Type invalido. Se requiere multipart/form-data.' });
  }

  let comprobanteFile = null;

  try {
    const { fields, files } = await parseForm(req);

    const producto = normalizeField(fields.producto)?.trim();
    const jugador = normalizeField(fields.jugador)?.trim();
    const idJugador = normalizeField(fields.idJugador)?.trim();
    comprobanteFile = normalizeField(files.comprobante);

    const productoValidation = validateProductoExists(producto);
    if (!productoValidation.valid) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({ success: false, error: productoValidation.error });
    }

    const precio = PRECIOS[producto];

    const fieldsValidation = validateOrderFields({ producto, precio, jugador, idJugador });
    if (!fieldsValidation.valid) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({ success: false, error: fieldsValidation.error });
    }

    const imageValidation = validateImageFile(comprobanteFile);
    if (!imageValidation.valid) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({ success: false, error: imageValidation.error });
    }

    const imageBuffer = fs.readFileSync(comprobanteFile.filepath);
    const mimeType = comprobanteFile.mimetype || 'image/jpeg';

    const esComprobante = await verificarComprobante(imageBuffer, mimeType);

    if (!esComprobante) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({
        success: false,
        error: 'La imagen no es un comprobante de pago valido. Por favor sube una captura o foto de tu pago realizado en Yape, Plin u otra billetera digital.',
      });
    }

    const orderId = generateOrderId();
    const { fecha, hora } = getFormattedDateTime();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const { error: dbError } = await supabase
      .from('pedidos')
      .insert([{
        order_id: orderId,
        producto,
        precio,
        jugador,
        id_jugador: idJugador,
        estado: 'pendiente',
        fecha,
        hora,
      }]);

    if (dbError) {
      console.error('Error guardando en Supabase:', dbError);
    }

    await sendOrderToTelegram({
      orderId,
      producto,
      precio,
      jugador,
      idJugador,
      fecha,
      hora,
      imageBuffer,
      imageName: comprobanteFile.originalFilename || 'comprobante.jpg',
    });

    cleanupTempFile(comprobanteFile);

    return res.status(200).json({
      success: true,
      message: 'Pedido enviado correctamente.',
      orderId,
      precio,
    });

  } catch (error) {
    console.error('Error procesando el pedido:', error);
    cleanupTempFile(comprobanteFile);

    if (error?.code === 1009 || /maxFileSize/i.test(error?.message || '')) {
      return res.status(400).json({ success: false, error: 'El comprobante supera el tamano maximo permitido (5 MB).' });
    }

    return res.status(500).json({ success: false, error: 'Error interno del servidor. Intenta nuevamente.' });
  }
}
