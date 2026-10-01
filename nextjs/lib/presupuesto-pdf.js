import pdf from 'pdf-parse/lib/pdf-parse.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// Número argentino: 1.863.400,00 -> 1863400
const num = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

// Fin de fila: cantidad (x,xxx) + precio unitario + "$ importe"
const TAIL = /(\d+,\d{3})\s*([\d.]+,\d{2})\s*\$\s*([\d.]+,\d{2})\s*$/;
const NO_ES_DESCRIPCION = /^(Descripción|Cliente|Presupuesto|Subtotal|Total|Página)/;

/**
 * Lee un presupuesto PDF (formato Odoo: "[codigo] descripción cantidad precio importe").
 * Devuelve las filas y valida que la suma de importes coincida con el Total del PDF.
 */
export async function leerPresupuestoPdf(buffer) {
  const { text } = await pdf(buffer);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const rows = [];
  let cur = null;
  for (const l of lines) {
    const start = l.match(/^\[(\d+)\]\s*(.*)$/);
    if (start) {
      cur = { codigo: start[1], desc: start[2] };
      rows.push(cur);
    } else if (cur && !cur.done && !NO_ES_DESCRIPCION.test(l)) {
      cur.desc += ' ' + l;
    }
    if (cur && !cur.done) {
      const m = cur.desc.match(TAIL);
      if (m) {
        cur.precio = num(m[2]);
        cur.importe = num(m[3]);
        // El texto del PDF puede pegar el final de la descripción (p.ej. "013603") con la cantidad.
        // Se toma como cantidad el sufijo más corto del entero que cumpla cantidad × precio = importe.
        const [ent, dec] = m[1].split(',');
        let k = 1;
        while (k < ent.length && Math.abs(parseFloat(ent.slice(-k) + '.' + dec) * cur.precio - cur.importe) > 0.01) k++;
        cur.cantidad = parseFloat(ent.slice(-k) + '.' + dec);
        cur.desc = (cur.desc.replace(TAIL, '') + ent.slice(0, ent.length - k)).replace(/\s+/g, ' ').trim();
        cur.done = true;
      }
    }
  }

  const completas = rows.filter((r) => r.done);
  const totalPdf = num((text.match(/Total\s*\$\s*([\d.]+,\d{2})/) || [])[1] || '0');
  const suma = Math.round(completas.reduce((a, r) => a + r.importe, 0) * 100) / 100;

  return {
    filas: completas.map((r) => ({ codigo: r.codigo, nombre: r.desc, cantidad: r.cantidad, precio: r.precio, importe: r.importe })),
    incompletas: rows.length - completas.length,
    suma,
    totalPdf,
    coincide: totalPdf > 0 && suma === totalPdf && rows.length === completas.length,
  };
}

/**
 * Sugiere categoría y marca con Gemini para cada fila. Son solo sugerencias: el admin las revisa.
 * Si Gemini falla, devuelve {} y la pantalla deja los campos vacíos para completar a mano.
 */
export async function sugerirClasificacion(filas, categorias, marcas) {
  if (!process.env.GEMINI_API_KEY || !filas.length) return {};
  const model = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });
  const prompt = `Clasificá productos de una tienda de hogar y electrodomésticos.
Categorías existentes: ${JSON.stringify(categorias)}
Marcas existentes: ${JSON.stringify(marcas)}
Para cada producto devolvé la categoría: usá EXACTAMENTE una existente si encaja; si ninguna encaja, proponé una nueva corta, en singular.
La marca es la marca comercial del fabricante que aparece en el nombre (ej: ESCORIAL, MIDEA, NEBA), en mayúsculas. Si no estás seguro, dejala vacía.
Respondé solo un array JSON de {"codigo","categoria","marca"}.
Productos: ${JSON.stringify(filas.map((r) => ({ codigo: r.codigo, nombre: r.nombre })))}`;

  for (let intento = 1; intento <= 4; intento++) {
    try {
      const res = await model.generateContent(prompt);
      const arr = JSON.parse(res.response.text());
      return Object.fromEntries(arr.map((s) => [String(s.codigo), { categoria: s.categoria || '', marca: s.marca || '' }]));
    } catch (e) {
      if (intento === 4 || ![429, 500, 503].includes(e.status)) {
        console.error('Gemini no pudo sugerir categorías:', e.message);
        return {};
      }
      await new Promise((r) => setTimeout(r, 2500 * intento));
    }
  }
  return {};
}
