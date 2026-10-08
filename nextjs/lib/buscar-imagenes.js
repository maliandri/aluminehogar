const SERPAPI_URL = 'https://serpapi.com/search.json';

/**
 * Versión corta de la consulta: sin códigos entre paréntesis, sin palabras repetidas
 * y con un máximo de 6 palabras. Las consultas largas con códigos de proveedor
 * suelen no devolver nada en SerpAPI aunque Google sí encuentre imágenes.
 */
export function simplificarConsulta(consulta) {
  const vistas = new Set();
  const palabras = String(consulta)
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter((p) => {
      const clave = p.toLowerCase();
      if (!p || vistas.has(clave)) return false;
      vistas.add(clave);
      return true;
    });
  return palabras.slice(0, 6).join(' ');
}

async function consultarSerpApi(consulta, apiKey) {
  const params = new URLSearchParams({
    engine: 'google_images',
    q: consulta,
    google_domain: 'google.com.ar',
    gl: 'ar',
    hl: 'es',
    api_key: apiKey
  });

  const res = await fetch(`${SERPAPI_URL}?${params}`, { signal: AbortSignal.timeout(20000) });
  const data = await res.json().catch(() => ({}));
  // Una búsqueda sin resultados no es una falla: SerpAPI la informa como error
  if (/hasn't returned any results/i.test(data.error || '')) return [];
  if (!res.ok || data.error) {
    // SerpAPI devuelve {error: "..."} (clave inválida, sin créditos, etc.)
    const err = new Error(data.error || `SerpAPI respondio ${res.status}`);
    err.status = 502;
    throw err;
  }
  return data.images_results || [];
}

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

  let resultados = await consultarSerpApi(consulta, apiKey);
  if (resultados.length === 0) {
    const corta = simplificarConsulta(consulta);
    if (corta && corta !== consulta) resultados = await consultarSerpApi(corta, apiKey);
  }

  return resultados
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
