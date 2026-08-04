/**
 * api/config.js
 * Endpoint: GET /api/config
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
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
    const { data, error } = await supabase.from('configuracion').select('clave, valor');
    if (error) throw error;

    const cfg = {};
    data.forEach(({ clave, valor }) => { cfg[clave] = valor; });

    const productos = PRODUCTOS_VALIDOS.map(nombre => ({
      nombre,
      precio: PRECIOS[nombre] || 'S/0.00',
    }));

    return res.status(200).json({
      success: true,
      tienda_abierta: cfg.tienda_abierta !== 'false',
      stock: {
        pase_booyah: cfg.stock_pase_booyah !== 'false',
        fragmentos: cfg.stock_fragmentos !== 'false',
        cajas_evo: cfg.stock_cajas_evo !== 'false',
      },
      stock_individual: {
        stock_caja_7: cfg.stock_caja_7 !== 'false',
        stock_caja_12: cfg.stock_caja_12 !== 'false',
        stock_caja_25: cfg.stock_caja_25 !== 'false',
        stock_caja_52: cfg.stock_caja_52 !== 'false',
        stock_caja_120: cfg.stock_caja_120 !== 'false',
        stock_caja_280: cfg.stock_caja_280 !== 'false',
        stock_frag_35: cfg.stock_frag_35 !== 'false',
        stock_frag_50: cfg.stock_frag_50 !== 'false',
        stock_frag_100: cfg.stock_frag_100 !== 'false',
        stock_frag_250: cfg.stock_frag_250 !== 'false',
        stock_frag_600: cfg.stock_frag_600 !== 'false',
        stock_frag_1400: cfg.stock_frag_1400 !== 'false',
      },
      productos,
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(200).json({
      success: true,
      tienda_abierta: true,
      stock: { pase_booyah: true, fragmentos: true, cajas_evo: true },
      stock_individual: {},
      productos: [],
    });
  }
}
