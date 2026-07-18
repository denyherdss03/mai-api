/**
 * api/prices.js
 * Endpoint: GET /api/prices
 * Devuelve la lista de productos y precios actuales.
 * La pagina web carga los precios desde aqui automaticamente.
 */

import { handleCors } from '../utils/cors.js';
import { PRECIOS, PRODUCTOS_VALIDOS } from '../utils/validator.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Metodo no permitido.' });
  }

  try {
    const productos = PRODUCTOS_VALIDOS.map(nombre => ({
      nombre,
      precio: PRECIOS[nombre] || 'S/0.00',
    }));

    return res.status(200).json({
      success: true,
      productos,
    });

  } catch (error) {
    console.error('Error obteniendo precios:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
}
