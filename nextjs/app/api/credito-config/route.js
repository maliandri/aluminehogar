import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import CreditoConfig from '@/lib/models/CreditoConfig';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { getCreditoConfig } from '@/lib/credito-config';
import { validarCreditoConfig } from '@/lib/credito-calculo';

function authenticate(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}

function handleError(error, contexto) {
  if (error.message?.startsWith('Acceso denegado') || error.message?.includes('Token')) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error(`Error en credito-config ${contexto}:`, error);
  return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
}

// El vendedor necesita ver los planes habilitados para armar un crédito; el admin ve todos
export async function GET(request) {
  try {
    const decoded = authenticate(request, ['admin', 'vendedor']);
    const config = await getCreditoConfig();
    if (decoded.role !== 'admin') {
      config.planes = config.planes.filter((p) => p.activo);
    }
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return handleError(error, 'GET');
  }
}

export async function PUT(request) {
  try {
    authenticate(request, ['admin']);
    const body = await request.json().catch(() => null);
    const { ok, errores, valor } = validarCreditoConfig(body);
    if (!ok) return NextResponse.json({ error: 'La configuración tiene problemas', errores }, { status: 400 });

    await connectDB();
    await CreditoConfig.findByIdAndUpdate(
      'default',
      { $set: { montoMaximoSinAprobacion: valor.montoMaximoSinAprobacion, planes: valor.planes, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ success: true, config: valor });
  } catch (error) {
    return handleError(error, 'PUT');
  }
}
