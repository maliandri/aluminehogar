import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import PaymentSettings from '@/lib/models/PaymentSettings';
import { extractTokenFromHeaders, verifyToken, requireAdmin } from '@/lib/auth-helpers';

async function getOrCreateSettings() {
  let settings = await PaymentSettings.findById('default');
  if (!settings) {
    settings = await PaymentSettings.create({ _id: 'default' });
  }
  return settings;
}

// GET publico: el checkout necesita leer el maximo de cuotas sin estar logueado
export async function GET() {
  try {
    await connectDB();
    const settings = await getOrCreateSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Error en payment-settings GET:', error);
    return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
}

// PUT protegido: solo admin puede cambiar los limites
export async function PUT(request) {
  try {
    const token = extractTokenFromHeaders(request.headers);
    if (!token) {
      return NextResponse.json({ error: 'Token de autenticacion requerido' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    requireAdmin(decoded);

    await connectDB();
    const body = await request.json();
    const { maxCuotasMercadoPago, creditoMontoMaximo, creditoCuotasMaximo } = body;

    const updates = { updatedAt: new Date() };
    if (maxCuotasMercadoPago !== undefined) updates.maxCuotasMercadoPago = maxCuotasMercadoPago;
    if (creditoMontoMaximo !== undefined) updates.creditoMontoMaximo = creditoMontoMaximo;
    if (creditoCuotasMaximo !== undefined) updates.creditoCuotasMaximo = creditoCuotasMaximo;

    const settings = await PaymentSettings.findByIdAndUpdate('default', updates, {
      new: true,
      upsert: true
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Error en payment-settings PUT:', error);
    if (error.message?.includes('administrador') || error.message?.includes('Token')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Error en el servidor.' }, { status: 500 });
  }
}
