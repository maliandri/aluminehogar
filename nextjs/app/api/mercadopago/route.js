import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { connectDB } from '@/lib/db';
import Order from '@/lib/models/Order';
import PaymentSettings from '@/lib/models/PaymentSettings';
import { extractTokenFromHeaders, verifyToken } from '@/lib/auth-helpers';
import { enviarEmail } from '@/lib/email';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});

export async function POST(request) {
  const action = request.nextUrl.searchParams.get('action');

  try {
    // CREATE PREFERENCE
    if (action === 'create') {
      const token = extractTokenFromHeaders(request.headers);
      if (!token) {
        return NextResponse.json({ error: 'Debe iniciar sesion para comprar' }, { status: 401 });
      }

      const decoded = verifyToken(token);
      const { items, payer, shippingAddress } = await request.json();

      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'Debe incluir al menos un producto' }, { status: 400 });
      }

      if (!payer || !payer.email) {
        return NextResponse.json({ error: 'Informacion del comprador requerida' }, { status: 400 });
      }

      await connectDB();
      const settings = await PaymentSettings.findById('default');
      const maxCuotas = settings?.maxCuotasMercadoPago || 12;

      const preferenceData = {
        items: items.map(item => ({
          title: item.nombre,
          description: item.descripcion?.substring(0, 100) || '',
          quantity: item.quantity || 1,
          unit_price: parseFloat(item.precio),
          currency_id: 'ARS',
          picture_url: item.imagen || ''
        })),
        payer: {
          name: payer.nombre || '',
          email: payer.email,
          phone: { number: payer.telefono || '' }
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pago-exitoso`,
          failure: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pago-fallido`,
          pending: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pago-pendiente`
        },
        auto_return: 'approved',
        notification_url: `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : process.env.FRONTEND_URL}/api/mercadopago?action=webhook`,
        statement_descriptor: 'ALUMINE HOGAR',
        payment_methods: {
          installments: maxCuotas
        },
        external_reference: `order_${Date.now()}_${decoded.userId}`,
        metadata: {
          userId: decoded.userId,
          userEmail: decoded.email
        }
      };

      if (shippingAddress) {
        preferenceData.shipments = {
          receiver_address: {
            zip_code: shippingAddress.codigoPostal || '',
            street_name: shippingAddress.calle || '',
            street_number: shippingAddress.numero || '',
            floor: shippingAddress.piso || '',
            apartment: shippingAddress.depto || ''
          }
        };
      }

      const preference = new Preference(client);
      const response = await preference.create({ body: preferenceData });

      return NextResponse.json({
        success: true,
        preferenceId: response.id,
        initPoint: response.init_point,
        sandboxInitPoint: response.sandbox_init_point
      });
    }

    // WEBHOOK
    if (action === 'webhook') {
      const topic = request.nextUrl.searchParams.get('topic');
      const id = request.nextUrl.searchParams.get('id');

      if (topic === 'payment' || topic === 'merchant_order') {
        await connectDB();

        const payment = new Payment(client);
        const paymentData = await payment.get({ id });

        let order = await Order.findOne({ mercadoPagoId: id.toString() });

        if (!order) {
          order = new Order({
            mercadoPagoId: id.toString(),
            externalReference: paymentData.external_reference,
            userId: paymentData.metadata?.user_id || null,
            estado: paymentData.status,
            total: paymentData.transaction_amount,
            paymentMethod: paymentData.payment_method_id,
            payer: {
              nombre: paymentData.payer?.first_name || '',
              email: paymentData.payer?.email || '',
              telefono: paymentData.payer?.phone?.number || ''
            }
          });
        } else {
          order.estado = paymentData.status;
          order.paymentMethod = paymentData.payment_method_id;
          order.updatedAt = new Date();
        }

        await order.save();

        if (paymentData.status === 'approved') {
          try {
            await enviarEmail({
              destinatario: paymentData.payer.email,
              asunto: 'Compra confirmada - Alumine Hogar',
              cuerpoHtml: `
                <h2>Gracias por tu compra!</h2>
                <p>Hola ${paymentData.payer.first_name},</p>
                <p>Tu pago ha sido confirmado exitosamente.</p>
                <ul>
                  <li><strong>Pedido:</strong> ${paymentData.external_reference}</li>
                  <li><strong>Monto:</strong> $${paymentData.transaction_amount} ARS</li>
                  <li><strong>Metodo:</strong> ${paymentData.payment_method_id}</li>
                </ul>
                <p>En breve nos pondremos en contacto para coordinar la entrega.</p>
              `
            });

            await enviarEmail({
              destinatario: process.env.ADMIN_EMAIL || 'aluminehogar@gmail.com',
              asunto: `Nueva venta - ${paymentData.external_reference}`,
              cuerpoHtml: `
                <h2>Nueva venta confirmada</h2>
                <ul>
                  <li><strong>Cliente:</strong> ${paymentData.payer.first_name} - ${paymentData.payer.email}</li>
                  <li><strong>Monto:</strong> $${paymentData.transaction_amount} ARS</li>
                  <li><strong>Metodo:</strong> ${paymentData.payment_method_id}</li>
                  <li><strong>ID:</strong> ${id}</li>
                </ul>
              `
            });
          } catch (emailError) {
            console.error('Error enviando emails:', emailError);
          }
        }

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ message: 'Ignored' });
    }

    return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });

  } catch (error) {
    console.error('Error en mercadopago:', error);
    if (error.message && error.message.includes('Token')) {
      return NextResponse.json({ error: 'Sesion expirada' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}
