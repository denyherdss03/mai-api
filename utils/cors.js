/**
 * utils/cors.js
 * ---------------------------------------------------------------------
 * Manejo centralizado de CORS para Mai API.
 * Permite que la página web (Readdy AI) pueda consumir la API desde
 * el navegador, respondiendo correctamente a las peticiones preflight
 * (OPTIONS) y añadiendo las cabeceras necesarias en cada respuesta.
 * ---------------------------------------------------------------------
 */

// Origen permitido. Se puede restringir a un dominio específico
// (por ejemplo: 'https://mitienda.readdy.site') en lugar de '*'.
const ALLOWED_ORIGIN = '*';

/**
 * Añade las cabeceras CORS estándar a la respuesta.
 * @param {import('http').ServerResponse} res
 */
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Gestiona la lógica de CORS para una petición entrante.
 * Si la petición es un preflight (OPTIONS), responde inmediatamente
 * con 204 y devuelve true para indicar que ya fue atendida.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true si la petición ya fue respondida (OPTIONS)
 */
export function handleCors(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
