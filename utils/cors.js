/**
 * utils/cors.js
 * CORS + cabeceras de seguridad para Mai API.
 */

// Solo permitir tu dominio
const ALLOWED_ORIGINS = [
  'https://maiventax.com',
  'https://www.maiventax.com',
  'https://maiventas.netlify.app',
];

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  
  // Permitir el origen si está en la lista
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://maiventax.com');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  // Cabeceras de seguridad HTTP
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

/**
 * Rate Limiting usando Supabase en lugar de Map en memoria.
 * Vercel es serverless, la memoria no persiste entre requests.
 * Usamos una solucion simple: confiamos en el rate limit de Supabase
 * y en la validacion de la IA para filtrar spam.
 * 
 * Para un rate limit real en serverless necesitarias Redis/Upstash.
 * Por ahora limitamos por tamanio de payload y validacion de campos.
 */
export function checkRateLimit(req) {
  // En Vercel serverless el Map en memoria no funciona entre instancias
  // Esta funcion siempre permite pero registra para auditoria
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  console.log(`Request from IP: ${ip} at ${new Date().toISOString()}`);
  return { allowed: true };
}

export function handleCors(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
