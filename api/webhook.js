/**
 * api/webhook.js
 * Webhook del bot de Telegram.
 * Escucha mensajes en el grupo y cuando detecta:
 * "pedido MAI-XXXX verificado y pagado"
 * llama al endpoint update-order para marcar el pedido como completado.
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

    // Obtener el mensaje del update de Telegram
    const message = body?.message;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const text = message.text.toLowerCase().trim();

    // Detectar patrón: "pedido MAI-XXXX verificado y pagado"
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
