import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import CreditoVenta from '@/lib/models/CreditoVenta';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { entregarArchivo } from '@/lib/archivos-privados';

// GET /api/creditos/comprobante?id=<creditoId>&numero=<0 anticipo | n° de cuota>
// Entrega el comprobante solo al admin o al vendedor dueño del crédito.
export async function GET(request) {
  try {
    const token = extractTokenFromHeaders(request.headers);
    if (!token) throw new Error('Token de autenticacion requerido');
    const decoded = verifyToken(token);
    requireRole(decoded, ['vendedor', 'admin']);

    const id = request.nextUrl.searchParams.get('id');
    const numero = Number(request.nextUrl.searchParams.get('numero'));
    const noEncontrado = NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(numero) || numero < 0) return noEncontrado;

    await connectDB();
    const credito = await CreditoVenta.findById(id);
    if (!credito || (decoded.role !== 'admin' && (!decoded.userId || String(credito.vendedorId) !== decoded.userId))) return noEncontrado;

    const pago = numero === 0 ? credito.anticipoPago : credito.cuotas.find((c) => c.numero === numero)?.pago;
    if (!pago || pago.metodo !== 'comprobante' || !pago.comprobante?.publicId) return noEncontrado;
    return await entregarArchivo(pago.comprobante);
  } catch (error) {
    if (error.message?.includes('Token')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('Acceso denegado')) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error entregando comprobante:', error);
    return NextResponse.json({ error: 'No se pudo obtener el comprobante' }, { status: error.status || 500 });
  }
}
