import { unstable_cache } from 'next/cache';
import { connectDB } from '@/lib/db';
import SiteConfig from '@/lib/models/SiteConfig';
import { SITE_DEFAULTS } from '@/lib/site-defaults';
import { mezclarConDefaults } from '@/lib/site-validate';

export const SITE_CONFIG_TAG = 'site-config';

// Si la lectura lanza, unstable_cache no guarda nada: un error de la base no queda cacheado
const leerCacheado = unstable_cache(
  async () => {
    await connectDB();
    const doc = await SiteConfig.findById('default').lean();
    return mezclarConDefaults(doc);
  },
  ['site-config-v1'],
  { tags: [SITE_CONFIG_TAG], revalidate: 3600 }
);

// Nunca lanza: ante cualquier problema devuelve los valores de fábrica (el sitio se ve como siempre)
export async function getSiteConfig() {
  try {
    return await leerCacheado();
  } catch (error) {
    console.error('SiteConfig: usando valores por defecto:', error.message);
    return SITE_DEFAULTS;
  }
}
