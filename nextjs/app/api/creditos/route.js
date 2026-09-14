import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import CreditoVenta from '@/lib/models/CreditoVenta';
import PaymentSettings from '@/lib/models/PaymentSettings';
import User from '@/lib/models/User';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';

function authenticate(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}

function calcularCuotas(montoTotal, anticipo, cantidadCuotas) {
  const montoFinanciado = montoTotal - anticipo;
  const montoPorCuota = Math.round((montoFinanciado / cantidadCuotas) * 100) / 100;
  const cuotas = [];
  const hoy = new Date();

  for (let i = 1; i <= cantidadCuotas; i++) {
    const vencimiento = new Date(hoy);
    vencimiento.setMonth(vencimiento.getMonth() + i);
    cuotas.push({ numero: i, monto: montoPorCuota, vencimiento, estado: 'pendiente', fechaPago: null });
  }

  return cuotas;
}

// GET /api/creditos?action=list
export async function GET(request) {
  try {
    const decoded = authenticate(request, ['vendedor', 'admin']);
    await connectDB();

    const query = decoded.role === 'admin' ? {} : { vendedorId: decoded.userId };
    const creditos = await CreditoVenta.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, creditos });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/creditos -> body { action: 'create' | 'marcar-cuota' | 'aprobar' | 'rechazar', ... }
export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const decoded = authenticate(request, ['vendedor', 'admin']);

      const { clienteNombre, clienteTelefono, clienteEmail, productos, montoTotal, anticipo, cantidadCuotas } = body;

      if (!clienteNombre || !montoTotal || !cantidadCuotas) {
        return NextResponse.json({ error: 'Cliente, monto total y cantidad de cuotas son requeridos' }, { status: 400 });
      }
      if (cantidadCuotas < 1) {
        return NextResponse.json({ error: 'La cantidad de cuotas debe ser al menos 1' }, { status: 400 });
      }
      if ((anticipo || 0) >= montoTotal) {
        return NextResponse.json({ error: 'El anticipo no puede ser mayor o igual al monto total' }, { status: 400 });
      }

      const settings = await PaymentSettings.findById('default');
      const montoMaximo = settings?.creditoMontoMaximo ?? Infinity;
      const cuotasMaximo = settings?.creditoCuotasMaximo ?? Infinity;

      const excedeLimites = montoTotal > montoMaximo || cantidadCuotas > cuotasMaximo;

      const vendedorUser = await User.findById(decoded.userId).select('nombre email');

      const credito = new CreditoVenta({
        clienteNombre,
        clienteTelefono,
        clienteEmail,
        vendedorId: decoded.userId,
        vendedorNombre: vendedorUser?.nombre || vendedorUser?.email || '',
        productos: productos || [],
        montoTotal,
        anticipo: anticipo || 0,
        cantidadCuotas,
        cuotas: calcularCuotas(montoTotal, anticipo || 0, cantidadCuotas),
        estado: excedeLimites ? 'pendiente_aprobacion' : 'activo'
      });
      await credito.save();

      return NextResponse.json({ success: true, credito }, { status: 201 });
    }

    if (action === 'marcar-cuota') {
      const decoded = authenticate(request, ['vendedor', 'admin']);
      const { id, numero } = body;

      if (!id || !numero) {
        return NextResponse.json({ error: 'ID de credito y numero de cuota son requeridos' }, { status: 400 });
      }

      const credito = await CreditoVenta.findById(id);
      if (!credito) {
        return NextResponse.json({ error: 'Credito no encontrado' }, { status: 404 });
      }
      if (decoded.role !== 'admin' && credito.vendedorId.toString() !== decoded.userId) {
        return NextResponse.json({ error: 'Acceso denegado: no es el vendedor de este credito' }, { status: 403 });
      }

      const cuota = credito.cuotas.find(c => c.numero === numero);
      if (!cuota) {
        return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 });
      }

      cuota.estado = 'pagada';
      cuota.fechaPago = new Date();

      if (credito.cuotas.every(c => c.estado === 'pagada')) {
        credito.estado = 'completado';
      }

      await credito.save();

      return NextResponse.json({ success: true, credito });
    }

    if (action === 'aprobar' || action === 'rechazar') {
      authenticate(request, ['admin']);
      const { id } = body;

      if (!id) {
        return NextResponse.json({ error: 'ID de credito requerido' }, { status: 400 });
      }

      const credito = await CreditoVenta.findById(id);
      if (!credito) {
        return NextResponse.json({ error: 'Credito no encontrado' }, { status: 404 });
      }
      if (credito.estado !== 'pendiente_aprobacion') {
        return NextResponse.json({ error: 'Este credito no esta pendiente de aprobacion' }, { status: 400 });
      }

      credito.estado = action === 'aprobar' ? 'activo' : 'rechazado';
      await credito.save();

      return NextResponse.json({ success: true, credito });
    }

    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error) {
  console.error('Error en creditos:', error);
  if (error.message?.startsWith('Acceso denegado')) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error.message === 'Token invalido o expirado' || error.message === 'Token de autenticacion requerido') {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
}
