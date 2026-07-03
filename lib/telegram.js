/**
 * lib/telegram.js
 * ---------------------------------------------------------------------
 * Integración con la API de Telegram Bot.
 * Se encarga de enviar el pedido (con o sin imagen) al grupo privado
 * configurado mediante variables de entorno.
 * ---------------------------------------------------------------------
 */

import axios from 'axios';
import FormData from 'form-data';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Construye el texto (caption) del pedido con el formato solicitado.
 * @param {object} orderData
 * @returns {string}
 */
function buildOrderCaption({ orderId, producto, precio, jugador, idJugador, fecha, hora }) {
  return [
    '🛒 NUEVO PEDIDO',
    '━━━━━━━━━━━━━━━━━━',
    'Pedido:',
    orderId,
    '',
    'Producto:',
    producto,
    '',
    'Precio:',
    precio,
    '',
    'ID:',
    idJugador,
    '',
    'Jugador:',
    jugador,
    '',
    'Fecha:',
    fecha,
    'Hora:',
    hora,
    '━━━━━━━━━━━━━━━━━━',
    'Estado:',
    '🟡 PENDIENTE',
  ].join('\n');
}

/**
 * Punto de entrada principal: envía el pedido al grupo de Telegram.
 * Usa sendPhoto si hay imagen disponible, o sendMessage como respaldo.
 *
 * @param {object} orderData
 * @param {string} orderData.orderId
 * @param {string} orderData.producto
 * @param {string} orderData.precio
 * @param {string} orderData.jugador
 * @param {string} orderData.idJugador
 * @param {string} orderData.fecha
 * @param {string} orderData.hora
 * @param {Buffer} [orderData.imageBuffer]
 * @param {string} [orderData.imageName]
 */
export async function sendOrderToTelegram(orderData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error(
      'Variables de entorno de Telegram no configuradas (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).'
    );
  }

  const caption = buildOrderCaption(orderData);
  const { imageBuffer, imageName } = orderData;

  if (imageBuffer && imageBuffer.length > 0) {
    await sendPhotoToTelegram({ botToken, chatId, caption, imageBuffer, imageName });
  } else {
    await sendMessageToTelegram({ botToken, chatId, caption });
  }
}

/**
 * Envía una foto con caption al grupo de Telegram usando sendPhoto.
 */
async function sendPhotoToTelegram({ botToken, chatId, caption, imageBuffer, imageName }) {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendPhoto`;

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('photo', imageBuffer, {
    filename: imageName || 'comprobante.jpg',
    contentType: 'image/jpeg',
  });

  try {
    await axios.post(url, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 15000,
    });
  } catch (error) {
    const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    throw new Error(`Error al enviar la foto a Telegram: ${details}`);
  }
}

/**
 * Envía un mensaje de texto plano al grupo de Telegram usando sendMessage.
 * Se usa como respaldo cuando no hay imagen disponible.
 */
async function sendMessageToTelegram({ botToken, chatId, caption }) {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

  try {
    await axios.post(
      url,
      {
        chat_id: chatId,
        text: caption,
      },
      { timeout: 15000 }
    );
  } catch (error) {
    const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    throw new Error(`Error al enviar el mensaje a Telegram: ${details}`);
  }
}
