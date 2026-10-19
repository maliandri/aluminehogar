import { SITE_DEFAULTS } from './site-defaults.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?[\d\s()-]{6,25}$/;
const SOLO_DIGITOS = /^\d{8,15}$/;

// Reglas por campo. Solo estos campos existen: todo lo demás que llegue se descarta.
const CAMPOS = {
  tienda: {
    nombre: { max: 80, requerido: true },
    telefono: { max: 25, requerido: true, regex: TELEFONO, mensaje: 'solo números, espacios, +, ( ) y -' },
    whatsapp: { max: 15, requerido: true, regex: SOLO_DIGITOS, mensaje: 'solo números, con código de país (ej: 5492995769999)' },
    emailContacto: { max: 120, requerido: true, regex: EMAIL, mensaje: 'email inválido' },
    emailNotificaciones: { max: 120, requerido: true, regex: EMAIL, mensaje: 'email inválido' },
    emailInfo: { max: 120, requerido: false, regex: EMAIL, mensaje: 'email inválido' },
    direccion: { max: 120, requerido: false },
    ciudad: { max: 60, requerido: true },
  },
  redes: {
    instagram: { max: 200, requerido: false, https: true },
    facebook: { max: 200, requerido: false, https: true },
  },
  inicio: {
    titulo: { max: 100, requerido: true },
    subtitulo: { max: 160, requerido: false },
  },
  chatbot: {
    envio: { max: 120, requerido: false },
    formasDePago: { max: 200, requerido: false },
    politicas: { max: 1200, requerido: false },
  },
};

const esUrlHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

// Slides del carrusel de la página de inicio (se guardan en inicio.slides)
export const MAX_SLIDES = 10;
const CAMPOS_SLIDE = {
  imagen: { max: 500, requerido: true, https: true },
  titulo: { max: 100 },
  subtitulo: { max: 160 },
  botonTexto: { max: 40 },
  botonEnlace: { max: 300, enlace: true },
};

// Enlace del botón: una ruta interna (/algo) o un link https
const esEnlaceValido = (v) => (v.startsWith('/') && !v.startsWith('//')) || esUrlHttps(v);

// Lectura tolerante (lo guardado en la base): descarta campos raros y slides sin imagen
function leerSlides(crudo) {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter((s) => s && typeof s.imagen === 'string' && s.imagen)
    .slice(0, MAX_SLIDES)
    .map((s) => {
      const limpio = { activo: s.activo !== false };
      for (const campo of Object.keys(CAMPOS_SLIDE)) {
        limpio[campo] = typeof s[campo] === 'string' ? s[campo] : '';
      }
      return limpio;
    });
}

// Validación estricta (lo que llega del formulario): agrega los errores al arreglo recibido
function validarSlides(crudo, errores) {
  if (crudo == null) return [];
  if (!Array.isArray(crudo)) {
    errores.push('inicio.slides: tiene que ser una lista');
    return [];
  }
  if (crudo.length > MAX_SLIDES) {
    errores.push(`inicio.slides: máximo ${MAX_SLIDES} slides`);
    return [];
  }
  return crudo.map((s, i) => {
    const limpio = { activo: s?.activo !== false };
    for (const [campo, regla] of Object.entries(CAMPOS_SLIDE)) {
      const nombre = `Slide ${i + 1} (${campo})`;
      const crudoCampo = s?.[campo];
      if (crudoCampo != null && typeof crudoCampo !== 'string') {
        errores.push(`${nombre}: tiene que ser texto`);
        continue;
      }
      const v = (crudoCampo ?? '').trim();
      limpio[campo] = v;
      if (!v) {
        if (regla.requerido) errores.push(`${nombre}: es obligatorio`);
      } else if (v.length > regla.max) {
        errores.push(`${nombre}: máximo ${regla.max} caracteres`);
      } else if (regla.https && !esUrlHttps(v)) {
        errores.push(`${nombre}: tiene que ser un link que empiece con https://`);
      } else if (regla.enlace && !esEnlaceValido(v)) {
        errores.push(`${nombre}: tiene que empezar con / o con https://`);
      }
    }
    return limpio;
  });
}

// Completa lo guardado con los defaults y descarta cualquier campo que no exista en CAMPOS
export function mezclarConDefaults(guardado) {
  const salida = {};
  for (const grupo of Object.keys(CAMPOS)) {
    salida[grupo] = {};
    for (const campo of Object.keys(CAMPOS[grupo])) {
      const v = guardado?.[grupo]?.[campo];
      salida[grupo][campo] = typeof v === 'string' ? v : SITE_DEFAULTS[grupo][campo];
    }
  }
  salida.inicio.slides = leerSlides(guardado?.inicio?.slides);
  return salida;
}

// Copia de la config para el público: sin el email donde llegan los avisos internos.
export function configPublica(config) {
  const copia = structuredClone(config);
  if (copia?.tienda) delete copia.tienda.emailNotificaciones;
  return copia;
}

// Valida lo que llega del formulario. Devuelve el valor limpio (recortado y sin campos extra).
export function validarSiteConfig(entrada) {
  const errores = [];
  const valor = {};
  for (const grupo of Object.keys(CAMPOS)) {
    valor[grupo] = {};
    for (const [campo, regla] of Object.entries(CAMPOS[grupo])) {
      const crudo = entrada?.[grupo]?.[campo];
      const nombre = `${grupo}.${campo}`;
      if (crudo != null && typeof crudo !== 'string') {
        errores.push(`${nombre}: tiene que ser texto`);
        continue;
      }
      const v = (crudo ?? '').trim();
      if (!v) {
        if (regla.requerido) errores.push(`${nombre}: es obligatorio`);
        valor[grupo][campo] = '';
        continue;
      }
      if (v.length > regla.max) {
        errores.push(`${nombre}: máximo ${regla.max} caracteres`);
        continue;
      }
      if (regla.regex && !regla.regex.test(v)) {
        errores.push(`${nombre}: ${regla.mensaje}`);
        continue;
      }
      if (regla.https && !esUrlHttps(v)) {
        errores.push(`${nombre}: tiene que ser un link que empiece con https://`);
        continue;
      }
      valor[grupo][campo] = v;
    }
  }
  valor.inicio.slides = validarSlides(entrada?.inicio?.slides, errores);
  return { ok: errores.length === 0, errores, valor };
}
