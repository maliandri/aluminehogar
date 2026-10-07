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
  const r = await cloudinary.uploader.upload(dataUrl, {
    type: 'authenticated',
    resource_type: 'auto',
    folder: carpeta,
    overwrite: false
  });
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

// Trae el archivo de Cloudinary con la URL firmada (que nunca sale del servidor) y lo devuelve como respuesta
export async function entregarArchivo(archivo) {
  const res = await fetch(urlFirmada(archivo));
  if (!res.ok) {
    const error = new Error('No se pudo obtener el archivo');
    error.status = 502;
    throw error;
  }
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline'
    }
  });
}
