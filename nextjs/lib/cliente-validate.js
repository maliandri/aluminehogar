// Validación de la ficha de cliente. Módulo puro (sin base de datos ni alias @/).

// Si el cliente no tiene email, el vendedor tiene que escribir esta frase a mano (no hay botón que la complete)
export const FRASE_SIN_EMAIL = 'cliente no posee mail en este momento o no usa';

export const PROVINCIAS = ['Neuquen'];
export const TIPOS_DOCUMENTO = ['DNI', 'CUIL', 'CUIT', 'Pasaporte'];
export const TIPOS_ARCHIVO = {
  dni_frente: 'DNI (frente)',
  dni_dorso: 'DNI (dorso)',
  recibo: 'Recibo de ingresos',
  servicio: 'Servicio (luz, gas, agua)',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?[\d\s()-]{6,25}$/;

const normalizarFrase = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function normalizarDocumento(texto) {
  return String(texto ?? '').replace(/[.\s-]/g, '').toUpperCase();
}

// Lee un campo de texto obligatorio; si hay un problema lo agrega a `errores` y devuelve ''
function texto(errores, etiqueta, crudo, { max, regex, mensaje }) {
  if (crudo != null && typeof crudo !== 'string') {
    errores.push(`${etiqueta}: tiene que ser texto`);
    return '';
  }
  const v = (crudo ?? '').trim();
  if (!v) {
    errores.push(`${etiqueta}: es obligatorio`);
    return '';
  }
  if (v.length > max) {
    errores.push(`${etiqueta}: máximo ${max} caracteres`);
    return '';
  }
  if (regex && !regex.test(v)) {
    errores.push(`${etiqueta}: ${mensaje}`);
    return '';
  }
  return v;
}

export function validarCliente(entrada) {
  const errores = [];
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const dom = e.domicilio && typeof e.domicilio === 'object' ? e.domicilio : {};

  const nombre = texto(errores, 'Nombre', e.nombre, { max: 100, regex: /^.{2,}$/s, mensaje: 'mínimo 2 caracteres' });

  let tipoDocumento = typeof e.tipoDocumento === 'string' ? e.tipoDocumento.trim() : '';
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) {
    errores.push('Tipo de documento: elegí una opción de la lista');
    tipoDocumento = '';
  }
  const numeroDocumento = normalizarDocumento(typeof e.numeroDocumento === 'string' || typeof e.numeroDocumento === 'number' ? e.numeroDocumento : '');
  if (tipoDocumento === 'Pasaporte') {
    if (!/^[A-Z0-9]{5,15}$/.test(numeroDocumento)) errores.push('Número de documento: 5 a 15 letras o números');
  } else if (!/^\d{7,13}$/.test(numeroDocumento)) {
    errores.push('Número de documento: solo números, entre 7 y 13 dígitos');
  }

  const telefono = texto(errores, 'Teléfono', e.telefono, { max: 25, regex: TELEFONO, mensaje: 'solo números, espacios, +, ( ) y -' });

  // Email válido, o exactamente la frase de "sin email" (se guarda siempre en su forma canónica)
  let email = '';
  if (e.email != null && typeof e.email !== 'string') {
    errores.push('Email: tiene que ser texto');
  } else {
    const crudo = (e.email ?? '').trim();
    if (!crudo) {
      errores.push(`Email: es obligatorio. Si el cliente no tiene, escribí exactamente: ${FRASE_SIN_EMAIL}`);
    } else if (normalizarFrase(crudo) === FRASE_SIN_EMAIL) {
      email = FRASE_SIN_EMAIL;
    } else if (crudo.length <= 120 && EMAIL.test(crudo)) {
      email = crudo;
    } else {
      errores.push(`Email: no es válido. Si el cliente no tiene, escribí exactamente: ${FRASE_SIN_EMAIL}`);
    }
  }

  const calle = texto(errores, 'Calle', dom.calle, { max: 100, regex: /^.{2,}$/s, mensaje: 'mínimo 2 caracteres' });
  const numero = texto(errores, 'Número', dom.numero, { max: 10, regex: /^[A-Za-z0-9\s./-]{1,10}$/, mensaje: 'solo letras, números, espacios, . / y -' });
  const localidad = texto(errores, 'Localidad', dom.localidad, { max: 60, regex: /^.{2,}$/s, mensaje: 'mínimo 2 caracteres' });
  let provincia = typeof dom.provincia === 'string' ? dom.provincia.trim() : '';
  if (!PROVINCIAS.includes(provincia)) {
    errores.push('Provincia: elegí una opción de la lista');
    provincia = '';
  }

  return errores.length
    ? { ok: false, errores, valor: null }
    : { ok: true, errores: [], valor: { nombre, tipoDocumento, numeroDocumento, telefono, email, domicilio: { calle, numero, localidad, provincia } } };
}
