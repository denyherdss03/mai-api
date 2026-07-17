/**
 * api/webhook.js
 * Webhook del bot de Telegram.
 * Maneja callbacks de botones (verificado/rechazado)
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Metodo no permitido.' });
  }

  try {
    const body = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // MANEJAR CALLBACK_QUERY (cuando presionas los botones)
    if (body?.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackId = callbackQuery.id;
      const data = callbackQuery.data;
      const message = callbackQuery.message;
      const messageId = message.message_id;
      const chatId = message.chat.id;
      const messageText = message.caption || message.text || '';
      const hasPhoto = Boolean(message.photo);

      // Extraer el order_id del mensaje
      const orderMatch = messageText.match(/MAI-[A-Z0-9]+/i);
      if (!orderMatch) {
        await respondToCallback(botToken, callbackId, 'No se encontro el ID del pedido.');
        return res.status(200).json({ ok: true });
      }

      const orderId = orderMatch[0].toUpperCase();

      // Buscar datos del pedido en Supabase
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      );

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('jugador, id_jugador, producto, precio')
        .eq('order_id', orderId)
        .single();

      const jugador = pedido?.jugador || 'Desconocido';
      const idJugador = pedido?.id_jugador || 'Desconocido';
      const producto = pedido?.producto || 'Desconocido';
      const precio = pedido?.precio || 'Desconocido';

      let newStatus = '';
      let responseText = '';
      let editedCaption = '';

      if (data.startsWith('verificado:')) {
        newStatus = 'completado';
        responseText = 'Pago VERIFICADO correctamente.';
        editedCaption =
          'PAGO VERIFICADO\n\n' +
          'Pedido: `' + orderId + '`\n' +
          'Jugador: ' + jugador + '\n' +
          'ID Jugador: `' + idJugador + '`\n' +
          'Producto: ' + producto + '\n' +
          'Precio: ' + precio + '\n' +
          'Estado: COMPLETADO\n\n' +
          'El cliente vera COMPRA EXITOSA en la pagina.';
      } else if (data.startsWith('invalido:')) {
        newStatus = 'rechazado';
        responseText = 'Pago RECHAZADO.';
        editedCaption =
          'PAGO RECHAZADO\n\n' +
          'Pedido: `' + orderId + '`\n' +
          'Jugador: ' + jugador + '\n' +
          'ID Jugador: `' + idJugador + '`\n' +
          'Producto: ' + producto + '\n' +
          'Precio: ' + precio + '\n' +
          'Estado: RECHAZADO\n\n' +
          'El cliente vera PAGO RECHAZADO en la pagina.';
      } else {
        await respondToCallback(botToken, callbackId, 'Accion desconocida.');
        return res.status(200).json({ ok: true });
      }

      // Actualizar estado en Supabase
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: newStatus })
        .eq('order_id', orderId);

      if (error) {
        console.error('Error actualizando pedido:', error);
        await respondToCallback(botToken, callbackId, 'Error al actualizar en BD.');
        return res.status(200).json({ ok: true });
      }

      // Responder al callback
      await respondToCallback(botToken, callbackId, responseText);

      // Editar el mensaje original para quitar botones
      const editEndpoint = hasPhoto ? 'editMessageCaption' : 'editMessageText';
      const editBody = hasPhoto
        ? { chat_id: chatId, message_id: messageId, caption: editedCaption, parse_mode: 'Markdown' }
        : { chat_id: chatId, message_id: messageId, text: editedCaption, parse_mode: 'Markdown' };

      await fetch('https://api.telegram.org/bot' + botToken + '/' + editEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBody),
      });

      return res.status(200).json({ ok: true });
    }

    // MANEJAR MENSAJES DE TEXTO (compatibilidad)
    const message = body?.message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const text = message.text.toLowerCase().trim();
    const match = text.match(/pedido\s+(mai-[a-z0-9]+)\s+verificado\s+y\s+pagado/i);

    if (!match) {
      return res.status(200).json({ ok: true });
    }

    const orderId = match[1].toUpperCase();

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    // Buscar datos del pedido
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('jugador, id_jugador, producto, precio')
      .eq('order_id', orderId)
      .single();

    const jugador = pedido?.jugador || 'Desconocido';
    const idJugador = pedido?.id_jugador || 'Desconocido';
    const producto = pedido?.producto || 'Desconocido';
    const precio = pedido?.precio || 'Desconocido';

    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'completado' })
      .eq('order_id', orderId);

    if (error) {
      console.error('Error actualizando pedido:', error);
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;

    await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text:
          'PAGO VERIFICADO\n\n' +
          'Pedido: `' + orderId + '`\n' +
          'Jugador: ' + jugador + '\n' +
          'ID Jugador: `' + idJugador + '`\n' +
          'Producto: ' + producto + '\n' +
          'Precio: ' + precio + '\n' +
          'Estado: COMPLETADO\n\n' +
          'El cliente vera COMPRA EXITOSA en la pagina.',
        parse_mode: 'Markdown',
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error en webhook:', error);
    return res.status(200).json({ ok: true });
  }
}

async function respondToCallback(botToken, callbackId, text) {
  try {
    await fetch('https://api.telegram.org/bot' + botToken + '/answerCallbackQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text,
        show_alert: false,
      }),
    });
  } catch (error) {
    console.error('Error respondiendo callback:', error);
  }
}
