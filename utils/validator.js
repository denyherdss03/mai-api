/**
 * utils/validator.js
 * Validaciones de negocio para los pedidos de Mai API.
 */

const MAX_PRODUCTO_LENGTH = 100;
const MAX_PRECIO_LENGTH = 20;
const MAX_JUGADOR_LENGTH = 50;
const MIN_JUGADOR_LENGTH = 2;
const MAX_ID_LENGTH = 20;
const MIN_ID_LENGTH = 3;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export const PRODUCTOS_VALIDOS = [
  '110 Diamantes',
  '341 Diamantes',
  '572 Diamantes',
  '1166 Diamantes',
  '2398 Diamantes',
  '6160 Diamantes',
  'Pase Booyah',
  'Tarjeta Semanal Basica',
  'Tarjeta Semanal',
  'Tarjeta Mensual',
  'Cajas Evo 7',
  'Cajas Evo 12',
  'Cajas Evo 25',
  'Cajas Evo 52',
  'Cajas Evo 120',
  'Cajas Evo 280',
  'Fragmentos Evo 35',
  'Fragmentos Evo 50',
  'Fragmentos Evo 100',
  'Fragmentos Evo 250',
  'Fragmentos Evo 600',
  'Fragmentos Evo 1400',
];

export const PRECIOS = {
  '110 Diamantes': 'S/2.90',
  '341 Diamantes': 'S/8.50',
  '572 Diamantes': 'S/13.60',
  '1166 Diamantes': 'S/24.80',
  '2398 Diamantes': 'S/49.64',
  '6160 Diamantes': 'S/120.90',
  'Pase Booyah': 'S/5.00',
  'Tarjeta Semanal Basica': 'S/1.50',
  'Tarjeta Semanal': 'S/6.30',
  'Tarjeta Mensual': 'S/28.00',
  'Cajas Evo 7': 'S/7.00',
  'Cajas Evo 12': 'S/11.00',
  'Cajas Evo 25': 'S/19.90',
  'Cajas Evo 52': 'S/36.00',
  'Cajas Evo 120': 'S/74.00',
  'Cajas Evo 280': 'S/183.00',
  'Fragmentos Evo 35': 'S/7.00',
  'Fragmentos Evo 50': 'S/11.00',
  'Fragmentos Evo 100': 'S/19.00',
  'Fragmentos Evo 250': 'S/36.00',
  'Fragmentos Evo 600': 'S/74.00',
  'Fragmentos Evo 1400': 'S/183.00',
};

export function validateOrderFields({ producto, precio, jugador, idJugador }) {
  if (!producto || typeof producto !== 'string' || producto.trim() === '') {
    return { valid: false, error: 'El campo "producto" es obligatorio.' };
  }
  if (!precio || typeof precio !== 'string' || precio.trim() === '') {
    return { valid: false, error: 'El campo "precio" es obligatorio.' };
  }
  if (!jugador || typeof jugador !== 'string' || jugador.trim() === '') {
    return { valid: false, error: 'El campo "jugador" es obligatorio.' };
  }
  const jugadorTrimmed = jugador.trim();
  if (jugadorTrimmed.length < MIN_JUGADOR_LENGTH) {
    return { valid: false, error: 'El nombre del jugador es demasiado corto.' };
  }
  if (jugadorTrimmed.length > MAX_JUGADOR_LENGTH) {
    return { valid: false, error: `El nombre del jugador no puede superar los ${MAX_JUGADOR_LENGTH} caracteres.` };
  }
  if (!idJugador || typeof idJugador !== 'string' || idJugador.trim() === '') {
    return { valid: false, error: 'El campo "idJugador" es obligatorio.' };
  }
  const idTrimmed = idJugador.trim();
  if (idTrimmed.length < MIN_ID_LENGTH) {
    return { valid: false, error: 'El ID del jugador es demasiado corto.' };
  }
  if (idTrimmed.length > MAX_ID_LENGTH) {
    return { valid: false, error: `El ID del jugador no puede superar los ${MAX_ID_LENGTH} caracteres.` };
  }
  if (!/^[a-zA-Z0-9]+$/.test(idTrimmed)) {
    return { valid: false, error: 'El ID del jugador contiene caracteres inválidos. Solo se permiten letras y números.' };
  }
  return { valid: true };
}

export function validateProductoExists(producto) {
  const productoTrimmed = (producto || '').trim();
  const existe = PRODUCTOS_VALIDOS.some(
    (p) => p.toLowerCase() === productoTrimmed.toLowerCase()
  );
  if (!existe) {
    return { valid: false, error: 'El producto seleccionado no es válido.' };
  }
  return { valid: true };
}

export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'El comprobante de pago es obligatorio.' };
  }
  if (!file.size || file.size === 0) {
    return { valid: false, error: 'El archivo del comprobante está vacío.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'El comprobante supera el tamaño máximo permitido (5 MB).' };
  }
  const mimeType = (file.mimetype || '').toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: 'Formato de imagen no permitido. Solo se aceptan JPG, JPEG y PNG.' };
  }
  const originalName = (file.originalFilename || '').toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => originalName.endsWith(ext));
  if (!hasValidExtension) {
    return { valid: false, error: 'Extensión de archivo no permitida. Solo se aceptan .jpg, .jpeg y .png.' };
  }
  return { valid: true };
}
