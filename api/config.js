/**
 * api/config.js
 * Endpoint: GET /api/config
 * Devuelve configuracion de la tienda (tienda abierta/cerrada, stock, precios)
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
        pase_booyah: config.stock_pase_booyah !== 'false',
        fragmentos: config.stock_fragmentos !== 'false',
        cajas_evo: config.stock_cajas_evo !== 'false',
      },
      productos,
    });

  } catch (error) {
    console.error('Error obteniendo config:', error);
    // Si hay error, devolver valores por defecto (tienda abierta)
    return res.status(200).json({
      success: true,
      tienda_abierta: true,
      stock: {
        pase_booyah: true,
        fragmentos: true,
        cajas_evo: true,
      },
      productos: [],
    });
  }
}
