/**
 * api/check-order.js
 * Endpoint: GET /api/check-order?orderId=MAI-XXXXXXXX
 * La página consulta el estado del pedido cada 10 segundos.
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }

  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).json({ success: false, error: 'Se requiere orderId.' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const { data, error } = await supabase
      .from('pedidos')
      .select('order_id, estado, producto, precio, jugador, id_jugador')
      .eq('order_id', orderId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Pedido no encontrado.' });
    }

    return res.status(200).json({
      success: true,
      orderId: data.order_id,
      estado: data.estado,
      producto: data.producto,
      precio: data.precio,
      jugador: data.jugador,
      idJugador: data.id_jugador,
    });

  } catch (error) {
    console.error('Error consultando pedido:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
}
