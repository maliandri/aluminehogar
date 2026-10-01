import { NextResponse } from 'next/server';
import { generateAIResponse } from '@/lib/gemini';
import { searchProducts } from '@/lib/product-search';
import { enviarEmail } from '@/lib/email';
import { connectDB } from '@/lib/db';
import { getSiteConfig } from '@/lib/site-config';
import Conversation from '@/lib/models/Conversation';

export async function POST(request) {
  const action = request.nextUrl.searchParams.get('action');

  try {
    // CONVERSATION
    if (action === 'conversation' || !action) {
      const { message, conversationHistory, sessionId } = await request.json();

      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'El campo "message" es requerido y debe ser un string' }, { status: 400 });
      }

      // Search for relevant products to provide context
      const productos = await searchProducts(message);

      const response = await generateAIResponse(message, productos, conversationHistory || []);

      // Persistir conversacion en MongoDB (no bloquea respuesta)
      if (sessionId) {
        connectDB().then(() => {
          Conversation.findOneAndUpdate(
            { sessionId },
            {
              $push: {
                messages: {
                  $each: [
                    { role: 'user', content: message, timestamp: new Date() },
                    { role: 'assistant', content: response, timestamp: new Date(), products: productos }
                  ]
                }
              },
              $inc: { messageCount: 2 },
              $set: { lastMessageAt: new Date() }
            },
            { upsert: true }
          ).catch(err => console.error('Error guardando conversacion:', err));
        }).catch(err => console.error('Error conectando DB para conversacion:', err));
      }

      return NextResponse.json({
        reply: response,
        productos: productos
      });
    }

    // LEAD
    if (action === 'lead') {
      const { leadData, conversationSummary, sessionId } = await request.json();

      if (!leadData || !leadData.email) {
        return NextResponse.json({ error: 'leadData con email es requerido' }, { status: 400 });
      }

      const conversacionTexto = conversationSummary && Array.isArray(conversationSummary)
        ? conversationSummary.map(msg => `${msg.role === 'user' ? 'Cliente' : 'Bot'}: ${msg.content}`).join('\n')
        : 'Sin conversacion disponible';

      await enviarEmail({
        destinatario: leadData.email,
        asunto: 'Gracias por tu interes - Alumine Hogar',
        cuerpoHtml: `
          <h2>Gracias por tu interes en Alumine Hogar!</h2>
          <p>Hola ${leadData.nombre || 'Cliente'},</p>
          <p>Hemos recibido tu consulta y un especialista se pondra en contacto contigo pronto.</p>
          <p>Gracias por confiar en nosotros!</p>
        `
      });

      await enviarEmail({
        destinatario: process.env.ADMIN_EMAIL || (await getSiteConfig()).tienda.emailNotificaciones,
        asunto: `Nuevo Lead: ${leadData.nombre || leadData.email}`,
        cuerpoHtml: `
          <h2>Nuevo Lead Capturado</h2>
          <ul>
            <li><strong>Nombre:</strong> ${leadData.nombre || 'No proporcionado'}</li>
            <li><strong>Email:</strong> ${leadData.email}</li>
            <li><strong>Telefono:</strong> ${leadData.telefono || 'No proporcionado'}</li>
            <li><strong>Interes:</strong> ${leadData.interes || 'No especificado'}</li>
            <li><strong>Session:</strong> ${sessionId || 'N/A'}</li>
          </ul>
          <h3>Conversacion:</h3>
          <pre style="background:#f4f4f4;padding:10px;border-radius:5px;white-space:pre-wrap;">${conversacionTexto}</pre>
        `
      });

      // Actualizar conversacion con datos del lead
      if (sessionId) {
        connectDB().then(() => {
          Conversation.findOneAndUpdate(
            { sessionId },
            {
              $set: {
                leadCaptured: true,
                leadData: leadData,
                'userInfo.nombre': leadData.nombre || '',
                'userInfo.email': leadData.email || '',
                'userInfo.telefono': leadData.telefono || '',
                status: 'lead_captured'
              }
            }
          ).catch(err => console.error('Error actualizando lead en conversacion:', err));
        }).catch(err => console.error('Error conectando DB para lead:', err));
      }

      return NextResponse.json({ success: true, message: 'Lead enviado exitosamente' });
    }

    return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });

  } catch (error) {
    console.error('Error en chatbot:', error);
    return NextResponse.json({ error: 'Error en el servidor', details: error.message }, { status: 500 });
  }
}
