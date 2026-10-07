import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Cliente from '@/lib/models/Cliente';
import User from '@/lib/models/User';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { validarCliente, normalizarDocumento, TIPOS_ARCHIVO } from '@/lib/cliente-validate';
import { subirPrivado, borrarPrivado } from '@/lib/archivos-privados';

function authenticate(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}

const esDueno = (cliente, decoded) => decoded.role === 'admin' || Boolean(decoded.userId && cliente.creadoPor?.userId === decoded.userId);
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Forma pública: nunca incluye el publicId interno de los archivos
function publico(c) {
  return {
    _id: String(c._id),
    nombre: c.nombre,
    tipoDocumento: c.tipoDocumento,
    numeroDocumento: c.numeroDocumento,
    telefono: c.telefono,
    email: c.email,
    domicilio: c.domicilio,
    creadoPor: c.creadoPor,
    archivos: (c.archivos || []).map((a) => ({ tipo: a.tipo, formato: a.formato, fecha: a.fecha })),
    createdAt: c.createdAt
  };
}

function handleError(error, contexto) {
  if (error.message?.startsWith('Acceso denegado') || error.message?.includes('Token')) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('Token') ? 401 : 403 });
  }
  if (error.status === 400 || error.status === 502) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(`Error en clientes ${contexto}:`, error);
  return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
}

async function cargarCliente(id, decoded) {
  if (!mongoose.isValidObjectId(id)) return { respuesta: NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 }) };
  const cliente = await Cliente.findById(id);
  // Un cliente ajeno se responde igual que uno inexistente: no se revela que existe
  if (!cliente || !esDueno(cliente, decoded)) return { respuesta: NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 }) };
  return { cliente };
}

export async function GET(request) {
  try {
    const decoded = authenticate(request, ['vendedor', 'admin']);
    await connectDB();
    const params = request.nextUrl.searchParams;

    const id = params.get('id');
    if (id) {
      const { cliente, respuesta } = await cargarCliente(id, decoded);
      if (respuesta) return respuesta;
      return NextResponse.json({ success: true, cliente: publico(cliente) });
    }

    const filtro = decoded.role === 'admin' ? {} : { 'creadoPor.userId': decoded.userId };
    const q = (params.get('q') || '').trim().slice(0, 60);
    if (q) {
      const rx = new RegExp(escaparRegex(q), 'i');
      filtro.$or = [{ nombre: rx }, { numeroDocumento: new RegExp(escaparRegex(normalizarDocumento(q)), 'i') }, { telefono: rx }];
    }
    const clientes = await Cliente.find(filtro).sort({ createdAt: -1 }).limit(50);
    return NextResponse.json({ success: true, clientes: clientes.map(publico) });
  } catch (error) {
    return handleError(error, 'GET');
  }
}

export async function POST(request) {
  try {
    const decoded = authenticate(request, ['vendedor', 'admin']);
    const body = await request.json().catch(() => ({}));
    const { action } = body || {};
    // Reasignar es solo del administrador: se corta antes de tocar la base
    if (action === 'reasignar' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado. Solo el administrador puede reasignar clientes.' }, { status: 403 });
    }
    await connectDB();

    if (action === 'create') {
      const { ok, errores, valor } = validarCliente(body.cliente);
      if (!ok) return NextResponse.json({ error: 'Hay datos inválidos', errores }, { status: 400 });

      const existente = await Cliente.findOne({ tipoDocumento: valor.tipoDocumento, numeroDocumento: valor.numeroDocumento }).select('creadoPor');
      if (existente) {
        const mensaje = decoded.role === 'admin' || existente.creadoPor?.userId === decoded.userId
          ? 'Ya existe un cliente con ese documento. Buscalo en la lista.'
          : 'Ya existe un cliente con ese documento, cargado por otro vendedor. Pedile al administrador que te lo asigne.';
        return NextResponse.json({ error: mensaje }, { status: 409 });
      }

      const usuario = await User.findById(decoded.userId).select('nombre email');
      const cliente = await Cliente.create({
        ...valor,
        creadoPor: { userId: decoded.userId, nombre: usuario?.nombre || usuario?.email || '' }
      });
      return NextResponse.json({ success: true, cliente: publico(cliente) }, { status: 201 });
    }

    if (action === 'update') {
      const { cliente, respuesta } = await cargarCliente(body.id, decoded);
      if (respuesta) return respuesta;

      // El documento no se cambia una vez cargado: se valida con el que ya tiene
      const { ok, errores, valor } = validarCliente({
        ...body.cliente,
        tipoDocumento: cliente.tipoDocumento,
        numeroDocumento: cliente.numeroDocumento
      });
      if (!ok) return NextResponse.json({ error: 'Hay datos inválidos', errores }, { status: 400 });

      cliente.nombre = valor.nombre;
      cliente.telefono = valor.telefono;
      cliente.email = valor.email;
      cliente.domicilio = valor.domicilio;
      cliente.updatedAt = new Date();
      await cliente.save();
      return NextResponse.json({ success: true, cliente: publico(cliente) });
    }

    if (action === 'subir-archivo') {
      const { cliente, respuesta } = await cargarCliente(body.id, decoded);
      if (respuesta) return respuesta;
      if (typeof body.tipo !== 'string' || !Object.prototype.hasOwnProperty.call(TIPOS_ARCHIVO, body.tipo)) {
        return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 });
      }

      const subido = await subirPrivado(body.archivo, `clientes/${cliente._id}`);
      const usuario = await User.findById(decoded.userId).select('nombre email');
      const anterior = cliente.archivos.find((a) => a.tipo === body.tipo);
      const nuevo = { tipo: body.tipo, ...subido, subidoPor: { userId: decoded.userId, nombre: usuario?.nombre || usuario?.email || '' }, fecha: new Date() };
      try {
        // Actualizaciones atómicas: subidas simultáneas de distintos documentos no se pisan
        const r = await Cliente.updateOne({ _id: cliente._id, 'archivos.tipo': body.tipo }, { $set: { 'archivos.$': nuevo, updatedAt: new Date() } });
        if (r.matchedCount === 0) {
          await Cliente.updateOne({ _id: cliente._id, 'archivos.tipo': { $ne: body.tipo } }, { $push: { archivos: nuevo }, $set: { updatedAt: new Date() } });
        }
      } catch (errorDB) {
        await borrarPrivado(subido);
        throw errorDB;
      }
      if (anterior) await borrarPrivado(anterior);
      const actualizado = await Cliente.findById(cliente._id);
      return NextResponse.json({ success: true, cliente: publico(actualizado) });
    }

    if (action === 'reasignar') {
      const { id, vendedorId } = body;
      if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(vendedorId)) {
        return NextResponse.json({ error: 'Cliente y vendedor son requeridos' }, { status: 400 });
      }
      const [cliente, destino] = await Promise.all([Cliente.findById(id), User.findById(vendedorId).select('nombre email role')]);
      if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      if (!destino || !['vendedor', 'admin'].includes(destino.role)) {
        return NextResponse.json({ error: 'El destino tiene que ser un vendedor' }, { status: 400 });
      }
      // Los créditos ya otorgados al cliente conservan su vendedor original
      cliente.creadoPor = { userId: String(destino._id), nombre: destino.nombre || destino.email };
      cliente.updatedAt = new Date();
      await cliente.save();
      return NextResponse.json({ success: true, cliente: publico(cliente) });
    }

    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
  } catch (error) {
    if (error.code === 11000) return NextResponse.json({ error: 'Ya existe un cliente con ese documento' }, { status: 409 });
    return handleError(error, 'POST');
  }
}
