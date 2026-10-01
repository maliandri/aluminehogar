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
  return salida;
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
  return { ok: errores.length === 0, errores, valor };
}
