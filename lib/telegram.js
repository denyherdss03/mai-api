/**
 * lib/telegram.js
 * Envia pedidos a Telegram con botones inline y codigos copiables.
 */

import axios from 'axios';
import FormData from 'form-data';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function buildOrderCaption({ orderId, producto, precio, jugador, idJugador, fecha, hora }) {
  return (
    'NUEVO PEDIDO\n' +
    '==================\n' +
    'Pedido: `' + orderId + '`\n' +
    'Producto: ' + producto + '\n' +
    'Precio: ' + precio + '\n' +
    'Jugador: ' + jugador + '\n' +
    'ID Jugador: `' + idJugador + '`\n' +
    'Fecha: ' + fecha + '\n' +
    'Hora: ' + hora + '\n' +
    '==================\n' +
    'Estado: PENDIENTE'
  );
}

function buildInlineKeyboard(orderId) {
  return {
    inline_keyboard: [
      [
        { text: 'VERIFICADO Y PAGADO', callback_data: 'verificado:' + orderId },
        { text: 'PAGO NO VALIDO', callback_data: 'invalido:' + orderId },
      ],
    ],
  };
}

export async function sendOrderToTelegram(orderData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Variables de entorno de Telegram no configuradas.');
  }

  const caption = buildOrderCaption(orderData);
  const replyMarkup = buildInlineKeyboard(orderData.orderId);
  const { imageBuffer, imageName } = orderData;

  if (imageBuffer && imageBuffer.length > 0) {
    await sendPhotoToTelegram({ botToken, chatId, caption, imageBuffer, imageName, replyMarkup });
  } else {
    await sendMessageToTelegram({ botToken, chatId, caption, replyMarkup });
  }
}

async function sendPhotoToTelegram({ botToken, chatId, caption, imageBuffer, imageName, replyMarkup }) {
  const url = TELEGRAM_API_BASE + '/bot' + botToken + '/sendPhoto';
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('parse_mode', 'Markdown');
  form.append('reply_markup', JSON.stringify(replyMarkup));
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
    throw new Error('Error al enviar la foto a Telegram: ' + details);
  }
}

async function sendMessageToTelegram({ botToken, chatId, caption, replyMarkup }) {
  const url = TELEGRAM_API_BASE + '/bot' + botToken + '/sendMessage';
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: caption,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    }, { timeout: 15000 });
  } catch (error) {
    const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    throw new Error('Error al enviar el mensaje a Telegram: ' + details);
  }
}
