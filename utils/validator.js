/**
 * utils/validator.js
 * ---------------------------------------------------------------------
 * Validaciones de negocio para los pedidos de Mai API.
 * Se encarga de validar:
 *   - Campos de texto (producto, precio, jugador, idJugador)
 *   - El archivo del comprobante de pago (imagen)
 * ---------------------------------------------------------------------
 */

const MAX_PRODUCTO_LENGTH = 100;
const MAX_PRECIO_LENGTH = 20;
const MAX_JUGADOR_LENGTH = 50;
const MIN_JUGADOR_LENGTH = 2;
const MAX_ID_LENGTH = 20;
const MIN_ID_LENGTH = 3;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

// Lista blanca de productos válidos de la tienda.
// Esto evita que se envíen pedidos con productos falsos o manipulados.
export const PRODUCTOS_VALIDOS = [
  '110 Diamantes',
  '340 Diamantes',
  '570 Diamantes',
  '1100 Diamantes',
  '2300 Diamantes',
  '6000 Diamantes',
  'Pase Booyah',
];

/**
 * Valida los campos de texto del pedido.
 * @param {{producto: string, precio: string, jugador: string, idJugador: string}} data
 * @returns {{valid: boolean, error?: string}}
 */
export function validateOrderFields({ producto, precio, jugador, idJugador }) {
  // --- Producto ---
  if (!producto || typeof producto !== 'string' || producto.trim() === '') {
    return { valid: false, error: 'El campo "producto" es obligatorio.' };
  }

  const productoTrimmed = producto.trim();

  if (productoTrimmed.length > MAX_PRODUCTO_LENGTH) {
    return { valid: false, error: 'El campo "producto" es demasiado largo.' };
  }

  // --- Precio ---
  if (!precio || typeof precio !== 'string' || precio.trim() === '') {
    return { valid: false, error: 'El campo "precio" es obligatorio.' };
  }

  const precioTrimmed = precio.trim();

  if (precioTrimmed.length > MAX_PRECIO_LENGTH) {
    return { valid: false, error: 'El campo "precio" es demasiado largo.' };
  }

  // --- Jugador (nombre) ---
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

  // --- ID del jugador ---
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

/**
 * Valida que el producto recibido exista en la lista de productos de la tienda.
 * @param {string} producto
 * @returns {{valid: boolean, error?: string}}
 */
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

/**
 * Valida el archivo de comprobante de pago subido por el cliente.
 * @param {object} file Objeto de archivo entregado por formidable
 * @returns {{valid: boolean, error?: string}}
 */
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
