import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSiteConfig } from '@/lib/site-config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export async function generateAIResponse(userMessage, productContext = [], conversationHistory = []) {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no esta configurada');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });

    const site = await getSiteConfig();
    const systemPrompt = buildSystemPrompt(productContext, site);

    const history = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido! Soy el asistente virtual de Alumine Hogar. En que puedo ayudarte hoy?' }]
      },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    ];

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userMessage);
    const response = await result.response.text();

    return response;
  } catch (error) {
    console.error('Error generando respuesta con Gemini:', error);
    return 'Disculpa, estoy teniendo problemas tecnicos. Por favor, intenta nuevamente en un momento.';
  }
}

function buildSystemPrompt(productContext, site) {
  const t = site.tienda;
  const c = site.chatbot;
  let prompt = `Eres un asistente virtual de ventas para "${t.nombre}", tu tienda de confianza para el hogar en ${t.ciudad}, Argentina.

**NUESTRO SLOGAN:** "Calidad para tu hogar, precios para vos"

**TU PERSONALIDAD:**
- Amable, profesional y servicial
- Usas emojis ocasionalmente para ser mas cercano
- Respondes en espanol argentino
- Eres conciso pero informativo

**TUS RESPONSABILIDADES:**
1. Ayudar a los clientes a encontrar el producto perfecto
2. Responder preguntas sobre productos, precios y especificaciones
3. Explicar opciones de envio y formas de pago
4. Generar presupuestos cuando se solicite
5. Ser honesto si no sabes algo

**INFORMACION DE LA EMPRESA:**
- Nombre: ${t.nombre}
- Ubicacion: ${[t.direccion, t.ciudad].filter(Boolean).join(', ')}, Argentina
- WhatsApp: ${t.telefono}
- Sitio web: https://aluminehogar.com.ar
- Envios: A todo el pais
- ${c.envio}
- Formas de pago: ${c.formasDePago}

**POLITICAS:**
${c.politicas.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `- ${l}`).join('\n')}
`;

  if (productContext && productContext.length > 0) {
    prompt += `\n**PRODUCTOS DISPONIBLES:**\n`;
    productContext.forEach((producto, index) => {
      prompt += `
${index + 1}. **${producto.nombre}**
   - Precio: $${producto.precio?.toLocaleString('es-AR')} ARS
   - Categoria: ${producto.categoria}
   ${producto.descripcion ? `- Descripcion: ${producto.descripcion}` : ''}
   ${producto.medidas ? `- Medidas: ${producto.medidas}` : ''}
`;
    });
  }

  prompt += `
**INSTRUCCIONES IMPORTANTES:**
- Si el cliente muestra interes en un producto (SI tenemos en stock):
  * Muestra el/los productos con precios y caracteristicas
  * Pregunta si quiere que un especialista lo contacte para coordinar la compra
  * Pide su nombre, email y telefono

- Si el cliente pregunta por un producto que NO esta en la lista de productos disponibles:
  * Dile que actualmente no lo tenes en stock
  * IMPORTANTE: Ofrecele que un especialista se va a contactar con el para confirmar cuando podrian entregarselo
  * SIEMPRE pidele su nombre, email y numero de telefono

- Siempre menciona el precio en pesos argentinos (ARS)
- Manten tus respuestas cortas (maximo 3-4 lineas) a menos que sea necesario mas detalle
- Usa formato de WhatsApp: *negrita* para titulos, _cursiva_ para enfasis

**CAPTURA DE DATOS (MUY IMPORTANTE - OBLIGATORIO):**
- SIEMPRE que un cliente muestre interes en algun producto (tenga o no stock), debes capturar:
  * Nombre completo del cliente
  * Email del cliente
  * Numero de telefono
  * Producto de interes
- No termines la conversacion sin intentar capturar estos datos
- Se insistente pero amable

**CIERRE DE CONVERSACION (cuando ya tenes todos los datos):**
- Confirma al cliente TODOS los productos que le interesaron durante la conversacion
- Confirma sus datos de contacto (nombre, email, telefono)
- Agradece y despedite de forma cordial
- IMPORTANTE: Menciona UNA SOLA VEZ que un especialista lo contactara

**FORMATO DE RESPUESTA:**
- Saluda de forma amigable
- Responde la pregunta de forma clara
- SIEMPRE intenta capturar datos de contacto cuando hay interes en un producto
- Ofrece ayuda adicional si es relevante
- No uses hashtags ni lenguaje corporativo excesivo
`;

  return prompt;
}

/**
 * Genera especificaciones técnicas para un producto usando Gemini AI
 */
export async function generarEspecificaciones(nombreProducto, categoria = '') {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no esta configurada');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `Genera características técnicas profesionales en HTML para el producto "${nombreProducto}"${categoria ? ` de la categoría "${categoria}"` : ''}.

Formato requerido:
<ul>
  <li><strong>Título:</strong> descripción detallada</li>
  ...
</ul>

Reglas:
- 4-6 características clave
- HTML limpio sin bloques de código
- Solo etiquetas <ul>, <li>, <strong>
- Enfócate en beneficios y especificaciones técnicas
- Lenguaje marketing profesional en español argentino
- NO uses comillas invertidas ni markdown, solo HTML puro`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    // Limpiar respuesta
    const cleaned = response
      .replace(/```html/g, '')
      .replace(/```/g, '')
      .trim();

    return cleaned;
  } catch (error) {
    console.error('Error generando especificaciones con Gemini:', error);
    throw error;
  }
}

/**
 * Genera una descripción comercial para un producto usando Gemini AI
 */
export async function generarDescripcion(nombreProducto, categoria = '', especificaciones = '') {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no esta configurada');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 512,
      }
    });

    const prompt = `Genera una descripción comercial atractiva para el producto "${nombreProducto}"${categoria ? ` de la categoría "${categoria}"` : ''}.

${especificaciones ? `Especificaciones existentes:\n${especificaciones}\n` : ''}

Reglas:
- 2-3 oraciones máximo
- Lenguaje marketing profesional pero cercano
- En español argentino
- Destaca beneficios principales
- NO uses comillas, solo texto plano
- NO uses emojis
- Enfócate en calidad, confort y valor`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    return response.trim();
  } catch (error) {
    console.error('Error generando descripcion con Gemini:', error);
    throw error;
  }
}

export function detectIntent(message) {
  const lowerMessage = message.toLowerCase();

  if (/^(hola|buenos dias|buenas tardes|buenas noches|hey|hi)/i.test(lowerMessage)) {
    return 'greeting';
  }
  if (/(colchon|almohada|aire|acondicionado|calefactor|estufa|ventilador|mueble|mesa|silla|sommier|busco|quiero|me interesa|mostrar|ver|tenes|hay|venden)/i.test(lowerMessage)) {
    return 'product_search';
  }
  if (/(precio|cuanto|costo|valor)/i.test(lowerMessage)) {
    return 'price_inquiry';
  }
  if (/(envio|entrega|delivery|despacho)/i.test(lowerMessage)) {
    return 'shipping_inquiry';
  }
  if (/(presupuesto|cotizacion)/i.test(lowerMessage)) {
    return 'quote_request';
  }
  if (/(comprar|pedido|orden|quiero comprar)/i.test(lowerMessage)) {
    return 'purchase_intent';
  }
  if (/(ayuda|help|asistencia|asesor|humano)/i.test(lowerMessage)) {
    return 'help_request';
  }

  return 'general_inquiry';
}
