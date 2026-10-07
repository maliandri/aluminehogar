import cloudinary from '@/lib/cloudinary';
import { validarArchivo } from '@/lib/archivo-validate';

// Los documentos y comprobantes se guardan con type "authenticated": no existe un link público.
// Solo se entregan a través de endpoints propios que validan quién pide el archivo.

export async function subirPrivado(dataUrl, carpeta) {
  const v = validarArchivo(dataUrl);
  if (!v.ok) {
    const error = new Error(v.error);
    error.status = 400;
    throw error;
  }
  let r;
  try {
    r = await cloudinary.uploader.upload(dataUrl, {
      type: 'authenticated',
      resource_type: 'auto',
      folder: carpeta,
      overwrite: false
    });
  } catch (err) {
    // El SDK de Cloudinary lanza { error: { message, http_code } }: se registra pero no se expone
    console.error('Error al subir archivo privado:', err?.error?.message || err?.message || err);
    const error = new Error('No se pudo guardar el archivo. Probá de nuevo.');
    error.status = 502;
    throw error;
  }
  const formatosOk = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  if (r.resource_type !== 'image' || !formatosOk.includes(String(r.format || '').toLowerCase())) {
    await borrarPrivado({ publicId: r.public_id, resourceType: r.resource_type });
    const error = new Error('El archivo no es una imagen o PDF válido');
    error.status = 400;
    throw error;
  }
  return { publicId: r.public_id, resourceType: r.resource_type, formato: r.format || null, version: r.version || null };
}

export async function borrarPrivado(archivo) {
  try {
    await cloudinary.uploader.destroy(archivo.publicId, { type: 'authenticated', resource_type: archivo.resourceType });
  } catch (error) {
    console.error('No se pudo borrar un archivo privado:', error.message);
  }
}

function urlFirmada(archivo) {
  return cloudinary.url(archivo.publicId, {
    resource_type: archivo.resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: archivo.formato || undefined,
    version: archivo.version || undefined
  });
}

const TIPOS_CONTENIDO = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

// Trae el archivo de Cloudinary con la URL firmada (que nunca sale del servidor) y lo devuelve como respuesta
export async function entregarArchivo(archivo) {
  const res = await fetch(urlFirmada(archivo));
  if (!res.ok) {
    const error = new Error('No se pudo obtener el archivo');
    error.status = 502;
    throw error;
  }
  const tipo = TIPOS_CONTENIDO[String(archivo.formato || '').toLowerCase()];
  // El Content-Type nunca se copia de Cloudinary: se fija según lo que validamos al subir
  return new Response(res.body, {
    headers: {
      'Content-Type': tipo || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'Content-Disposition': tipo ? 'inline' : 'attachment'
    }
  });
}
