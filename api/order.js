/**
 * api/order.js
 * ---------------------------------------------------------------------
 * Endpoint: POST /api/order
 *
 * Recibe los datos de un pedido de recarga de Free Fire (producto,
 * precio, jugador, idJugador y comprobante de pago) enviados desde la
 * página web (Readdy AI), los valida y los reenvía automáticamente
 * al grupo privado de Telegram configurado.
 * ---------------------------------------------------------------------
 */

import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';

import { handleCors } from '../utils/cors.js';
import { validateOrderFields, validateImageFile, validateProductoExists } from '../utils/validator.js';
import { sendOrderToTelegram } from '../lib/telegram.js';

// Vercel no debe parsear el body: lo procesamos nosotros mismos
// con formidable, ya que la petición viene como multipart/form-data.
export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Parsea el body multipart/form-data de la petición usando formidable.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{fields: object, files: object}>}
 */
function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      multiples: false,
      keepExtensions: true,
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

/**
 * Normaliza un campo de formidable (puede llegar como array o string).
 */
function normalizeField(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Genera un ID único de pedido con formato MAI-XXXXXXXX
 * usando los primeros 8 caracteres de un UUID v4.
 * @returns {string}
 */
function generateOrderId() {
  const uuid = uuidv4().replace(/-/g, '').toUpperCase();
  return `MAI-${uuid.substring(0, 8)}`;
}

/**
 * Devuelve la fecha y hora actual formateadas (zona horaria Perú).
 * @returns {{fecha: string, hora: string}}
 */
function getFormattedDateTime() {
  const now = new Date();
  const timeZone = 'America/Lima';

  const fecha = now.toLocaleDateString('es-PE', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const hora = now.toLocaleTimeString('es-PE', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return { fecha, hora };
}

/**
 * Elimina de forma segura el archivo temporal creado por formidable.
 */
function cleanupTempFile(file) {
  if (file && file.filepath) {
    try {
      fs.unlinkSync(file.filepath);
    } catch (cleanupError) {
      console.error('No se pudo eliminar el archivo temporal:', cleanupError.message);
    }
  }
}

export default async function handler(req, res) {
  // --- CORS ---
  // Si es una petición OPTIONS (preflight), ya fue respondida aquí.
  if (handleCors(req, res)) {
    return;
  }

  // --- Solo se permite POST ---
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido. Solo se acepta POST.',
    });
  }

  // --- Validar Content-Type ---
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return res.status(400).json({
      success: false,
      error: 'Content-Type inválido. Se requiere multipart/form-data.',
    });
  }

  let comprobanteFile = null;

  try {
    // --- Parsear el formulario ---
    const { fields, files } = await parseForm(req);

    const producto = normalizeField(fields.producto)?.trim();
    const precio = normalizeField(fields.precio)?.trim();
    const jugador = normalizeField(fields.jugador)?.trim();
    const idJugador = normalizeField(fields.idJugador)?.trim();

    comprobanteFile = normalizeField(files.comprobante);

    // --- Validar campos de texto ---
    const fieldsValidation = validateOrderFields({ producto, precio, jugador, idJugador });
    if (!fieldsValidation.valid) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({ success: false, error: fieldsValidation.error });
    }

    // --- Validar que el producto exista en la tienda ---
    const productoValidation = validateProductoExists(producto);
    if (!productoValidation.valid) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({ success: false, error: productoValidation.error });
    }

    // --- Validar el comprobante de pago ---
    const imageValidation = validateImageFile(comprobanteFile);
    if (!imageValidation.valid) {
      cleanupTempFile(comprobanteFile);
      return res.status(400).json({ success: false, error: imageValidation.error });
    }

    // --- Generar identificador único del pedido ---
    const orderId = generateOrderId();
    const { fecha, hora } = getFormattedDateTime();

    // --- Leer la imagen del comprobante ---
    const imageBuffer = fs.readFileSync(comprobanteFile.filepath);

    // --- Enviar el pedido al grupo de Telegram ---
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

    // --- Limpiar archivo temporal ---
    cleanupTempFile(comprobanteFile);

    return res.status(200).json({
      success: true,
      message: 'Pedido enviado correctamente.',
      orderId,
    });
  } catch (error) {
    console.error('Error procesando el pedido:', error);
    cleanupTempFile(comprobanteFile);

    // Error específico de formidable cuando el archivo excede el límite
    if (error?.code === 1009 || /maxFileSize/i.test(error?.message || '')) {
      return res.status(400).json({
        success: false,
        error: 'El comprobante supera el tamaño máximo permitido (5 MB).',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor. Intenta nuevamente en unos minutos.',
    });
  }
}
