import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import MenuConfig from '@/lib/models/MenuConfig';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { ITEMS } from '@/lib/admin-menu';
import { rolesQueVen } from '@/lib/permisos';
import { ICONOS_SECCION, ITEMS_BLOQUEADOS, normalizarMenu, resolverMenu, validarMenu } from '@/lib/menu-config';

function autenticar(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}

const esErrorDeAcceso = (e) =>
  e.message.includes('Token') || e.message.includes('Acceso denegado');

async function leerGuardado() {
  await connectDB();
  return MenuConfig.findById('default').lean();
}

export async function GET(request) {
  try {
    const action = request.nextUrl.searchParams.get('action');

    // Datos para el editor: solo admin
    if (action === 'config') {
      autenticar(request, ['admin']);
      const config = normalizarMenu(await leerGuardado());
      const catalogo = ITEMS.map((i) => ({
        id: i.id,
        etiqueta: i.etiqueta,
        ruta: i.ruta,
        rolesPermitidos: rolesQueVen(i.id),
        bloqueado: ITEMS_BLOQUEADOS.includes(i.id),
      }));
      return NextResponse.json({ success: true, config, catalogo, iconos: ICONOS_SECCION });
    }

    // Menú del panel para quien entra: ya filtrado por su rol y por la tabla de permisos
    const decoded = autenticar(request, ['admin', 'vendedor']);
    const menu = resolverMenu(await leerGuardado(), decoded.role);
    return NextResponse.json({ success: true, menu });
  } catch (error) {
    if (esErrorDeAcceso(error)) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error en admin-menu GET:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    autenticar(request, ['admin']);
    const body = await request.json().catch(() => null);
    const { ok, errores, valor } = validarMenu(body);
    if (!ok) return NextResponse.json({ error: 'El menú tiene problemas', errores }, { status: 400 });

    await connectDB();
    await MenuConfig.findByIdAndUpdate(
      'default',
      { $set: { secciones: valor.secciones, items: valor.items, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ success: true, config: valor });
  } catch (error) {
    if (esErrorDeAcceso(error)) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error en admin-menu PUT:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

// Restaurar de fábrica: borra lo guardado y vuelve al menú del código
export async function DELETE(request) {
  try {
    autenticar(request, ['admin']);
    await connectDB();
    await MenuConfig.deleteOne({ _id: 'default' });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (esErrorDeAcceso(error)) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error en admin-menu DELETE:', error);
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
