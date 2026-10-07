// Convierte un archivo elegido en el navegador a data URL. Las fotos se achican antes de subir
// (las del celular pesan varios MB y las funciones del servidor aceptan hasta 3 MB).
const MAX_BYTES = 3 * 1024 * 1024;
const IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];

function leerComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export async function archivoADataUrl(file, { maxDim = 1600, calidad = 0.82 } = {}) {
  if (!file) throw new Error('No elegiste ningún archivo');

  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error('El PDF no puede pesar más de 3 MB');
    return leerComoDataUrl(file);
  }
  if (!IMAGENES.includes(file.type)) throw new Error('Solo se aceptan imágenes JPG, PNG o WebP, o PDF');

  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', calidad);

  // Aproximación del tamaño real del binario a partir del base64
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
  if (bytes > MAX_BYTES) throw new Error('La imagen sigue pesando más de 3 MB después de achicarla');
  return dataUrl;
}
