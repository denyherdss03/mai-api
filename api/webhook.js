/**
 * api/webhook.js
 * Webhook del bot de Telegram.
 * Maneja:
 * 1. Callbacks de botones (verificado/rechazado) sobre mensajes con foto (caption)
 * 2. Mensajes de texto antiguos (por compatibilidad)
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'MÃ©todo no permitido.' });
  }

  try {
    const body = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // ==================== MANEJAR CALLBACK_QUERY (BOTONES) ====================
    if (body?.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackId = callbackQuery.id;
      const data = callbackQuery.data; // "verificado_pagado" o "pago_invalido"
      const message = callbackQuery.message;
      const messageId = message.message_id;
      const chatId = message.chat.id;

      // El pedido se envÃ­a como FOTO con caption, no como texto plano.
      // Por eso buscamos primero en message.caption y, si no existe, en message.text
      const messageText = message.caption || message.text || '';
      const hasPhoto = Boolean(message.photo);

      // Extraer el order_id del mensaje (ej: "Pedido: MAI-ABC123")
      const orderMatch = messageText.match(/MAI-[A-Z0-9]+/i);
      if (!orderMatch) {
        await respondToCallback(botToken, callbackId, 'âŒ No se encontrÃ³ el ID del pedido.');
        return res.status(200).json({ ok: true });
      }

      const orderId = orderMatch[0].toUpperCase();
      let newStatus = '';
      let responseText = '';
      let editedCaption = '';

      // Definir estado y mensajes segÃºn el botÃ³n presionado
      if (data === 'verificado_pagado') {
        newStatus = 'completado';
        responseText = 'âœ… Pago VERIFICADO correctamente.';
        editedCaption = `âœ… *PAGO VERIFICADO* âœ…\n\nPedido: \`${orderId}\`\nEstado: COMPLETADO\n\nEl cliente verÃ¡ "COMPRA EXITOSA" en la pÃ¡gina.`;
      } else if (data === 'pago_invalido') {
        newStatus = 'rechazado';
        responseText = 'âŒ Pago RECHAZADO.';
        editedCaption = `âŒ *PAGO RECHAZADO* âŒ\n\nPedido: \`${orderId}\`\nEstado: RECHAZADO\n\nEl cliente verÃ¡ "PAGO RECHAZADO" en la pÃ¡gina.`;
      } else {
        await respondToCallback(botToken, callbackId, 'â“ AcciÃ³n desconocida.');
        return res.status(200).json({ ok: true });
      }

      // Actualizar estado en Supabase
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SECRET_KEY
      );

      const { error } = await supabase
        .from('pedidos')
        .update({ estado: newStatus })
        .eq('order_id', orderId);

      if (error) {
        console.error('Error actualizando pedido:', error);
        await respondToCallback(botToken, callbackId, 'âš ï¸ Error al actualizar en BD.');
        return res.status(200).json({ ok: true });
      }

      // Responder al callback (quita la animaciÃ³n de carga en Telegram)
      await respondToCallback(botToken, callbackId, responseText);

      // Editar el mensaje original para quitar botones y mostrar resultado.
      // IMPORTANTE: si el mensaje tiene foto hay que usar editMessageCaption,
      // NO editMessageText (ese solo funciona en mensajes de solo texto).
      const editEndpoint = hasPhoto ? 'editMessageCaption' : 'editMessageText';
      const editBody = hasPhoto
        ? {
            chat_id: chatId,
            message_id: messageId,
            caption: editedCaption,
            parse_mode: 'Markdown',
          }
        : {
            chat_id: chatId,
            message_id: messageId,
            text: editedCaption,
            parse_mode: 'Markdown',
          };

      await fetch(`https://api.telegram.org/bot${botToken}/${editEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBody),
      });

      return res.status(200).json({ ok: true });
    }

    // ==================== MANEJAR MENSAJES DE TEXTO (compatibilidad) ====================
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

    const { error } = await supabase
      .from('pedidos')
      .update({ estado: 'completado' })
      .eq('order_id', orderId);

    if (error) {
      console.error('Error actualizando pedido:', error);
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `âœ… Pedido ${orderId} marcado como COMPLETADO.\nEl cliente verÃ¡ "COMPRA EXITOSA" en la pÃ¡gina.`,
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error en webhook:', error);
    return res.status(200).json({ ok: true });
  }
}

// ==================== FUNCIÃ“N AUXILIAR ====================
async function respondToCallback(botToken, callbackId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
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
