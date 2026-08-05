/**
 * utils/validator.js
 * =====================================================
 * PARA CAMBIAR PRECIOS: Solo edita la sección PRECIOS
 * Los cambios se reflejan automaticamente en la pagina
 * =====================================================
 */

// =====================================================
// PRECIOS - EDITA AQUI PARA CAMBIAR PRECIOS
// =====================================================
export const PRECIOS = {
  // DIAMANTES
  '110 Diamantes':  'S/2.90',
  '341 Diamantes':  'S/8.50',
  '572 Diamantes':  'S/13.60',
  '1166 Diamantes': 'S/24.80',
  '2398 Diamantes': 'S/49.64',
  '6160 Diamantes': 'S/120.90',

  // CAJAS EVO
  '7 Cajas Evo':   'S/7.00',
  '12 Cajas Evo':  'S/11.00',
  '25 Cajas Evo':  'S/19.90',
  '52 Cajas Evo':  'S/36.00',
  '120 Cajas Evo': 'S/74.00',
  '280 Cajas Evo': 'S/183.00',

  // FRAGMENTOS EVO
  '35 Fragmentos Evo':   'S/7.00',
  '50 Fragmentos Evo':   'S/11.00',
  '100 Fragmentos Evo':  'S/19.00',
  '250 Fragmentos Evo':  'S/36.00',
  '600 Fragmentos Evo':  'S/74.00',
  '1400 Fragmentos Evo': 'S/183.00',

  // MEMBRESIAS
  'Tarjeta Semanal Basica': 'S/1.50',
  'Tarjeta Semanal':        'S/6.30',
  'Tarjeta Mensual':        'S/28.00',

  // PASE BOOYAH
  'Pase Booyah': 'S/4.00',
};
// =====================================================

export const PRODUCTOS_VALIDOS = Object.keys(PRECIOS);

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
  if (jugadorTrimmed.length < 2 || jugadorTrimmed.length > 50) {
    return { valid: false, error: 'El nombre del jugador debe tener entre 2 y 50 caracteres.' };
  }
  if (!idJugador || typeof idJugador !== 'string' || idJugador.trim() === '') {
    return { valid: false, error: 'El campo idJugador es obligatorio.' };
  }
  const idTrimmed = idJugador.trim();
  if (idTrimmed.length < 3 || idTrimmed.length > 20) {
    return { valid: false, error: 'El ID del jugador debe tener entre 3 y 20 caracteres.' };
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
    return { valid: false, error: 'Producto no valido: ' + productoTrimmed };
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
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'El comprobante supera el tamano maximo permitido (5 MB).' };
  }
  const mimeType = (file.mimetype || '').toLowerCase();
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedMimes.includes(mimeType)) {
    return { valid: false, error: 'Solo se aceptan imagenes JPG, JPEG o PNG.' };
  }
  const originalName = (file.originalFilename || '').toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png'];
  if (!allowedExts.some((ext) => originalName.endsWith(ext))) {
    return { valid: false, error: 'Extension no permitida. Solo .jpg, .jpeg o .png.' };
  }
  return { valid: true };
}
