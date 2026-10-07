import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import CreditoVenta from '@/lib/models/CreditoVenta';
import Cliente from '@/lib/models/Cliente';
import User from '@/lib/models/User';
import Product from '@/lib/models/Product';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { getCreditoConfig } from '@/lib/credito-config';
import { subirPrivado, borrarPrivado } from '@/lib/archivos-privados';
import { calcularPlan, evaluarAprobacion, buscarPlan } from '@/lib/credito-calculo';

async function ajustarStockDeposito(productos, depositoId, delta) {
  if (!depositoId) return;
  for (const item of productos || []) {
    // Los productos se identifican con un _id de texto (ej. 'ALM-0001'); un id vacío o raro se ignora
    if (typeof item?.productId !== 'string' || !item.productId || item.productId.length > 100) continue;
    try {
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
    } catch (error) {
      // El crédito ya está guardado: un problema de stock no debe hacer fallar el pedido
      console.error('No se pudo ajustar el stock de', item.productId, error);
    }
  }
}

// Forma pública de un crédito: los comprobantes salen sin los datos internos de Cloudinary
function publicoPago(pago) {
  if (!pago || typeof pago !== 'object') return pago;
  const { comprobante, ...resto } = pago;
  return comprobante ? { ...resto, tieneComprobante: true } : resto;
}

function publicoCredito(credito) {
  const c = credito && typeof credito.toObject === 'function' ? credito.toObject() : { ...credito };
  if (c.anticipoPago) c.anticipoPago = publicoPago(c.anticipoPago);
  if (Array.isArray(c.cuotas)) c.cuotas = c.cuotas.map((q) => (q?.pago ? { ...q, pago: publicoPago(q.pago) } : q));
  return c;
}

const ROLES_ACCION = {
  create: ['vendedor', 'admin'],
  'registrar-cobro': ['vendedor', 'admin'],
  aprobar: ['admin'],
  rechazar: ['admin']
};

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

    return NextResponse.json({ success: true, creditos: creditos.map(publicoCredito) });
  } catch (error) {
    return handleError(error);
  }
}

// POST /api/creditos -> body { action: 'create' | 'registrar-cobro' | 'aprobar' | 'rechazar', ... }
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const { action } = body;
    if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(ROLES_ACCION, action)) {
      return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
    }

    // Primero quién es y qué puede hacer; recién después se toca la base
    const decoded = authenticate(request, ROLES_ACCION[action]);
    await connectDB();

    if (action === 'create') {
      const { clienteId, productos, montoTotal, anticipo, frecuencia, cantidadCuotas, depositoId } = body;

      if (!mongoose.isValidObjectId(clienteId)) {
        return NextResponse.json({ error: 'Elegí un cliente' }, { status: 400 });
      }
      if (depositoId !== undefined && depositoId !== null && typeof depositoId !== 'string') {
        return NextResponse.json({ error: 'Depósito inválido' }, { status: 400 });
      }
      const deposito = typeof depositoId === 'string' && depositoId.trim() ? depositoId.trim() : null;
      const cliente = await Cliente.findById(clienteId);
      // Un cliente ajeno se responde igual que uno inexistente
      if (!cliente || (decoded.role !== 'admin' && (!decoded.userId || cliente.creadoPor?.userId !== decoded.userId))) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }

      // El plan sale de la tabla del admin: el vendedor solo elige uno activo, no puede inventar la tasa
      const config = await getCreditoConfig();
      const plan = buscarPlan(config.planes, frecuencia, cantidadCuotas);
      if (!plan) {
        return NextResponse.json({ error: 'Ese plan de cuotas no está habilitado' }, { status: 400 });
      }

      const total = Number(montoTotal);
      // La entrega del plan es el mínimo; si el vendedor manda una mayor (el cliente quiere dar más), se respeta
      const calculo = calcularPlan({
        montoTotal: total,
        entregaPorcentaje: plan.entrega,
        tasaPorcentaje: plan.tasa,
        anticipo: anticipo === undefined || anticipo === null || anticipo === '' ? undefined : Number(anticipo),
        cantidadCuotas: plan.cuotas,
        frecuencia: plan.frecuencia
      });
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
        depositoId: deposito,
        productos: limpiarProductos(productos),
        montoTotal: total,
        anticipo: calculo.anticipo,
        anticipoPago: { estado: calculo.anticipo > 0 ? 'pendiente' : 'no_aplica' },
        frecuencia: plan.frecuencia,
        // % total de recargo sobre el saldo, para mostrar en los listados
        recargoPorcentaje: calculo.montoFinanciado > 0 ? Math.round((calculo.interes / calculo.montoFinanciado) * 10000) / 100 : 0,
        entregaPorcentaje: plan.entrega,
        tasaPorcentaje: plan.tasa,
        capitalCuota: calculo.capitalCuota,
        interesCuota: calculo.interesPorCuota,
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
      await ajustarStockDeposito(credito.productos, deposito, -1);

      return NextResponse.json({ success: true, credito: publicoCredito(credito) }, { status: 201 });
    }

    if (action === 'registrar-cobro') {
      const { id, metodo, archivo } = body;
      const numero = Number(body.numero);

      if (!mongoose.isValidObjectId(id) || !Number.isInteger(numero) || numero < 0) {
        return NextResponse.json({ error: 'Crédito y número de cuota son requeridos' }, { status: 400 });
      }
      if (!['comprobante', 'efectivo'].includes(metodo)) {
        return NextResponse.json({ error: 'Elegí cómo se cobró: comprobante o cobrado en mano' }, { status: 400 });
      }

      const credito = await CreditoVenta.findById(id);
      // Un crédito ajeno se responde igual que uno inexistente
      if (!credito || (decoded.role !== 'admin' && (!decoded.userId || String(credito.vendedorId) !== decoded.userId))) {
        return NextResponse.json({ error: 'Credito no encontrado' }, { status: 404 });
      }
      if (credito.estado === 'rechazado') {
        return NextResponse.json({ error: 'El crédito fue rechazado' }, { status: 400 });
      }

      let cuota = null;
      if (numero === 0) {
        if (!(credito.anticipo > 0)) {
          return NextResponse.json({ error: 'Este crédito no tiene anticipo' }, { status: 400 });
        }
        if (credito.anticipoPago?.estado === 'cobrado') {
          return NextResponse.json({ error: 'El anticipo ya está registrado como cobrado' }, { status: 409 });
        }
      } else {
        if (credito.estado !== 'activo') {
          return NextResponse.json({ error: 'El crédito tiene que estar activo para cobrar cuotas' }, { status: 400 });
        }
        cuota = credito.cuotas.find((c) => c.numero === numero);
        if (!cuota) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 });
        if (cuota.estado === 'pagada') {
          return NextResponse.json({ error: 'Esa cuota ya está registrada como pagada' }, { status: 409 });
        }
      }

      let comprobante;
      if (metodo === 'comprobante') {
        comprobante = await subirPrivado(archivo, `comprobantes/${credito._id}`);
      }
      const registradoPor = { userId: decoded.userId, nombre: await nombreDe(decoded.userId) };
      const fecha = new Date();
      const pago = { metodo, registradoPor, fecha };
      if (comprobante) pago.comprobante = comprobante;

      // Atómico: si dos cobros llegan a la vez, solo uno gana el filtro (el otro no matchea)
      const resultado = numero === 0
        ? await CreditoVenta.updateOne(
          { _id: credito._id, 'anticipoPago.estado': { $ne: 'cobrado' } },
          { $set: { anticipoPago: { estado: 'cobrado', ...pago } } }
        )
        : await CreditoVenta.updateOne(
          { _id: credito._id, cuotas: { $elemMatch: { numero, estado: 'pendiente' } } },
          { $set: { 'cuotas.$.estado': 'pagada', 'cuotas.$.fechaPago': fecha, 'cuotas.$.pago': pago } }
        );
      if (resultado.matchedCount === 0) {
        if (comprobante) await borrarPrivado(comprobante);
        return NextResponse.json({ error: 'Ese pago ya está registrado' }, { status: 409 });
      }

      let fresco = await CreditoVenta.findById(credito._id);
      if (fresco && fresco.estado === 'activo' && fresco.cuotas.every((c) => c.estado === 'pagada')) {
        await CreditoVenta.updateOne({ _id: credito._id, estado: 'activo' }, { $set: { estado: 'completado' } });
        fresco = await CreditoVenta.findById(credito._id);
      }

      return NextResponse.json({ success: true, credito: publicoCredito(fresco) });
    }

    if (action === 'aprobar' || action === 'rechazar') {
      const { id } = body;

      if (!mongoose.isValidObjectId(id)) {
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

      return NextResponse.json({ success: true, credito: publicoCredito(credito) });
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
  if (error.status === 400 || error.status === 502) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
}
