import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import CreditoVenta from '@/lib/models/CreditoVenta';
import Cliente from '@/lib/models/Cliente';
import User from '@/lib/models/User';
import Product from '@/lib/models/Product';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { getCreditoConfig } from '@/lib/credito-config';
import { calcularPlan, evaluarAprobacion, buscarPlan } from '@/lib/credito-calculo';

async function ajustarStockDeposito(productos, depositoId, delta) {
  if (!depositoId) return;
  for (const item of productos) {
    if (!item.productId) continue;
    const producto = await Product.findById(item.productId);
    if (!producto) continue;

    const stockPorDeposito = producto.stockPorDeposito || [];
    const entrada = stockPorDeposito.find(d => d.depositoId === depositoId);
    if (entrada) {
      entrada.cantidad = Math.max(0, entrada.cantidad + delta * item.cantidad);
    } else if (delta > 0) {
      stockPorDeposito.push({ depositoId, cantidad: delta * item.cantidad });
    }

    producto.stockPorDeposito = stockPorDeposito;
    producto.stock = stockPorDeposito.reduce((sum, d) => sum + d.cantidad, 0);
    await producto.save();
  }
}

function authenticate(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}

async function nombreDe(userId) {
  const u = await User.findById(userId).select('nombre email');
  return u?.nombre || u?.email || '';
}

function limpiarProductos(productos) {
  if (!Array.isArray(productos)) return [];
  return productos.slice(0, 100).map((i) => ({
    productId: String(i?.productId || ''),
    nombre: String(i?.nombre || '').slice(0, 200),
    precio: Number(i?.precio) || 0,
    cantidad: Math.max(1, parseInt(i?.cantidad, 10) || 1)
  }));
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
      const { clienteId, productos, montoTotal, anticipo, frecuencia, cantidadCuotas, depositoId } = body;

      if (!mongoose.isValidObjectId(clienteId)) {
        return NextResponse.json({ error: 'Elegí un cliente' }, { status: 400 });
      }
      const cliente = await Cliente.findById(clienteId);
      // Un cliente ajeno se responde igual que uno inexistente
      if (!cliente || (decoded.role !== 'admin' && (!decoded.userId || cliente.creadoPor?.userId !== decoded.userId))) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      // El plan sale de la tabla del admin: el vendedor solo elige uno activo, no puede inventar el recargo
      const config = await getCreditoConfig();
      const plan = buscarPlan(config.planes, frecuencia, cantidadCuotas);
      if (!plan) {
        return NextResponse.json({ error: 'Ese plan de cuotas no está habilitado' }, { status: 400 });
      }

      const total = Number(montoTotal);
      const ant = Number(anticipo || 0);
      const calculo = calcularPlan({ montoTotal: total, anticipo: ant, cantidadCuotas: plan.cuotas, frecuencia: plan.frecuencia, recargoPorcentaje: plan.recargo });
      if (!calculo.ok) {
        return NextResponse.json({ error: calculo.errores.join('. ') }, { status: 400 });
      }

      const { requiere, motivo } = evaluarAprobacion({ montoTotal: total, plan, montoMaximoSinAprobacion: config.montoMaximoSinAprobacion });
      const quien = { userId: decoded.userId, nombre: await nombreDe(decoded.userId) };

      const credito = new CreditoVenta({
        clienteId: cliente._id,
        clienteNombre: cliente.nombre,
        clienteTelefono: cliente.telefono,
        clienteEmail: cliente.email,
        vendedorId: decoded.userId,
        vendedorNombre: quien.nombre,
        cargadoPor: quien,
        depositoId: depositoId || null,
        productos: limpiarProductos(productos),
        montoTotal: total,
        anticipo: ant,
        anticipoPago: { estado: ant > 0 ? 'pendiente' : 'no_aplica' },
        frecuencia: plan.frecuencia,
        recargoPorcentaje: plan.recargo,
        interes: calculo.interes,
        totalCuotas: calculo.totalCuotas,
        montoCuota: calculo.montoCuota,
        cantidadCuotas: plan.cuotas,
        cuotas: calculo.cuotas,
        estado: requiere ? 'pendiente_aprobacion' : 'activo',
        motivoAprobacion: motivo,
        aprobadoPor: requiere ? undefined : { tipo: 'automatica', userId: quien.userId, nombre: quien.nombre, fecha: new Date() }
      });
      await credito.save();

      // Descuenta stock del deposito elegido (si el vendedor especifico uno)
      await ajustarStockDeposito(credito.productos, depositoId, -1);

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
      const decoded = authenticate(request, ['admin']);
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

      const quien = { userId: decoded.userId, nombre: await nombreDe(decoded.userId) };
      credito.estado = action === 'aprobar' ? 'activo' : 'rechazado';
      if (action === 'aprobar') {
        credito.aprobadoPor = { tipo: 'admin', ...quien, fecha: new Date() };
      } else {
        credito.rechazadoPor = quien;
      }
      await credito.save();

      if (action === 'rechazar') {
        await ajustarStockDeposito(credito.productos, credito.depositoId, 1);
      }

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
