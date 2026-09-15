import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Product from '@/lib/models/Product';
import User from '@/lib/models/User';
import Conversation from '@/lib/models/Conversation';
import { extractTokenFromHeaders, verifyToken, requireAdmin } from '@/lib/auth-helpers';
import { v2 as cloudinary } from 'cloudinary';
import { getCloudinaryUrl, IMG_THUMB, IMG_CARD } from '@/lib/cloudinary';
import { MAPEO_NOMBRES_CLOUDINARY } from '@/lib/cloudinary-mapeo-nombres';
import { generarEspecificaciones, generarDescripcion } from '@/lib/gemini';
import * as xlsx from 'xlsx';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function authenticateAdmin(request) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireAdmin(decoded);
  return decoded;
}

export async function GET(request) {
  try {
    const decoded = authenticateAdmin(request);
    await connectDB();

    const action = request.nextUrl.searchParams.get('action');

    // LIST CONVERSATIONS
    if (action === 'conversations') {
      const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
      const limit = 20;
      const dateFrom = request.nextUrl.searchParams.get('dateFrom');
      const dateTo = request.nextUrl.searchParams.get('dateTo');
      const status = request.nextUrl.searchParams.get('status');

      const query = {};
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
      }
      if (status) query.status = status;

      const [conversations, total] = await Promise.all([
        Conversation.find(query)
          .select('sessionId userInfo status leadCaptured messageCount createdAt lastMessageAt')
          .sort({ lastMessageAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Conversation.countDocuments(query)
      ]);

      return NextResponse.json({
        success: true,
        conversations,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    }

    // GET SINGLE CONVERSATION
    if (action === 'conversation') {
      const id = request.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json({ error: 'ID de conversacion requerido' }, { status: 400 });
      }
      const conversation = await Conversation.findById(id).lean();
      if (!conversation) {
        return NextResponse.json({ error: 'Conversacion no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, conversation });
    }

    // LIST USERS
    if (action === 'users') {
      const users = await User.find({})
        .select('-password -resetCode -resetCodeExpires')
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json({ success: true, users });
    }

    // DEFAULT: LIST PRODUCTS
    const productosRaw = await Product.find({}).sort({ createdAt: -1 }).lean();

    // Transformar productos con imagenes de Cloudinary (igual que la pagina publica)
    const productos = productosRaw.map((p) => {
      const cloudinaryPath = MAPEO_NOMBRES_CLOUDINARY[p.nombre] || p.cloudinaryPublicId || null;

      return {
        ...p,
        _id: p._id.toString(),
        imagenOptimizada: cloudinaryPath
          ? {
              thumb: getCloudinaryUrl(cloudinaryPath, IMG_THUMB),
              card: getCloudinaryUrl(cloudinaryPath, IMG_CARD),
            }
          : (p.imagenOptimizada || p.imagen || ''),
      };
    });

    return NextResponse.json({ success: true, productos, total: productos.length });
  } catch (error) {
    if (error.message.includes('Token') || error.message.includes('administrador')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const decoded = authenticateAdmin(request);
    const action = request.nextUrl.searchParams.get('action');

    // GENERATE SPECS WITH AI
    if (action === 'generate-specs') {
      const { productId, nombre, categoria } = await request.json();

      if (!nombre) {
        return NextResponse.json({ error: 'Nombre del producto requerido' }, { status: 400 });
      }

      try {
        // Generar especificaciones y descripcion en paralelo
        const [especificaciones, descripcion] = await Promise.all([
          generarEspecificaciones(nombre, categoria),
          generarDescripcion(nombre, categoria)
        ]);

        // Si hay productId, actualizar en DB
        if (productId) {
          await connectDB();
          await Product.findByIdAndUpdate(productId, {
            especificaciones,
            descripcion
          });
        }

        return NextResponse.json({
          success: true,
          especificaciones,
          descripcion,
          message: productId ? 'Especificaciones generadas y guardadas' : 'Especificaciones generadas'
        });
      } catch (error) {
        console.error('Error generando especificaciones:', error);
        return NextResponse.json({
          error: 'Error al generar especificaciones con IA',
          details: error.message
        }, { status: 500 });
      }
    }

    // IMPORT STOCK FROM EXCEL
    if (action === 'import-stock') {
      const { excelBase64 } = await request.json();
      if (!excelBase64) {
        return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
      }

      const buffer = Buffer.from(excelBase64.split(',')[1] || excelBase64, 'base64');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils.sheet_to_json(sheet);

      if (!rows.length) {
        return NextResponse.json({ error: 'El archivo esta vacio' }, { status: 400 });
      }

      await connectDB();
      const db = Product.db;
      const collection = db.collection('productos');

      let actualizados = 0;
      const errores = [];

      for (const row of rows) {
        const id = row._id || row.ID || row.id;
        const stock = parseInt(row.stock ?? row.Stock ?? row.STOCK);

        if (!id || isNaN(stock) || stock < 0) {
          errores.push(`Fila inválida: ${JSON.stringify(row)}`);
          continue;
        }

        const result = await collection.updateOne({ _id: String(id) }, { $set: { stock } });
        if (result.matchedCount > 0) actualizados++;
        else errores.push(`Producto no encontrado: ${id}`);
      }

      return NextResponse.json({ success: true, actualizados, errores, total: rows.length });
    }

    // UPLOAD IMAGE
    if (action === 'upload') {
      const { image } = await request.json();
      if (!image) {
        return NextResponse.json({ error: 'Imagen requerida' }, { status: 400 });
      }

      const result = await cloudinary.uploader.upload(image, {
        folder: 'colchones-premium',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' }
        ]
      });

      const optimizedUrl = cloudinary.url(result.public_id, {
        width: 400, height: 400, crop: 'limit', quality: 'auto', fetch_format: 'auto'
      });

      return NextResponse.json({
        success: true,
        url: result.secure_url,
        optimizedUrl,
        publicId: result.public_id
      });
    }

    // CREATE PRODUCT
    await connectDB();
    const { nombre, descripcion, precio, categoria, marca, medidas, imagen, imagenOptimizada, mostrar, stock } = await request.json();

    if (!nombre || !precio || !categoria) {
      return NextResponse.json({ error: 'Nombre, precio y categoria son requeridos' }, { status: 400 });
    }

    const nuevoProducto = new Product({
      nombre,
      descripcion: descripcion || '',
      precio: parseFloat(precio),
      categoria,
      marca: marca || '',
      medidas: medidas || '',
      imagen: imagen || '',
      imagenOptimizada: imagenOptimizada || '',
      mostrar: mostrar || 'si',
      stock: stock || 0
    });

    await nuevoProducto.save();

    return NextResponse.json({
      success: true,
      message: 'Producto creado exitosamente',
      producto: nuevoProducto
    }, { status: 201 });

  } catch (error) {
    if (error.message.includes('Token') || error.message.includes('administrador')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const decoded = authenticateAdmin(request);
    const id = request.nextUrl.searchParams.get('id');
    const action = request.nextUrl.searchParams.get('action');

    if (!id || (action !== 'user' && action !== 'stock')) {
      return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();

    // UPDATE STOCK (por deposito, o legacy: numero unico)
    if (action === 'stock') {
      const db = Product.db;
      const collection = db.collection('productos');

      if (Array.isArray(body.stockPorDeposito)) {
        const stockPorDeposito = body.stockPorDeposito.map(d => ({
          depositoId: d.depositoId,
          cantidad: Math.max(0, parseInt(d.cantidad) || 0)
        }));
        const stockTotal = stockPorDeposito.reduce((sum, d) => sum + d.cantidad, 0);
        await collection.updateOne({ _id: id }, { $set: { stockPorDeposito, stock: stockTotal } });
        return NextResponse.json({ success: true, stock: stockTotal, stockPorDeposito });
      }

      const { stock } = body;
      if (stock === undefined || isNaN(stock) || stock < 0) {
        return NextResponse.json({ error: 'Stock invalido' }, { status: 400 });
      }
      await collection.updateOne({ _id: id }, { $set: { stock: parseInt(stock) } });
      return NextResponse.json({ success: true, stock: parseInt(stock) });
    }

    const { role, banned } = body;

    // No permitir que el admin se modifique a si mismo
    if (id === decoded.userId) {
      return NextResponse.json({ error: 'No puedes modificar tu propia cuenta' }, { status: 400 });
    }

    const updates = {};
    if (role !== undefined) {
      if (!['customer', 'vendedor', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'Rol invalido' }, { status: 400 });
      }
      updates.role = role;
    }
    if (banned !== undefined) updates.banned = banned;

    const user = await User.findByIdAndUpdate(id, updates, { new: true })
      .select('-password -resetCode -resetCodeExpires');

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Enviar email si fue promovido a vendedor o admin
    if (role && role !== 'customer') {
      try {
        const { sendPromotionEmail } = await import('@/lib/email');
        await sendPromotionEmail(user.email, user.nombre || user.email, role);
      } catch (emailError) {
        console.error('Error enviando email de promocion:', emailError);
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    if (error.message.includes('Token') || error.message.includes('administrador')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const decoded = authenticateAdmin(request);
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de producto requerido' }, { status: 400 });
    }

    await connectDB();
    const updates = await request.json();
    delete updates._id;

    const productoActualizado = await Product.findByIdAndUpdate(id, updates, { new: true, runValidators: true });

    if (!productoActualizado) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      producto: productoActualizado
    });
  } catch (error) {
    if (error.message.includes('Token') || error.message.includes('administrador')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const decoded = authenticateAdmin(request);
    const id = request.nextUrl.searchParams.get('id');
    const action = request.nextUrl.searchParams.get('action');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    await connectDB();

    // DELETE USER
    if (action === 'user') {
      if (id === decoded.userId) {
        return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
      }
      const eliminado = await User.findByIdAndDelete(id);
      if (!eliminado) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Usuario eliminado' });
    }

    // DELETE PRODUCT (default)
    const productoEliminado = await Product.findByIdAndDelete(id);
    if (!productoEliminado) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    if (error.message.includes('Token') || error.message.includes('administrador')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
  }
}
