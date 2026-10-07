// Validación de archivos que llegan como data URL (documentos de clientes y comprobantes). Módulo puro.

export const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_BYTES = 3 * 1024 * 1024;

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
  return { ok: true, mime, bytes };
}
