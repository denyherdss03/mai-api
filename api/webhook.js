/**
 * api/webhook.js
 * Webhook del bot de Telegram con validacion de firma y proteccion doble click.
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';
import crypto from 'crypto';

/**
 * Valida que el request viene realmente de Telegram
 * usando el token del bot como secreto
 */
function validarWebhookTelegram(req) {
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  const BOT_SECRET = process.env.BOT_UPDATE_SECRET;
  if (!BOT_SECRET) return true; // Si no hay secret configurado, permitir
  if (!secretToken) return false;
  return secretToken === BOT_SECRET;
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
  } catch (e) {}
}

async function updateConfig(supabase, clave, valor) {
  const { error } = await supabase
    .from('configuracion')
    .update({ valor, updated_at: new Date().toISOString() })
    .eq('clave', clave);
  return !error;
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Metodo no permitido.' });
  }

  // Validar que viene de Telegram
  if (!validarWebhookTelegram(req)) {
    console.warn('Webhook rechazado: firma invalida');
    return res.status(401).json({ success: false, error: 'No autorizado.' });
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

      // Verificar estado actual para evitar doble procesamiento
      const { data: pedidoActual } = await supabase
        .from('pedidos')
        .select('estado, jugador, id_jugador, producto, precio')
        .eq('order_id', orderId)
        .single();

      // Proteccion doble click: si ya fue procesado, no cambiar
      if (pedidoActual?.estado === 'completado' || pedidoActual?.estado === 'rechazado') {
        const estadoActual = pedidoActual.estado === 'completado' ? 'COMPLETADO' : 'RECHAZADO';
        await respondToCallback(botToken, callbackId, 'Este pedido ya fue ' + estadoActual + '.');
        return res.status(200).json({ ok: true });
      }

      const jugador = pedidoActual?.jugador || 'Desconocido';
      const idJugador = pedidoActual?.id_jugador || 'Desconocido';
      const producto = pedidoActual?.producto || 'Desconocido';
      const precio = pedidoActual?.precio || 'Desconocido';

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
    if (!message || !message.text) return res.status(200).json({ ok: true });

    const text = message.text.toLowerCase().trim();
    const chatId = message.chat.id;

    // TIENDA
    if (text === 'tienda abrir') {
      await updateConfig(supabase, 'tienda_abierta', 'true');
      await sendMessage(botToken, chatId, '✅ Tienda ABIERTA.');
      return res.status(200).json({ ok: true });
    }
    if (text === 'tienda cerrar') {
      await updateConfig(supabase, 'tienda_abierta', 'false');
      await sendMessage(botToken, chatId, '🔴 Tienda CERRADA.');
      return res.status(200).json({ ok: true });
    }

    // BOOYAH
    if (text === 'agotado booyah') {
      await updateConfig(supabase, 'stock_pase_booyah', 'false');
      await sendMessage(botToken, chatId, '⚠️ Pase Booyah AGOTADO.');
      return res.status(200).json({ ok: true });
    }
    if (text === 'disponible booyah') {
      await updateConfig(supabase, 'stock_pase_booyah', 'true');
      await sendMessage(botToken, chatId, '✅ Pase Booyah DISPONIBLE.');
      return res.status(200).json({ ok: true });
    }

    // CAJAS EVO GENERAL
    if (text === 'agotado cajas') {
      await updateConfig(supabase, 'stock_cajas_evo', 'false');
      await sendMessage(botToken, chatId, '⚠️ TODAS las Cajas Evo AGOTADAS.');
      return res.status(200).json({ ok: true });
    }
    if (text === 'disponible cajas') {
      await updateConfig(supabase, 'stock_cajas_evo', 'true');
      await sendMessage(botToken, chatId, '✅ TODAS las Cajas Evo DISPONIBLES.');
      return res.status(200).json({ ok: true });
    }

    // CAJAS EVO INDIVIDUAL
    for (const cant of ['7','12','25','52','120','280']) {
      if (text === 'agotado caja ' + cant) {
        await updateConfig(supabase, 'stock_caja_' + cant, 'false');
        await sendMessage(botToken, chatId, '⚠️ Caja Evo ' + cant + ' AGOTADA.');
        return res.status(200).json({ ok: true });
      }
      if (text === 'disponible caja ' + cant) {
        await updateConfig(supabase, 'stock_caja_' + cant, 'true');
        await sendMessage(botToken, chatId, '✅ Caja Evo ' + cant + ' DISPONIBLE.');
        return res.status(200).json({ ok: true });
      }
    }

    // FRAGMENTOS EVO GENERAL
    if (text === 'agotado fragmentos') {
      await updateConfig(supabase, 'stock_fragmentos', 'false');
      await sendMessage(botToken, chatId, '⚠️ TODOS los Fragmentos AGOTADOS.');
      return res.status(200).json({ ok: true });
    }
    if (text === 'disponible fragmentos') {
      await updateConfig(supabase, 'stock_fragmentos', 'true');
      await sendMessage(botToken, chatId, '✅ TODOS los Fragmentos DISPONIBLES.');
      return res.status(200).json({ ok: true });
    }

    // FRAGMENTOS EVO INDIVIDUAL
    for (const cant of ['35','50','100','250','600','1400']) {
      if (text === 'agotado fragmento ' + cant) {
        await updateConfig(supabase, 'stock_frag_' + cant, 'false');
        await sendMessage(botToken, chatId, '⚠️ Fragmento ' + cant + ' AGOTADO.');
        return res.status(200).json({ ok: true });
      }
      if (text === 'disponible fragmento ' + cant) {
        await updateConfig(supabase, 'stock_frag_' + cant, 'true');
        await sendMessage(botToken, chatId, '✅ Fragmento ' + cant + ' DISPONIBLE.');
        return res.status(200).json({ ok: true });
      }
    }

    // ESTADO
    if (text === 'estado') {
      const { data: configs } = await supabase.from('configuracion').select('clave, valor');
      const cfg = {};
      configs.forEach(({ clave, valor }) => { cfg[clave] = valor; });

      const msg =
        'ESTADO ACTUAL\n\n' +
        'Tienda: ' + (cfg.tienda_abierta !== 'false' ? '✅ ABIERTA' : '🔴 CERRADA') + '\n' +
        'Pase Booyah: ' + (cfg.stock_pase_booyah !== 'false' ? '✅' : '⚠️ AGOTADO') + '\n\n' +
        'CAJAS EVO:\n' +
        ['7','12','25','52','120','280'].map(c =>
          c + ': ' + (cfg['stock_caja_' + c] !== 'false' ? '✅' : '⚠️ AGOTADO')
        ).join('\n') + '\n\n' +
        'FRAGMENTOS EVO:\n' +
        ['35','50','100','250','600','1400'].map(c =>
          c + ': ' + (cfg['stock_frag_' + c] !== 'false' ? '✅' : '⚠️ AGOTADO')
        ).join('\n');

      await sendMessage(botToken, chatId, msg);
      return res.status(200).json({ ok: true });
    }

    // COMPATIBILIDAD TEXTO
    const matchVerificado = text.match(/pedido\s+(mai-[a-z0-9]+)\s+verificado\s+y\s+pagado/i);
    if (matchVerificado) {
      const orderId = matchVerificado[1].toUpperCase();

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('estado, jugador, id_jugador, producto, precio')
        .eq('order_id', orderId)
        .single();

      if (pedido?.estado === 'completado') {
        await sendMessage(botToken, chatId, 'Este pedido ya fue COMPLETADO.');
        return res.status(200).json({ ok: true });
      }

      const jugador = pedido?.jugador || 'Desconocido';
      const idJugador = pedido?.id_jugador || 'Desconocido';
      const producto = pedido?.producto || 'Desconocido';
      const precio = pedido?.precio || 'Desconocido';

      await supabase.from('pedidos').update({ estado: 'completado' }).eq('order_id', orderId);
      await sendMessage(botToken, chatId,
        'PAGO VERIFICADO\n\nPedido: `' + orderId + '`\nJugador: ' + jugador +
        '\nID Jugador: `' + idJugador + '`\nProducto: ' + producto +
        '\nPrecio: ' + precio + '\nEstado: COMPLETADO\n\nEl cliente vera COMPRA EXITOSA.'
      );
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Error en webhook:', error);
    return res.status(200).json({ ok: true });
  }
}
