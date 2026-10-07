// Validación de archivos que llegan como data URL (documentos de clientes y comprobantes). Módulo puro.

export const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_BYTES = 3 * 1024 * 1024;

// Cabeceras reales (magic numbers): el tipo declarado en la data URL lo manda el cliente y no alcanza
const empieza = (buf, bytes, desde = 0) => bytes.every((b, i) => buf[desde + i] === b);
const ascii = (txt) => [...txt].map((c) => c.charCodeAt(0));
const FIRMAS = {
  'image/jpeg': (b) => empieza(b, [0xff, 0xd8, 0xff]),
  'image/png': (b) => empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': (b) => empieza(b, ascii('RIFF')) && empieza(b, ascii('WEBP'), 8),
  'application/pdf': (b) => empieza(b, ascii('%PDF-'))
};

export function validarArchivo(dataUrl, maxBytesEntrada = MAX_BYTES) {
  const maxBytes = typeof maxBytesEntrada === 'number' && Number.isFinite(maxBytesEntrada) && maxBytesEntrada > 0 ? maxBytesEntrada : MAX_BYTES;
  if (typeof dataUrl !== 'string') return { ok: false, error: 'Archivo inválido' };
  const m = dataUrl.match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!m) return { ok: false, error: 'Archivo inválido' };

  const mime = m[1].toLowerCase();
  if (!MIMES_PERMITIDOS.includes(mime)) return { ok: false, error: 'Solo se aceptan imágenes JPG, PNG o WebP, o PDF' };

  const b64 = m[2];
  if (b64.length % 4 !== 0) return { ok: false, error: 'Archivo inválido' };
  const relleno = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = (b64.length / 4) * 3 - relleno;
  if (bytes <= 0) return { ok: false, error: 'Archivo inválido' };
  if (bytes > maxBytes) return { ok: false, error: `El archivo no puede pesar más de ${Math.round(maxBytes / 1024 / 1024)} MB` };

  // Se decodifican solo los primeros bytes (16 chars base64 = 12 bytes)
  const cabecera = Buffer.from(b64.slice(0, 16), 'base64');
  if (!FIRMAS[mime](cabecera)) return { ok: false, error: 'El contenido del archivo no coincide con su tipo' };
  return { ok: true, mime, bytes };
}
