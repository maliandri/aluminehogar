import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { connectDB } from '@/lib/db';
import SiteConfig from '@/lib/models/SiteConfig';
import { extractTokenFromHeaders, verifyToken, requireAdmin } from '@/lib/auth-helpers';
import { getSiteConfig, SITE_CONFIG_TAG } from '@/lib/site-config';
import { validarSiteConfig } from '@/lib/site-validate';

function authenticateAdmin(request) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireAdmin(decoded);
  return decoded;
}

// GET público: solo expone datos que el sitio ya muestra (teléfono, WhatsApp, textos, etc.)
export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json({ success: true, config });
}

export async function PUT(request) {
  try {
    authenticateAdmin(request);

    const body = await request.json().catch(() => null);
    const { ok, errores, valor } = validarSiteConfig(body);
    if (!ok) {
      return NextResponse.json({ error: 'Hay datos inválidos', errores }, { status: 400 });
    }

    await connectDB();
    await SiteConfig.findByIdAndUpdate(
      'default',
      { $set: { ...valor, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // expire: 0 → el cambio se ve ya en la próxima visita (no queda sirviendo la copia vieja)
    revalidateTag(SITE_CONFIG_TAG, { expire: 0 });

    return NextResponse.json({ success: true, config: valor });
  } catch (error) {
    if (error.message.includes('Token') || error.message.includes('administrador')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error en site-config PUT:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
