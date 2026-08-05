/**
 * api/order.js
 * Endpoint: POST /api/order
 * La IA verifica ANTES de enviar a Telegram.
 * Si no es comprobante valido, el pedido se rechaza y NO llega a Telegram.
 */

import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

import { handleCors, checkRateLimit } from '../utils/cors.js';
import { validateOrderFields, validateImageFile, validateProductoExists, PRECIOS } from '../utils/validator.js';
import { sendOrderToTelegram } from '../lib/telegram.js';

export const config = { api: { bodyParser: false } };

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: MAX_FILE_SIZE, multiples: false, keepExtensions: true });
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
  return 'MAI-' + uuid.substring(0, 8);
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
    try { fs.unlinkSync(file.filepath); } catch (e) {}
  }
}

/**
 * Verifica si la imagen es un comprobante de pago válido.
 * Se ejecuta ANTES de enviar a Telegram.
 * Timeout de 25 segundos para no bloquear al cliente.
 */
async function verificarComprobante(imageBuffer, mimeType) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const base64Image = imageBuffer.toString('base64');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: `Eres un sistema de verificacion de comprobantes de pago para una tienda peruana de recargas de videojuegos Free Fire.

Tu unica tarea es determinar si la imagen es un comprobante de pago de dinero real.

UN COMPROBANTE DE PAGO VALIDO debe mostrar CLARAMENTE:
- Nombre de una app de pagos o banco: Yape, Plin, BCP, Interbank, BBVA, Scotiabank, Agora, Lemon Cash, Dale, Lukita, Tunki, o cualquier banco o billetera digital
- Un monto de dinero en soles o dolares
- Una fecha y hora de la transaccion
- Un numero de operacion o codigo de transaccion

TAMBIEN ES VALIDO: foto tomada con camara a una pantalla de celular que muestre claramente un comprobante de pago real con los datos mencionados arriba.

RECHAZA TODO lo que no sea comprobante de pago, SIN EXCEPCION:
- Fotos de personas, rostros, cuerpos humanos
- Contenido sexual, pornografico o inapropiado de cualquier tipo
- Documentos de identidad (DNI, pasaporte, licencia)
- Animales, mascotas, naturaleza, paisajes
- Capturas de chats (WhatsApp, Telegram, Messenger)
- Capturas de redes sociales (Instagram, TikTok, Facebook, Twitter)
- Memes, GIFs, imagenes graciosas o de humor
- Dibujos, ilustraciones, anime, caricaturas, imagenes animadas
- Capturas de videojuegos o aplicaciones que no sean de pagos
- Imagenes de QR sin datos de transaccion visible
- Fotos de productos, objetos, ropa, comida, bebidas
- Publicidad, logos o imagenes de marcas sin transaccion
- Cualquier imagen que NO muestre una transaccion de dinero completada

IMPORTANTE: Si tienes CUALQUIER duda, responde NO. Es mejor rechazar una imagen dudosa que aceptar contenido inapropiado.

Responde UNICAMENTE: SI (si es comprobante valido) o NO (si no lo es).`,
          },
        ],
      }],
    });

    clearTimeout(timeout);
    const respuesta = response.content[0].text.trim().toUpperCase();
    console.log('IA verificacion: ' + respuesta);
    return respuesta.startsWith('SI');

  } catch (error) {
    // Si la IA falla por timeout u otro error, rechazar por seguridad
    console.error('Error IA verificacion:', error.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    return res.status(429).json({ success: false, error: rateLimit.error });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Metodo no permitido.' });
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return res.status(400).json({ success: false, error: 'Content-Type invalido.' });
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

    // ✅ VERIFICAR CON IA ANTES DE ENVIAR A TELEGRAM
    const esComprobanteValido = await verificarComprobante(imageBuffer, mimeType);

    if (!esComprobanteValido) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({
        success: false,
        error: 'No se encontró un comprobante de pago válido en la imagen. Por favor sube una captura o foto de tu pago realizado en Yape, Plin u otra billetera digital. Asegúrate de que se vea claramente el monto, fecha y número de operación.',
      });
    }

    // ✅ Solo si la IA aprueba → guardar y enviar a Telegram
    const orderId = generateOrderId();
    const { fecha, hora } = getFormattedDateTime();

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

    await supabase.from('pedidos').insert([{
      order_id: orderId,
      producto,
      precio,
      jugador,
      id_jugador: idJugador,
      estado: 'pendiente',
      fecha,
      hora,
    }]);

    await sendOrderToTelegram({
      orderId, producto, precio, jugador, idJugador, fecha, hora,
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
    console.error('Error procesando pedido:', error);
    cleanupTempFile(comprobanteFile);
    if (error?.code === 1009 || /maxFileSize/i.test(error?.message || '')) {
      return res.status(400).json({ success: false, error: 'El comprobante supera los 5 MB.' });
    }
    return res.status(500).json({ success: false, error: 'Error interno del servidor. Intenta nuevamente.' });
  }
}
