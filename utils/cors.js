/**
 * utils/cors.js
 * ---------------------------------------------------------------------
 * Manejo centralizado de CORS y cabeceras de seguridad para Mai API.
 * ---------------------------------------------------------------------
 */

const ALLOWED_ORIGIN = '*';

/**
 * Añade las cabeceras CORS y de seguridad a la respuesta.
 */
export function setCorsHeaders(res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Seguridad HTTP
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

/**
 * Rate Limiting simple por IP
 * Maximo 10 peticiones por hora por IP
 */
const requestCounts = new Map();

export function checkRateLimit(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hora
  const maxRequests = 10; // maximo 10 pedidos por hora

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return { allowed: true };
  }

  const data = requestCounts.get(ip);

  // Reiniciar contador si paso la hora
  if (now - data.startTime > windowMs) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return { allowed: true };
  }

  // Verificar limite
  if (data.count >= maxRequests) {
    return {
      allowed: false,
      error: `Has excedido el limite de pedidos. Puedes hacer maximo ${maxRequests} pedidos por hora. Intenta mas tarde.`
    };
  }

  data.count++;
  return { allowed: true };
}

/**
 * Gestiona la logica de CORS para una peticion entrante.
 */
export function handleCors(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
