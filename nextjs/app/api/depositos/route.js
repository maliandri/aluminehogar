import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Deposito from '@/lib/models/Deposito';
import { extractTokenFromHeaders, verifyToken, requireAdmin } from '@/lib/auth-helpers';

function authenticateAdmin(request) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireAdmin(decoded);
  return decoded;
}

// GET publico: el listado de depositos activos lo necesita el vendedor para elegir de donde sale el stock
export async function GET() {
  try {
    await connectDB();
    const depositos = await Deposito.find({}).sort({ createdAt: 1 }).lean();
    return NextResponse.json({ success: true, depositos });
  } catch (error) {
    console.error('Error en depositos GET:', error);
    return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    authenticateAdmin(request);
    await connectDB();
    const { codigo, nombre, esVirtualVendedor } = await request.json();

    if (!codigo || !nombre) {
      return NextResponse.json({ error: 'Codigo y nombre son requeridos' }, { status: 400 });
    }

    const deposito = await Deposito.create({ codigo, nombre, esVirtualVendedor: !!esVirtualVendedor });
    return NextResponse.json({ success: true, deposito }, { status: 201 });
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
    const deposito = await Deposito.findByIdAndUpdate(id, body, { new: true });
    if (!deposito) return NextResponse.json({ error: 'Deposito no encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, deposito });
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

    await Deposito.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error) {
  console.error('Error en depositos:', error);
  if (error.message?.includes('administrador') || error.message?.includes('Token')) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
}
