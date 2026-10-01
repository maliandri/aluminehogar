const SERPAPI_URL = 'https://serpapi.com/search.json';

/**
 * Busca imágenes de producto en Google Imágenes vía SerpAPI.
 * Devuelve candidatos para que el admin elija; no sube nada.
 */
export async function buscarImagenes(consulta, limite = 12) {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    const err = new Error('SERPAPI_API_KEY no esta configurada');
    err.status = 503;
    throw err;
  }

  const params = new URLSearchParams({
    engine: 'google_images',
    q: consulta,
    google_domain: 'google.com.ar',
    gl: 'ar',
    hl: 'es',
    safe: 'active',
    api_key: apiKey
  });

  const res = await fetch(`${SERPAPI_URL}?${params}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    // SerpAPI devuelve {error: "..."} (clave inválida, sin créditos, etc.)
    const err = new Error(data.error || `SerpAPI respondio ${res.status}`);
    err.status = 502;
    throw err;
  }

  return (data.images_results || [])
    .filter((r) => r.original && r.thumbnail && /^https:\/\//.test(r.original))
    .slice(0, limite)
    .map((r) => ({
      url: r.original,
      miniatura: r.thumbnail,
      ancho: r.original_width || null,
      alto: r.original_height || null,
      titulo: r.title || '',
      fuente: r.source || '',
      pagina: r.link || ''
    }));
}
