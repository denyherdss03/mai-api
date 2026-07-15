/**
 * api/webhook.js
 * Webhook del bot de Telegram.
 * Maneja:
 * 1. Callbacks de botones (verificado/rechazado)
 * 2. Mensajes de texto (para compatibilidad)
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }

  try {
    const body = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // ==================== MANEJAR CALLBACK_QUERY (BOTONES) ====================
    if (body?.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackId = callbackQuery.id;
      const data = callbackQuery.data; // "verificado_pagado" o "pago_invalido"
      const messageId = callbackQuery.message.message_id;
      const chatId = callbackQuery.message.chat.id;
      const messageText = callbackQuery.message.text || '';

      // Extraer el order_id del mensaje (ej: "Pedido: MAI-ABC123")
      const orderMatch = messageText.match(/MAI-[A-Z0-9]+/i);
      if (!orderMatch) {
        await respondToCallback(botToken, callbackId, '❌ No se encontró el ID del pedido.');
        return res.status(200).json({ ok: true });
      }

      const orderId = orderMatch[0].toUpperCase();
      let newStatus = '';
      let responseText = '';
      let editedMessageText = '';

      // Definir estado y mensajes según el botón presionado
      if (data === 'verificado_pagado') {
        newStatus = 'completado';
        responseText = '✅ Pago VERIFICADO correctamente.';
        editedMessageText = `✅ **PAGO VERIFICADO** ✅\n\nPedido: ${orderId}\nEstado: COMPLETADO\n\nEl cliente verá "COMPRA EXITOSA" en la página.`;
      } else if (data === 'pago_invalido') {
        newStatus = 'rechazado';
        responseText = '❌ Pago RECHAZADO.';
        editedMessageText = `❌ **PAGO RECHAZADO** ❌\n\nPedido: ${orderId}\nEstado: RECHAZADO\n\nEl cliente verá "PAGO RECHAZADO" en la página.`;
      } else {
        await respondToCallback(botToken, callbackId, '❓ Acción desconocida.');
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
        await respondToCallback(botToken, callbackId, '⚠️ Error al actualizar en BD.');
        return res.status(200).json({ ok: true });
      }

      // Responder al callback (quita la animación de carga en Telegram)
      await respondToCallback(botToken, callbackId, responseText);

      // Editar el mensaje original para quitar botones y mostrar resultado
      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: editedMessageText,
          parse_mode: 'Markdown',
        }),
      });

      return res.status(200).json({ ok: true });
    }

    // ==================== MANEJAR MENSAJES DE TEXTO ====================
    const message = body?.message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const text = message.text.toLowerCase().trim();

    // Detectar patrón antiguo: "pedido MAI-XXXX verificado y pagado"
    // (por compatibilidad con versiones anteriores)
    const match = text.match(/pedido\s+(mai-[a-z0-9]+)\s+verificado\s+y\s+pagado/i);

    if (!match) {
      return res.status(200).json({ ok: true });
    }

    const orderId = match[1].toUpperCase();

    // Actualizar estado en Supabase
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

    // Confirmar en Telegram que el pedido fue procesado
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = message.chat.id;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ Pedido ${orderId} marcado como COMPLETADO.\nEl cliente verá "COMPRA EXITOSA" en la página.`,
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error en webhook:', error);
    return res.status(200).json({ ok: true });
  }
}

// ==================== FUNCIÓN AUXILIAR ====================
/**
 * Responde a un callback_query de Telegram
 * (muestra notificación al usuario que clickeó el botón)
 */
async function respondToCallback(botToken, callbackId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text,
        show_alert: false, // true = popup grande, false = notificación pequeña
      }),
    });
  } catch (error) {
    console.error('Error respondiendo callback:', error);
  }
}
