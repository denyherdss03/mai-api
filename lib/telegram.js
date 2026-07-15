/**
 * lib/telegram.js
 * Envía el mensaje de "NUEVO PEDIDO" al grupo de Telegram,
 * con botones VERIFICADO/NO VÁLIDO y con el código de pedido
 * y el ID del jugador en formato copiable (Markdown).
 */

/**
 * Envía un pedido nuevo al grupo de Telegram con botones inline.
 * @param {Object} order - datos del pedido
 * @param {string} order.orderId
 * @param {string} order.producto
 * @param {number|string} order.precio
 * @param {string} order.jugador
 * @param {string} order.idJugador
 * @param {string} order.fecha
 * @param {string} order.hora
 */
async function sendOrderToTelegram(order) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const { orderId, producto, precio, jugador, idJugador, fecha, hora } = order;

  // Las comillas invertidas ` ` hacen que Telegram muestre el texto
  // en formato monoespaciado y "tocar para copiar" en móvil.
  const text =
    `🛒 *NUEVO PEDIDO*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Pedido:* \`${orderId}\`\n` +
    `🎮 *Producto:* ${producto}\n` +
    `💰 *Precio:* S/${precio}\n` +
    `👤 *Jugador:* ${jugador}\n` +
    `🆔 *ID Jugador:* \`${idJugador}\`\n` +
    `📅 *Fecha:* ${fecha}\n` +
    `⏰ *Hora:* ${hora}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🟡 *Estado:* PENDIENTE`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ VERIFICADO Y PAGADO', callback_data: 'verificado_pagado' },
        { text: '🔴 PAGO NO VÁLIDO', callback_data: 'pago_invalido' },
      ],
    ],
  };

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    console.error('Error enviando mensaje a Telegram:', data);
    throw new Error('No se pudo enviar el pedido a Telegram: ' + (data.description || 'error desconocido'));
  }

  return data;
}

module.exports = { sendOrderToTelegram };
