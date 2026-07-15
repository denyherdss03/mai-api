/**
 * lib/telegram.js
 * EnvÃ­a el mensaje de "NUEVO PEDIDO" al grupo de Telegram,
 * con botones VERIFICADO/NO VÃLIDO y con el cÃ³digo de pedido
 * y el ID del jugador en formato copiable (Markdown).
 */

/**
 * EnvÃ­a un pedido nuevo al grupo de Telegram con botones inline.
 * @param {Object} order - datos del pedido
 * @param {string} order.orderId
 * @param {string} order.producto
 * @param {number|string} order.precio
 * @param {string} order.jugador
 * @param {string} order.idJugador
 * @param {string} order.fecha
 * @param {string} order.hora
 */
export async function sendOrderToTelegram(order) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const { orderId, producto, precio, jugador, idJugador, fecha, hora, imageBuffer, imageName } = order;

  // Las comillas invertidas ` ` hacen que Telegram muestre el texto
  // en formato monoespaciado y "tocar para copiar" en mÃ³vil.
  const caption =
    `ðŸ›’ *NUEVO PEDIDO*\n` +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
    `ðŸ“¦ *Pedido:* \`${orderId}\`\n` +
    `ðŸŽ® *Producto:* ${producto}\n` +
    `ðŸ’° *Precio:* S/${precio}\n` +
    `ðŸ‘¤ *Jugador:* ${jugador}\n` +
    `ðŸ†” *ID Jugador:* \`${idJugador}\`\n` +
    `ðŸ“… *Fecha:* ${fecha}\n` +
    `â° *Hora:* ${hora}\n` +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
    `ðŸŸ¡ *Estado:* PENDIENTE`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: 'âœ… VERIFICADO Y PAGADO', callback_data: 'verificado_pagado' },
        { text: 'ðŸ”´ PAGO NO VÃLIDO', callback_data: 'pago_invalido' },
      ],
    ],
  };

  let response;

  if (imageBuffer) {
    // Enviamos el comprobante como foto, con el pedido en el caption
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', caption);
    formData.append('parse_mode', 'Markdown');
    formData.append('reply_markup', JSON.stringify(replyMarkup));
    formData.append('photo', new Blob([imageBuffer]), imageName || 'comprobante.jpg');

    response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
  } else {
    // Fallback: si no hay imagen, mandamos solo texto
    response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });
  }

  const data = await response.json();

  if (!data.ok) {
    console.error('Error enviando mensaje a Telegram:', data);
    throw new Error('No se pudo enviar el pedido a Telegram: ' + (data.description || 'error desconocido'));
  }

  return data;
}
