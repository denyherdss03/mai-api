/**
 * api/update-order.js
 * Endpoint: POST /api/update-order
 * El bot de Telegram llama este endpoint cuando detecta
 * el mensaje "pedido MAI-XXXX verificado"
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';

// Token secreto para que solo el bot pueda llamar este endpoint
const BOT_SECRET = process.env.BOT_UPDATE_SECRET || 'mai-store-secret-2026';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }

  try {
    const { orderId, secret } = req.body;

    // Verificar token secreto
    if (secret !== BOT_SECRET) {
      return res.status(401).json({ success: false, error: 'No autorizado.' });
    }

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Se requiere orderId.' });
    }

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
      return res.status(500).json({ success: false, error: 'Error actualizando pedido.' });
    }

    return res.status(200).json({
      success: true,
      message: `Pedido ${orderId} marcado como completado.`,
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
}
