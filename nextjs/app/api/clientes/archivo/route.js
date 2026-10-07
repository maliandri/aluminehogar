import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Cliente from '@/lib/models/Cliente';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { entregarArchivo } from '@/lib/archivos-privados';

// GET /api/clientes/archivo?id=<clienteId>&tipo=<dni_frente|dni_dorso|recibo|servicio>
// Entrega el documento solo al admin o al vendedor que cargó al cliente.
export async function GET(request) {
  try {
    const token = extractTokenFromHeaders(request.headers);
    if (!token) throw new Error('Token de autenticacion requerido');
    const decoded = verifyToken(token);
    requireRole(decoded, ['vendedor', 'admin']);

    const id = request.nextUrl.searchParams.get('id');
    const tipo = request.nextUrl.searchParams.get('tipo');
    const noEncontrado = NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    if (!mongoose.isValidObjectId(id) || !tipo) return noEncontrado;

    await connectDB();
    const cliente = await Cliente.findById(id);
    if (!cliente || (decoded.role !== 'admin' && cliente.creadoPor?.userId !== decoded.userId)) return noEncontrado;

    const archivo = cliente.archivos.find((a) => a.tipo === tipo);
    if (!archivo) return noEncontrado;
    return await entregarArchivo(archivo);
  } catch (error) {
    if (error.message?.includes('Token')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('Acceso denegado')) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error entregando archivo de cliente:', error);
    return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: error.status || 500 });
  }
}
