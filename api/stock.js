/**
 * api/stock.js
 * Endpoint: GET /api/stock
 * Devuelve el estado de stock (agotado/disponible) de los productos.
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido.' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const { data, error } = await supabase
      .from('stock')
      .select('producto, agotado, updated_at');

    if (error) throw error;

    const stockMap = {};
    (data || []).forEach(item => {
      stockMap[item.producto] = item.agotado;
    });

    return res.status(200).json({
      success: true,
      stock: stockMap,
    });
  } catch (error) {
    console.error('Error consultando stock:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor.',
    });
  }
}
