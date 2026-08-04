/**
 * api/webhook.js
 * Webhook del bot de Telegram.
 * Maneja callbacks de botones y comandos de texto.
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';

async function updateConfig(supabase, clave, valor) {
  const { error } = await supabase
    .from('configuracion')
    .update({ valor, updated_at: new Date().toISOString() })
    .eq('clave', clave);
  return !error;
}

async function sendMessage(botToken, chatId, text) {
  await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function respondToCallback(botToken, callbackId, text) {
  try {
    await fetch('https://api.telegram.org/bot' + botToken + '/answerCallbackQuery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: false }),
    });
  } catch (e) { console.error('Error respondiendo callback:', e); }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Metodo no permitido.' });
  }

  try {
    const body = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

    // MANEJAR CALLBACK_QUERY (botones)
    if (body?.callback_query) {
      const callbackQuery = body.callback_query;
      const callbackId = callbackQuery.id;
      const data = callbackQuery.data;
      const message = callbackQuery.message;
      const messageId = message.message_id;
      const chatId = message.chat.id;
      const messageText = message.caption || message.text || '';
      const hasPhoto = Boolean(message.photo);

      const orderMatch = messageText.match(/MAI-[A-Z0-9]+/i);
      if (!orderMatch) {
        await respondToCallback(botToken, callbackId, 'No se encontro el ID del pedido.');
        return res.status(200).json({ ok: true });
      }

      const orderId = orderMatch[0].toUpperCase();

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

      await supabase.from('pedidos').update({ estado: newStatus }).eq('order_id', orderId);
      await respondToCallback(botToken, callbackId, responseText);

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

    // MANEJAR MENSAJES DE TEXTO
    const message = body?.message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const text = message.text.toLowerCase().trim();
    const chatId = message.chat.id;

    // ===== COMANDOS DE TIENDA =====

    // Abrir/cerrar tienda
    if (text === 'tienda abrir' || text === '/tienda abrir') {
      await updateConfig(supabase, 'tienda_abierta', 'true');
      await sendMessage(botToken, chatId, '✅ Tienda ABIERTA. Los clientes pueden comprar.');
      return res.status(200).json({ ok: true });
    }

    if (text === 'tienda cerrar' || text === '/tienda cerrar') {
      await updateConfig(supabase, 'tienda_abierta', 'false');
      await sendMessage(botToken, chatId, '🔴 Tienda CERRADA. Los clientes veran el mensaje de cierre.');
      return res.status(200).json({ ok: true });
    }

    // Stock Pase Booyah
    if (text === 'agotado booyah' || text === '/agotado booyah') {
      await updateConfig(supabase, 'stock_pase_booyah', 'false');
      await sendMessage(botToken, chatId, '⚠️ Pase Booyah marcado como AGOTADO en la pagina.');
      return res.status(200).json({ ok: true });
    }

    if (text === 'disponible booyah' || text === '/disponible booyah') {
      await updateConfig(supabase, 'stock_pase_booyah', 'true');
      await sendMessage(botToken, chatId, '✅ Pase Booyah marcado como DISPONIBLE en la pagina.');
      return res.status(200).json({ ok: true });
    }

    // Stock Fragmentos
    if (text === 'agotado fragmentos' || text === '/agotado fragmentos') {
      await updateConfig(supabase, 'stock_fragmentos', 'false');
      await sendMessage(botToken, chatId, '⚠️ Fragmentos marcados como AGOTADOS en la pagina.');
      return res.status(200).json({ ok: true });
    }

    if (text === 'disponible fragmentos' || text === '/disponible fragmentos') {
      await updateConfig(supabase, 'stock_fragmentos', 'true');
      await sendMessage(botToken, chatId, '✅ Fragmentos marcados como DISPONIBLES en la pagina.');
      return res.status(200).json({ ok: true });
    }

    // Stock Cajas Evo
    if (text === 'agotado cajas' || text === '/agotado cajas') {
      await updateConfig(supabase, 'stock_cajas_evo', 'false');
      await sendMessage(botToken, chatId, '⚠️ Cajas Evo marcadas como AGOTADAS en la pagina.');
      return res.status(200).json({ ok: true });
    }

    if (text === 'disponible cajas' || text === '/disponible cajas') {
      await updateConfig(supabase, 'stock_cajas_evo', 'true');
      await sendMessage(botToken, chatId, '✅ Cajas Evo marcadas como DISPONIBLES en la pagina.');
      return res.status(200).json({ ok: true });
    }

    // Ver estado actual
    if (text === 'estado' || text === '/estado') {
      const { data: configs } = await supabase.from('configuracion').select('clave, valor');
      const cfg = {};
      configs.forEach(({ clave, valor }) => { cfg[clave] = valor; });

      const msg =
        'ESTADO ACTUAL DE LA TIENDA\n\n' +
        'Tienda: ' + (cfg.tienda_abierta === 'true' ? '✅ ABIERTA' : '🔴 CERRADA') + '\n' +
        'Pase Booyah: ' + (cfg.stock_pase_booyah === 'true' ? '✅ Disponible' : '⚠️ Agotado') + '\n' +
        'Fragmentos: ' + (cfg.stock_fragmentos === 'true' ? '✅ Disponible' : '⚠️ Agotado') + '\n' +
        'Cajas Evo: ' + (cfg.stock_cajas_evo === 'true' ? '✅ Disponible' : '⚠️ Agotado') + '\n\n' +
        'Comandos disponibles:\n' +
        'tienda abrir / tienda cerrar\n' +
        'agotado booyah / disponible booyah\n' +
        'agotado fragmentos / disponible fragmentos\n' +
        'agotado cajas / disponible cajas';

      await sendMessage(botToken, chatId, msg);
      return res.status(200).json({ ok: true });
    }

    // Compatibilidad: verificar pedido por texto
    const matchVerificado = text.match(/pedido\s+(mai-[a-z0-9]+)\s+verificado\s+y\s+pagado/i);
    if (matchVerificado) {
      const orderId = matchVerificado[1].toUpperCase();

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('jugador, id_jugador, producto, precio')
        .eq('order_id', orderId)
        .single();

      const jugador = pedido?.jugador || 'Desconocido';
      const idJugador = pedido?.id_jugador || 'Desconocido';
      const producto = pedido?.producto || 'Desconocido';
      const precio = pedido?.precio || 'Desconocido';

      await supabase.from('pedidos').update({ estado: 'completado' }).eq('order_id', orderId);

      await sendMessage(botToken, chatId,
        'PAGO VERIFICADO\n\n' +
        'Pedido: `' + orderId + '`\n' +
        'Jugador: ' + jugador + '\n' +
        'ID Jugador: `' + idJugador + '`\n' +
        'Producto: ' + producto + '\n' +
        'Precio: ' + precio + '\n' +
        'Estado: COMPLETADO\n\n' +
        'El cliente vera COMPRA EXITOSA en la pagina.'
      );

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error en webhook:', error);
    return res.status(200).json({ ok: true });
  }
}
