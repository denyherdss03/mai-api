/**
 * utils/validator.js
 * Validaciones de negocio para los pedidos de Mai API.
 */

const MAX_JUGADOR_LENGTH = 50;
const MIN_JUGADOR_LENGTH = 2;
const MAX_ID_LENGTH = 20;
const MIN_ID_LENGTH = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export const PRODUCTOS_VALIDOS = [
  // DIAMANTES
  '110 Diamantes',
  '341 Diamantes',
  '572 Diamantes',
  '1166 Diamantes',
  '2398 Diamantes',
  '6160 Diamantes',
  // CAJAS EVO
  '7 Cajas Evo',
  '12 Cajas Evo',
  '25 Cajas Evo',
  '52 Cajas Evo',
  '120 Cajas Evo',
  '280 Cajas Evo',
  // FRAGMENTOS EVO
  '35 Fragmentos Evo',
  '50 Fragmentos Evo',
  '100 Fragmentos Evo',
  '250 Fragmentos Evo',
  '600 Fragmentos Evo',
  '1400 Fragmentos Evo',
  // MEMBRESIAS
  'Tarjeta Semanal Basica',
  'Tarjeta Semanal',
  'Tarjeta Mensual',
  // PASE BOOYAH
  'Pase Booyah',
];

export const PRECIOS = {
  // DIAMANTES
  '110 Diamantes': 'S/2.90',
  '341 Diamantes': 'S/8.50',
  '572 Diamantes': 'S/13.60',
  '1166 Diamantes': 'S/24.80',
  '2398 Diamantes': 'S/49.64',
  '6160 Diamantes': 'S/120.90',
  // CAJAS EVO
  '7 Cajas Evo': 'S/7.00',
  '12 Cajas Evo': 'S/11.00',
  '25 Cajas Evo': 'S/19.90',
  '52 Cajas Evo': 'S/36.00',
  '120 Cajas Evo': 'S/74.00',
  '280 Cajas Evo': 'S/183.00',
  // FRAGMENTOS EVO
  '35 Fragmentos Evo': 'S/7.00',
  '50 Fragmentos Evo': 'S/11.00',
  '100 Fragmentos Evo': 'S/19.00',
  '250 Fragmentos Evo': 'S/36.00',
  '600 Fragmentos Evo': 'S/74.00',
  '1400 Fragmentos Evo': 'S/183.00',
  // MEMBRESIAS
  'Tarjeta Semanal Basica': 'S/1.50',
  'Tarjeta Semanal': 'S/6.30',
  'Tarjeta Mensual': 'S/28.00',
  // PASE BOOYAH
  'Pase Booyah': 'S/4.00',
};

export function validateOrderFields({ producto, precio, jugador, idJugador }) {
  if (!producto || typeof producto !== 'string' || producto.trim() === '') {
    return { valid: false, error: 'El campo producto es obligatorio.' };
  }
  if (!precio || typeof precio !== 'string' || precio.trim() === '') {
    return { valid: false, error: 'El campo precio es obligatorio.' };
  }
  if (!jugador || typeof jugador !== 'string' || jugador.trim() === '') {
    return { valid: false, error: 'El campo jugador es obligatorio.' };
  }
  const jugadorTrimmed = jugador.trim();
  if (jugadorTrimmed.length < MIN_JUGADOR_LENGTH) {
    return { valid: false, error: 'El nombre del jugador es demasiado corto.' };
  }
  if (jugadorTrimmed.length > MAX_JUGADOR_LENGTH) {
    return { valid: false, error: 'El nombre del jugador no puede superar los ' + MAX_JUGADOR_LENGTH + ' caracteres.' };
  }
  if (!idJugador || typeof idJugador !== 'string' || idJugador.trim() === '') {
    return { valid: false, error: 'El campo idJugador es obligatorio.' };
  }
  const idTrimmed = idJugador.trim();
  if (idTrimmed.length < MIN_ID_LENGTH) {
    return { valid: false, error: 'El ID del jugador es demasiado corto.' };
  }
  if (idTrimmed.length > MAX_ID_LENGTH) {
    return { valid: false, error: 'El ID del jugador no puede superar los ' + MAX_ID_LENGTH + ' caracteres.' };
  }
  if (!/^[a-zA-Z0-9]+$/.test(idTrimmed)) {
    return { valid: false, error: 'El ID del jugador solo puede contener letras y numeros.' };
  }
  return { valid: true };
}

export function validateProductoExists(producto) {
  const productoTrimmed = (producto || '').trim();
  const existe = PRODUCTOS_VALIDOS.some(
    (p) => p.toLowerCase() === productoTrimmed.toLowerCase()
  );
  if (!existe) {
    return { valid: false, error: 'El producto seleccionado no es valido: ' + productoTrimmed };
  }
  return { valid: true };
}

export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'El comprobante de pago es obligatorio.' };
  }
  if (!file.size || file.size === 0) {
    return { valid: false, error: 'El archivo del comprobante esta vacio.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'El comprobante supera el tamano maximo permitido (5 MB).' };
  }
  const mimeType = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: 'Formato de imagen no permitido. Solo se aceptan JPG, JPEG y PNG.' };
  }
  const originalName = (file.originalFilename || '').toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => originalName.endsWith(ext));
  if (!hasValidExtension) {
    return { valid: false, error: 'Extension de archivo no permitida. Solo se aceptan .jpg, .jpeg y .png.' };
  }
  return { valid: true };
}
