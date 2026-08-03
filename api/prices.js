/**
 * api/prices.js
 * Endpoint: GET /api/prices
 * Devuelve productos con precios y estado de stock.
 */

import { createClient } from '@supabase/supabase-js';
import { handleCors } from '../utils/cors.js';
import { PRECIOS, PRODUCTOS_VALIDOS } from '../utils/validator.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Metodo no permitido.' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    const { data: stockData, error: stockError } = await supabase
      .from('stock')
      .select('producto, agotado');

    const stockMap = {};
    if (!stockError && stockData) {
      stockData.forEach(s => {
        stockMap[s.producto] = s.agotado;
      });
    }

    const productos = PRODUCTOS_VALIDOS.map(nombre => ({
      nombre,
      precio: PRECIOS[nombre] || 'S/0.00',
      agotado: stockMap[nombre] || false,
    }));

    return res.status(200).json({ success: true, productos });
  } catch (error) {
    console.error('Error obteniendo precios:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
}
