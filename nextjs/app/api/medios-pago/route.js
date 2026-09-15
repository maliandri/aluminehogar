import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import MedioPago from '@/lib/models/MedioPago';
import { extractTokenFromHeaders, verifyToken, requireAdmin } from '@/lib/auth-helpers';

function authenticateAdmin(request) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireAdmin(decoded);
  return decoded;
}

// GET publico: el checkout y el panel de vendedor necesitan leer los medios de pago sin friccion de rol
export async function GET(request) {
  try {
    await connectDB();
    const scope = request.nextUrl.searchParams.get('scope');
    const query = { activo: true };
    if (scope) query.scope = scope;

    const mediosPago = await MedioPago.find(query).sort({ createdAt: 1 }).lean();
    return NextResponse.json({ success: true, mediosPago });
  } catch (error) {
    console.error('Error en medios-pago GET:', error);
    return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    authenticateAdmin(request);
    await connectDB();
    const body = await request.json();

    if (!body.nombre) {
      return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
    }

    const medioPago = await MedioPago.create(body);
    return NextResponse.json({ success: true, medioPago }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request) {
  try {
    authenticateAdmin(request);
    await connectDB();
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const body = await request.json();
    const medioPago = await MedioPago.findByIdAndUpdate(id, body, { new: true });
    if (!medioPago) return NextResponse.json({ error: 'Medio de pago no encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, medioPago });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request) {
  try {
    authenticateAdmin(request);
    await connectDB();
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await MedioPago.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error) {
  console.error('Error en medios-pago:', error);
  if (error.message?.includes('administrador') || error.message?.includes('Token')) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
}
