/**
 * api/config.js
 * Endpoint: GET /api/config
 * Devuelve configuracion de la tienda (estado, stock, precios)
 */

import { handleCors } from '../utils/cors.js';
import { PRECIOS, PRODUCTOS_VALIDOS } from '../utils/validator.js';
import { createClient } from '@supabase/supabase-js';

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

    const { data, error } = await supabase
      .from('configuracion')
      .select('clave, valor');

    if (error) throw error;

    const config = {};
    data.forEach(({ clave, valor }) => {
      config[clave] = valor;
    });

    const productos = PRODUCTOS_VALIDOS.map(nombre => ({
      nombre,
      precio: PRECIOS[nombre] || 'S/0.00',
    }));

    return res.status(200).json({
      success: true,
      tienda_abierta: config.tienda_abierta === 'true',
      stock: {
        pase_booyah: config.stock_pase_booyah === 'true',
        fragmentos: config.stock_fragmentos === 'true',
        cajas_evo: config.stock_cajas_evo === 'true',
      },
      productos,
    });

  } catch (error) {
    console.error('Error obteniendo config:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
}
