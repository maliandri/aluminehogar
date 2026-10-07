# Clientes de vendedores y crédito propio (AlumiCrédito) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar la configuración de Mercado Pago de la del crédito propio, permitir que los vendedores carguen clientes con documentación privada, otorgar créditos con planes diarios/semanales/mensuales con recargo, registrar quién carga y quién aprueba, y registrar cada cobro (anticipo y cuotas) con comprobante o "cobrado en mano".

**Architecture:** Funciones puras (cálculo de cuotas, validaciones de cliente, de archivos y de la tabla de planes) probadas con verificadores en Node. Colecciones nuevas `Cliente` y `CreditoConfig`; `CreditoVenta` se extiende sin romper lo viejo. Archivos privados en Cloudinary (`type: 'authenticated'`) entregados solo por endpoints del servidor que validan dueño o admin. Pantallas nuevas dentro del marco del admin (proyectos A y B) y rediseño de "Otorgar crédito" y "Mis créditos" del panel del vendedor.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind, `lucide-react`, Mongoose, axios (`services/api.js`), Cloudinary (`cloudinary` ya instalado), Node 22 para los verificadores.

**Spec:** `docs/superpowers/specs/2026-10-07-clientes-y-credito-design.md` (leerlo antes de empezar)

## Global Constraints

- Se trabaja directo sobre `master`, sin ramas. Commits chicos, uno por tarea. **No hacer `git push`** y **no pushear antes de terminar la Task 10**: entre las tareas 7 y 9 el panel del vendedor queda desfasado del servidor (el push deploya a producción).
- No modificar `nextjs/lib/auth-helpers.js`, `nextjs/lib/models/User.js`, el formato del JWT, `nextjs/lib/db.js` ni `nextjs/app/api/mercadopago/route.js`.
- Mantener el comportamiento actual de lo que no se menciona: checkout de Mercado Pago, presupuestos por email/PDF del vendedor, descuento de stock por depósito al otorgar un crédito (y su reposición si se rechaza).
- Los créditos ya guardados (sin `clienteId`, sin `frecuencia`, sin `pago` en las cuotas) deben seguir mostrándose y funcionando sin error.
- Archivos privados: nunca se guarda ni se devuelve una URL pública de Cloudinary; solo `publicId` interno. Tipos permitidos: JPG, PNG, WebP o PDF; máximo 3 MB por archivo (las imágenes se achican en el navegador antes de subir).
- Un vendedor nunca lee ni modifica clientes, créditos, documentos o comprobantes de otro vendedor (el servidor lo valida en cada endpoint). El admin ve todo.
- Los módulos puros (`credito-calculo.js`, `cliente-validate.js`, `archivo-validate.js`, `permisos.js`, `admin-menu.js`, `menu-config.js`) importan solo con rutas relativas y extensión `.js` (sin alias `@/`).
- Preservar el fin de línea (CRLF/LF) de cada archivo existente que se edite. Si la herramienta Edit no encuentra un texto por los saltos de línea, usar un script `node` en archivo que reemplace respetando `\r\n`.
- Textos de interfaz en español rioplatense; Tailwind + `lucide-react`; sin dependencias nuevas. Nunca imprimir ni copiar valores de claves o secretos.
- Cada commit debe compilar: `cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"` muestra `✓ Compiled successfully` (los errores de MongoDB del sitemap sin `DB_URI` son esperados).
- Cada commit termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No commitear `Presupuesto - S02222 (1).pdf` ni `backups/`.

## Review Focus

1. **Un vendedor accede a datos de otro vendedor** (clientes, documentos, créditos, comprobantes) por listado, detalle, edición, subida de archivo, registro de cobro o endpoints de archivo: debe recibir 403/404. Tasks 5, 7, 8.
2. **Archivos privados:** sin token → 401/403; ninguna respuesta incluye un link público de Cloudinary; el endpoint de entrega solo sirve archivos del dueño o admin; se rechazan tipos y tamaños no permitidos (HTML, SVG, ejecutables, > 3 MB). Tasks 1, 5, 8.
3. **Cálculo de cuotas:** suma de cuotas = total financiado + recargo al centavo; la última cuota absorbe el redondeo; vencimientos correctos a fin de mes (31 de enero + 1 mes = 28 de febrero); anticipo ≥ total, cuotas 0 o con decimales, frecuencia inválida y recargo negativo se rechazan; el vendedor no puede elegir un plan que no esté activo en la tabla ni inventar un recargo. Tasks 1, 7.
4. **Frase del email:** solo se acepta un email válido o exactamente la frase `cliente no posee mail en este momento o no usa` (ignorando mayúsculas y espacios de más); variantes truncadas se rechazan. Task 1.
5. **Compatibilidad con lo guardado:** créditos viejos se listan sin romper el panel; la configuración de crédito se siembra con los valores actuales (monto máximo y cuotas mensuales sin recargo) la primera vez; el vendedor no puede aprobar su propio crédito pendiente; queda registrado quién lo cargó y quién lo aprobó. Tasks 3, 7, 10.

---

### Task 1: Funciones puras (cálculo, planes, cliente, archivos) y verificador

**Files:**
- Create: `nextjs/lib/credito-calculo.js`
- Create: `nextjs/lib/cliente-validate.js`
- Create: `nextjs/lib/archivo-validate.js`
- Create: `docs/superpowers/plans/verificar-credito.mjs`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `credito-calculo.js`: `FRECUENCIAS: string[]`; `sumarPeriodo(fecha: Date, frecuencia, n: number): Date`; `calcularPlan({ montoTotal, anticipo, cantidadCuotas, frecuencia, recargoPorcentaje, desde? }): { ok: boolean, errores: string[], montoFinanciado, interes, totalCuotas, totalFinal, montoCuota, cuotas: { numero, monto, vencimiento, estado: 'pendiente', fechaPago: null }[] }`; `evaluarAprobacion({ montoTotal, plan, montoMaximoSinAprobacion }): { requiere: boolean, motivo: string }`; `buscarPlan(planes, frecuencia, cuotas): plan | null` (solo planes activos); `validarCreditoConfig(entrada): { ok, errores, valor: { montoMaximoSinAprobacion, planes } }`; `planesDeFabrica(cuotasMaximo): plan[]`.
  - `cliente-validate.js`: `FRASE_SIN_EMAIL`, `PROVINCIAS`, `TIPOS_DOCUMENTO`, `TIPOS_ARCHIVO` (`{ dni_frente, dni_dorso, recibo, servicio }` → etiqueta), `normalizarDocumento(texto)`, `validarCliente(entrada): { ok, errores, valor: { nombre, tipoDocumento, numeroDocumento, telefono, email, domicilio: { calle, numero, localidad, provincia } } }`.
  - `archivo-validate.js`: `MIMES_PERMITIDOS`, `MAX_BYTES`, `validarArchivo(dataUrl, maxBytes?): { ok, error?, mime?, bytes? }`.

- [ ] **Step 1: Escribir el verificador (debe fallar)**

Create `docs/superpowers/plans/verificar-credito.mjs`:
```js
#!/usr/bin/env node
/**
 * Verifica las funciones puras de cliente y crédito propio.
 * Uso (desde la raíz del repo): node docs/superpowers/plans/verificar-credito.mjs
 */
import path from 'path';
import { pathToFileURL } from 'url';
import assert from 'assert/strict';

const lib = (f) => import(pathToFileURL(path.join(process.cwd(), 'nextjs/lib', f)).href);
const C = await lib('credito-calculo.js');
const V = await lib('cliente-validate.js');
const A = await lib('archivo-validate.js');

const problemas = [];
const t = (nombre, fn) => { try { fn(); } catch (e) { problemas.push(`${nombre}: ${e.message.split('\n')[0]}`); } };
const dia = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const base = { montoTotal: 100000, anticipo: 20000, cantidadCuotas: 3, frecuencia: 'mensual', recargoPorcentaje: 10, desde: new Date(2026, 0, 15, 12) };

// ---------- cálculo ----------
t('plan con recargo', () => {
  const r = C.calcularPlan(base);
  assert.equal(r.ok, true);
  assert.equal(r.montoFinanciado, 80000);
  assert.equal(r.interes, 8000);
  assert.equal(r.totalCuotas, 88000);
  assert.equal(r.totalFinal, 108000);
  assert.deepEqual(r.cuotas.map((c) => c.monto), [29333.33, 29333.33, 29333.34]);
  assert.equal(r.montoCuota, 29333.33);
});
t('plan sin recargo semanal', () => {
  const r = C.calcularPlan({ ...base, anticipo: 40000, cantidadCuotas: 6, frecuencia: 'semanal', recargoPorcentaje: 0 });
  assert.deepEqual(r.cuotas.map((c) => c.monto), [10000, 10000, 10000, 10000, 10000, 10000]);
});
t('la suma de cuotas siempre es el total financiado más el recargo', () => {
  let semilla = 12345;
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
  for (let i = 0; i < 300; i++) {
    const total = Math.round((1000 + azar() * 900000) * 100) / 100;
    const anticipo = Math.round(azar() * total * 0.5 * 100) / 100;
    const n = 1 + Math.floor(azar() * 36);
    const r = C.calcularPlan({ montoTotal: total, anticipo, cantidadCuotas: n, frecuencia: ['diaria', 'semanal', 'mensual'][i % 3], recargoPorcentaje: Math.round(azar() * 300) / 10 });
    assert.equal(r.ok, true);
    const suma = Math.round(r.cuotas.reduce((a, c) => a + c.monto, 0) * 100) / 100;
    assert.equal(suma, r.totalCuotas, `caso ${i}`);
    assert.ok(r.cuotas.every((c) => c.monto > 0), `cuota no positiva en caso ${i}`);
  }
});
t('vencimientos mensuales con tope de fin de mes', () => {
  const desde = new Date(2026, 0, 31, 12);
  assert.equal(dia(C.sumarPeriodo(desde, 'mensual', 1)), '2026-2-28');
  assert.equal(dia(C.sumarPeriodo(desde, 'mensual', 2)), '2026-3-31');
  assert.equal(dia(C.sumarPeriodo(desde, 'mensual', 13)), '2027-2-28');
});
t('vencimientos diarios y semanales', () => {
  const desde = new Date(2026, 0, 30, 12);
  assert.equal(dia(C.sumarPeriodo(desde, 'diaria', 3)), '2026-2-2');
  assert.equal(dia(C.sumarPeriodo(desde, 'semanal', 2)), '2026-2-13');
});
t('la primera cuota vence un período después del alta', () => {
  const r = C.calcularPlan({ ...base, frecuencia: 'semanal', desde: new Date(2026, 5, 1, 12) });
  assert.equal(dia(r.cuotas[0].vencimiento), '2026-6-8');
  assert.equal(r.cuotas[0].estado, 'pendiente');
  assert.equal(r.cuotas[0].fechaPago, null);
});
for (const [nombre, parche] of [
  ['anticipo igual al total', { anticipo: 100000 }],
  ['anticipo mayor al total', { anticipo: 150000 }],
  ['anticipo negativo', { anticipo: -1 }],
  ['monto total cero', { montoTotal: 0 }],
  ['monto total NaN', { montoTotal: NaN }],
  ['cuotas cero', { cantidadCuotas: 0 }],
  ['cuotas con decimales', { cantidadCuotas: 2.5 }],
  ['más de 365 cuotas', { cantidadCuotas: 366 }],
  ['frecuencia inválida', { frecuencia: 'anual' }],
  ['recargo negativo', { recargoPorcentaje: -1 }],
  ['recargo mayor a 300', { recargoPorcentaje: 301 }],
  ['monto como texto', { montoTotal: '100000' }],
]) {
  t(`rechaza ${nombre}`, () => assert.equal(C.calcularPlan({ ...base, ...parche }).ok, false));
}

// ---------- aprobación y búsqueda de plan ----------
const planes = [
  { frecuencia: 'mensual', cuotas: 3, recargo: 10, requiereAprobacion: false, activo: true },
  { frecuencia: 'mensual', cuotas: 12, recargo: 40, requiereAprobacion: true, activo: true },
  { frecuencia: 'semanal', cuotas: 4, recargo: 8, requiereAprobacion: false, activo: false },
];
t('buscarPlan devuelve solo planes activos', () => {
  assert.equal(C.buscarPlan(planes, 'mensual', 3).recargo, 10);
  assert.equal(C.buscarPlan(planes, 'semanal', 4), null);
  assert.equal(C.buscarPlan(planes, 'mensual', 99), null);
  assert.equal(C.buscarPlan(planes, 'constructor', 3), null);
  assert.equal(C.buscarPlan(null, 'mensual', 3), null);
});
t('requiere aprobación por monto', () => assert.equal(C.evaluarAprobacion({ montoTotal: 300000, plan: planes[0], montoMaximoSinAprobacion: 200000 }).requiere, true));
t('requiere aprobación por plan', () => assert.equal(C.evaluarAprobacion({ montoTotal: 1000, plan: planes[1], montoMaximoSinAprobacion: 200000 }).requiere, true));
t('no requiere aprobación dentro de límites', () => {
  const r = C.evaluarAprobacion({ montoTotal: 200000, plan: planes[0], montoMaximoSinAprobacion: 200000 });
  assert.equal(r.requiere, false);
  assert.equal(r.motivo, '');
});
t('el motivo de aprobación no está vacío cuando se requiere', () => assert.ok(C.evaluarAprobacion({ montoTotal: 300000, plan: planes[0], montoMaximoSinAprobacion: 200000 }).motivo.length > 5));

// ---------- tabla de planes ----------
const cfgOk = { montoMaximoSinAprobacion: 200000, planes: planes.map((p) => ({ ...p })) };
t('config válida', () => assert.equal(C.validarCreditoConfig(cfgOk).ok, true));
t('config descarta campos extra', () => {
  const r = C.validarCreditoConfig({ ...cfgOk, hack: 1, planes: [{ ...planes[0], x: 'y' }] });
  assert.equal(r.ok, true);
  assert.equal('hack' in r.valor, false);
  assert.equal('x' in r.valor.planes[0], false);
});
t('config rechaza plan duplicado', () => assert.equal(C.validarCreditoConfig({ ...cfgOk, planes: [planes[0], { ...planes[0], recargo: 5 }] }).ok, false));
for (const [nombre, plan] of [
  ['frecuencia inválida', { ...planes[0], frecuencia: 'anual' }],
  ['cuotas cero', { ...planes[0], cuotas: 0 }],
  ['cuotas decimales', { ...planes[0], cuotas: 1.5 }],
  ['recargo negativo', { ...planes[0], recargo: -1 }],
  ['recargo mayor a 300', { ...planes[0], recargo: 301 }],
  ['recargo texto', { ...planes[0], recargo: 'diez' }],
  ['activo no booleano', { ...planes[0], activo: 'si' }],
]) {
  t(`config rechaza ${nombre}`, () => assert.equal(C.validarCreditoConfig({ ...cfgOk, planes: [plan] }).ok, false));
}
t('config rechaza monto negativo o texto', () => {
  assert.equal(C.validarCreditoConfig({ ...cfgOk, montoMaximoSinAprobacion: -5 }).ok, false);
  assert.equal(C.validarCreditoConfig({ ...cfgOk, montoMaximoSinAprobacion: 'mucho' }).ok, false);
});
t('config rechaza planes que no es lista', () => {
  assert.equal(C.validarCreditoConfig({ ...cfgOk, planes: 'x' }).ok, false);
  assert.equal(C.validarCreditoConfig(null).ok, false);
});
t('planesDeFabrica: mensuales sin recargo', () => {
  const p = C.planesDeFabrica(6);
  assert.equal(p.length, 6);
  assert.ok(p.every((x) => x.frecuencia === 'mensual' && x.recargo === 0 && x.activo === true && x.requiereAprobacion === false));
  assert.deepEqual(p.map((x) => x.cuotas), [1, 2, 3, 4, 5, 6]);
  assert.equal(C.planesDeFabrica(0).length, 1);
  assert.equal(C.planesDeFabrica(500).length, 24);
  assert.equal(C.validarCreditoConfig({ montoMaximoSinAprobacion: 1, planes: p }).ok, true);
});

// ---------- cliente ----------
const clienteOk = {
  nombre: 'Juan Pérez', tipoDocumento: 'DNI', numeroDocumento: '30.123.456', telefono: '299 456-7890', email: 'juan@correo.com',
  domicilio: { calle: 'Belgrano', numero: '1234', localidad: 'Neuquén', provincia: 'Neuquen' },
};
const con = (parche, dom) => V.validarCliente({ ...clienteOk, ...parche, domicilio: { ...clienteOk.domicilio, ...dom } });
t('cliente válido y normalizado', () => {
  const r = V.validarCliente(clienteOk);
  assert.equal(r.ok, true, r.errores.join('; '));
  assert.equal(r.valor.numeroDocumento, '30123456');
  assert.equal(r.valor.domicilio.calle, 'Belgrano');
});
t('frase exacta sin email es válida', () => {
  const r = con({ email: V.FRASE_SIN_EMAIL });
  assert.equal(r.ok, true);
  assert.equal(r.valor.email, V.FRASE_SIN_EMAIL);
});
t('la frase ignora mayúsculas y espacios de más y se guarda canónica', () => {
  const r = con({ email: '  Cliente  NO posee mail en este momento o no usa ' });
  assert.equal(r.ok, true);
  assert.equal(r.valor.email, V.FRASE_SIN_EMAIL);
});
for (const frase of ['cliente no posee mail', 'no posee', 'sin mail', 'n/a', 'cliente no posee mail en este momento o no usa.', 'cliente no posee mail en este momento']) {
  t(`rechaza la frase incompleta "${frase}"`, () => assert.equal(con({ email: frase }).ok, false));
}
t('rechaza email inválido y vacío', () => {
  assert.equal(con({ email: 'sin-arroba' }).ok, false);
  assert.equal(con({ email: '' }).ok, false);
});
t('teléfono es obligatorio y con formato', () => {
  assert.equal(con({ telefono: '' }).ok, false);
  assert.equal(con({ telefono: 'abc' }).ok, false);
  assert.equal(con({ telefono: '12' }).ok, false);
});
t('rechaza datos incompletos o inválidos', () => {
  assert.equal(con({ nombre: 'J' }).ok, false);
  assert.equal(con({ tipoDocumento: 'LC' }).ok, false);
  assert.equal(con({ numeroDocumento: '12' }).ok, false);
  assert.equal(con({ numeroDocumento: '12ab5678' }).ok, false);
  assert.equal(con({}, { calle: '' }).ok, false);
  assert.equal(con({}, { numero: '' }).ok, false);
  assert.equal(con({}, { localidad: '' }).ok, false);
  assert.equal(con({}, { provincia: 'Cordoba' }).ok, false);
});
t('pasaporte admite letras', () => assert.equal(con({ tipoDocumento: 'Pasaporte', numeroDocumento: 'AB123456' }).ok, true));
t('campos que no son texto o entrada nula se rechazan', () => {
  assert.equal(con({ nombre: 123 }).ok, false);
  assert.equal(con({ telefono: { a: 1 } }).ok, false);
  assert.equal(V.validarCliente(null).ok, false);
});
t('descarta campos extra', () => {
  const r = V.validarCliente({ ...clienteOk, creadoPor: 'hack', archivos: [1], domicilio: { ...clienteOk.domicilio, x: 1 } });
  assert.equal(r.ok, true);
  assert.equal('creadoPor' in r.valor, false);
  assert.equal('archivos' in r.valor, false);
  assert.equal('x' in r.valor.domicilio, false);
});
t('tipos de archivo del cliente', () => assert.deepEqual(Object.keys(V.TIPOS_ARCHIVO), ['dni_frente', 'dni_dorso', 'recibo', 'servicio']));

// ---------- archivos ----------
const b64 = (n) => Buffer.alloc(n, 1).toString('base64');
t('archivo png chico válido', () => {
  const r = A.validarArchivo(`data:image/png;base64,${b64(1000)}`);
  assert.equal(r.ok, true);
  assert.equal(r.mime, 'image/png');
  assert.equal(r.bytes, 1000);
});
t('archivo pdf válido', () => assert.equal(A.validarArchivo(`data:application/pdf;base64,${b64(500)}`).ok, true));
for (const mime of ['text/html', 'image/svg+xml', 'application/x-msdownload', 'application/javascript']) {
  t(`rechaza ${mime}`, () => assert.equal(A.validarArchivo(`data:${mime};base64,${b64(100)}`).ok, false));
}
t('rechaza archivo demasiado grande', () => assert.equal(A.validarArchivo(`data:image/jpeg;base64,${b64(3 * 1024 * 1024 + 10)}`).ok, false));
t('acepta justo en el límite', () => assert.equal(A.validarArchivo(`data:image/jpeg;base64,${b64(3 * 1024 * 1024)}`).ok, true));
t('rechaza entradas mal formadas', () => {
  assert.equal(A.validarArchivo(null).ok, false);
  assert.equal(A.validarArchivo('hola').ok, false);
  assert.equal(A.validarArchivo('data:image/png;base64,').ok, false);
  assert.equal(A.validarArchivo('data:image/png;base64,@@@@').ok, false);
  assert.equal(A.validarArchivo('data:image/png;base64,abc').ok, false);
  assert.equal(A.validarArchivo({ x: 1 }).ok, false);
});

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Crédito y clientes OK: cálculo, planes, aprobación, validación de clientes y de archivos');
```

- [ ] **Step 2: Correrlo y ver que falla**

```bash
node docs/superpowers/plans/verificar-credito.mjs 2>&1 | tail -4
```
Expected: error `Cannot find module ... credito-calculo.js`.

- [ ] **Step 3: Crear `nextjs/lib/credito-calculo.js`**

```js
// Cálculo y validación del crédito propio. Módulo puro (sin base de datos ni alias @/).

export const FRECUENCIAS = ['diaria', 'semanal', 'mensual'];

const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const esNumero = (n) => typeof n === 'number' && Number.isFinite(n);

// Fecha + n períodos. En mensual conserva el día y, si el mes destino es más corto, usa su último día
// (31 de enero + 1 mes = 28 de febrero) en vez del desborde de setMonth.
export function sumarPeriodo(fecha, frecuencia, n) {
  const d = new Date(fecha.getTime());
  if (frecuencia === 'diaria') {
    d.setDate(d.getDate() + n);
  } else if (frecuencia === 'semanal') {
    d.setDate(d.getDate() + 7 * n);
  } else if (frecuencia === 'mensual') {
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
  } else {
    throw new Error('Frecuencia inválida');
  }
  return d;
}

// recargo% sobre el saldo financiado (total − anticipo); cuotas iguales al centavo y la última absorbe la diferencia
export function calcularPlan({ montoTotal, anticipo = 0, cantidadCuotas, frecuencia, recargoPorcentaje = 0, desde = new Date() }) {
  const errores = [];
  if (!esNumero(montoTotal) || montoTotal <= 0) errores.push('El monto total tiene que ser mayor a 0');
  if (!esNumero(anticipo) || anticipo < 0) errores.push('El anticipo no es válido');
  if (esNumero(montoTotal) && esNumero(anticipo) && anticipo >= montoTotal) errores.push('El anticipo tiene que ser menor al monto total');
  if (!Number.isInteger(cantidadCuotas) || cantidadCuotas < 1 || cantidadCuotas > 365) errores.push('La cantidad de cuotas no es válida');
  if (!FRECUENCIAS.includes(frecuencia)) errores.push('La frecuencia no es válida');
  if (!esNumero(recargoPorcentaje) || recargoPorcentaje < 0 || recargoPorcentaje > 300) errores.push('El recargo no es válido');
  if (errores.length) return { ok: false, errores };

  const montoFinanciado = redondear(montoTotal - anticipo);
  const interes = redondear((montoFinanciado * recargoPorcentaje) / 100);
  const totalCuotas = redondear(montoFinanciado + interes);
  const montoCuota = Math.floor((totalCuotas / cantidadCuotas) * 100) / 100;

  const cuotas = [];
  let acumulado = 0;
  for (let i = 1; i <= cantidadCuotas; i++) {
    const monto = i === cantidadCuotas ? redondear(totalCuotas - acumulado) : montoCuota;
    acumulado = redondear(acumulado + monto);
    cuotas.push({ numero: i, monto, vencimiento: sumarPeriodo(desde, frecuencia, i), estado: 'pendiente', fechaPago: null });
  }
  return { ok: true, errores: [], montoFinanciado, interes, totalCuotas, totalFinal: redondear(anticipo + totalCuotas), montoCuota, cuotas };
}

// Un crédito necesita aprobación del admin si supera el monto máximo o si el plan lo exige
export function evaluarAprobacion({ montoTotal, plan, montoMaximoSinAprobacion }) {
  if (esNumero(montoMaximoSinAprobacion) && montoTotal > montoMaximoSinAprobacion) {
    return { requiere: true, motivo: `El monto supera el máximo sin aprobación ($${montoMaximoSinAprobacion.toLocaleString('es-AR')})` };
  }
  if (plan?.requiereAprobacion) {
    return { requiere: true, motivo: 'Este plan de cuotas requiere aprobación del administrador' };
  }
  return { requiere: false, motivo: '' };
}

// Plan activo de la tabla para esa frecuencia y cantidad de cuotas; null si no existe o está inactivo
export function buscarPlan(planes, frecuencia, cuotas) {
  if (!Array.isArray(planes)) return null;
  const plan = planes.find((p) => p && p.frecuencia === frecuencia && p.cuotas === Number(cuotas));
  return plan && plan.activo ? plan : null;
}

// Planes mensuales de 1 a N cuotas sin recargo: reproducen el comportamiento anterior (cuotas máximas del admin)
export function planesDeFabrica(cuotasMaximo) {
  const n = Math.min(24, Math.max(1, Math.floor(Number(cuotasMaximo) || 1)));
  return Array.from({ length: n }, (_, i) => ({ frecuencia: 'mensual', cuotas: i + 1, recargo: 0, requiereAprobacion: false, activo: true }));
}

// Valida y limpia la tabla de planes que manda el admin
export function validarCreditoConfig(entrada) {
  const errores = [];
  if (!entrada || typeof entrada !== 'object' || !Array.isArray(entrada.planes)) {
    return { ok: false, errores: ['Configuración inválida'], valor: null };
  }
  const monto = entrada.montoMaximoSinAprobacion;
  if (!esNumero(monto) || monto < 0 || monto > 1e9) errores.push('El monto máximo sin aprobación tiene que ser un número entre 0 y 1.000.000.000');
  if (entrada.planes.length > 200) errores.push('Demasiados planes (máximo 200)');

  const vistos = new Set();
  const planes = [];
  entrada.planes.forEach((p, i) => {
    const nombre = `Plan ${i + 1}`;
    if (!p || typeof p !== 'object') {
      errores.push(`${nombre}: inválido`);
      return;
    }
    if (!FRECUENCIAS.includes(p.frecuencia)) errores.push(`${nombre}: la frecuencia no es válida`);
    if (!Number.isInteger(p.cuotas) || p.cuotas < 1 || p.cuotas > 365) errores.push(`${nombre}: la cantidad de cuotas tiene que ser un número entero entre 1 y 365`);
    if (!esNumero(p.recargo) || p.recargo < 0 || p.recargo > 300) errores.push(`${nombre}: el recargo tiene que estar entre 0 y 300`);
    if (typeof p.requiereAprobacion !== 'boolean' || typeof p.activo !== 'boolean') errores.push(`${nombre}: "requiere aprobación" y "activo" tienen que ser sí o no`);
    const clave = `${p.frecuencia}:${p.cuotas}`;
    if (vistos.has(clave)) errores.push(`${nombre}: ya hay un plan ${p.frecuencia} de ${p.cuotas} cuotas`);
    vistos.add(clave);
    planes.push({ frecuencia: p.frecuencia, cuotas: p.cuotas, recargo: redondear(p.recargo), requiereAprobacion: p.requiereAprobacion === true, activo: p.activo === true });
  });

  return errores.length
    ? { ok: false, errores, valor: null }
    : { ok: true, errores: [], valor: { montoMaximoSinAprobacion: monto, planes } };
}
```

- [ ] **Step 4: Crear `nextjs/lib/cliente-validate.js`**

```js
// Validación de la ficha de cliente. Módulo puro (sin base de datos ni alias @/).

// Si el cliente no tiene email, el vendedor tiene que escribir esta frase a mano (no hay botón que la complete)
export const FRASE_SIN_EMAIL = 'cliente no posee mail en este momento o no usa';

export const PROVINCIAS = ['Neuquen'];
export const TIPOS_DOCUMENTO = ['DNI', 'CUIL', 'CUIT', 'Pasaporte'];
export const TIPOS_ARCHIVO = {
  dni_frente: 'DNI (frente)',
  dni_dorso: 'DNI (dorso)',
  recibo: 'Recibo de ingresos',
  servicio: 'Servicio (luz, gas, agua)',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?[\d\s()-]{6,25}$/;

const normalizarFrase = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function normalizarDocumento(texto) {
  return String(texto ?? '').replace(/[.\s-]/g, '').toUpperCase();
}

// Lee un campo de texto obligatorio; si hay un problema lo agrega a `errores` y devuelve ''
function texto(errores, etiqueta, crudo, { max, regex, mensaje }) {
  if (crudo != null && typeof crudo !== 'string') {
    errores.push(`${etiqueta}: tiene que ser texto`);
    return '';
  }
  const v = (crudo ?? '').trim();
  if (!v) {
    errores.push(`${etiqueta}: es obligatorio`);
    return '';
  }
  if (v.length > max) {
    errores.push(`${etiqueta}: máximo ${max} caracteres`);
    return '';
  }
  if (regex && !regex.test(v)) {
    errores.push(`${etiqueta}: ${mensaje}`);
    return '';
  }
  return v;
}

export function validarCliente(entrada) {
  const errores = [];
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const dom = e.domicilio && typeof e.domicilio === 'object' ? e.domicilio : {};

  const nombre = texto(errores, 'Nombre', e.nombre, { max: 100, regex: /^.{2,}$/s, mensaje: 'mínimo 2 caracteres' });

  let tipoDocumento = typeof e.tipoDocumento === 'string' ? e.tipoDocumento.trim() : '';
  if (!TIPOS_DOCUMENTO.includes(tipoDocumento)) {
    errores.push('Tipo de documento: elegí una opción de la lista');
    tipoDocumento = '';
  }
  const numeroDocumento = normalizarDocumento(typeof e.numeroDocumento === 'string' || typeof e.numeroDocumento === 'number' ? e.numeroDocumento : '');
  if (tipoDocumento === 'Pasaporte') {
    if (!/^[A-Z0-9]{5,15}$/.test(numeroDocumento)) errores.push('Número de documento: 5 a 15 letras o números');
  } else if (!/^\d{7,13}$/.test(numeroDocumento)) {
    errores.push('Número de documento: solo números, entre 7 y 13 dígitos');
  }

  const telefono = texto(errores, 'Teléfono', e.telefono, { max: 25, regex: TELEFONO, mensaje: 'solo números, espacios, +, ( ) y -' });

  // Email válido, o exactamente la frase de "sin email" (se guarda siempre en su forma canónica)
  let email = '';
  if (e.email != null && typeof e.email !== 'string') {
    errores.push('Email: tiene que ser texto');
  } else {
    const crudo = (e.email ?? '').trim();
    if (!crudo) {
      errores.push(`Email: es obligatorio. Si el cliente no tiene, escribí exactamente: ${FRASE_SIN_EMAIL}`);
    } else if (normalizarFrase(crudo) === FRASE_SIN_EMAIL) {
      email = FRASE_SIN_EMAIL;
    } else if (crudo.length <= 120 && EMAIL.test(crudo)) {
      email = crudo;
    } else {
      errores.push(`Email: no es válido. Si el cliente no tiene, escribí exactamente: ${FRASE_SIN_EMAIL}`);
    }
  }

  const calle = texto(errores, 'Calle', dom.calle, { max: 100, regex: /^.{2,}$/s, mensaje: 'mínimo 2 caracteres' });
  const numero = texto(errores, 'Número', dom.numero, { max: 10, regex: /^[A-Za-z0-9\s./-]{1,10}$/, mensaje: 'solo letras, números, espacios, . / y -' });
  const localidad = texto(errores, 'Localidad', dom.localidad, { max: 60, regex: /^.{2,}$/s, mensaje: 'mínimo 2 caracteres' });
  let provincia = typeof dom.provincia === 'string' ? dom.provincia.trim() : '';
  if (!PROVINCIAS.includes(provincia)) {
    errores.push('Provincia: elegí una opción de la lista');
    provincia = '';
  }

  return errores.length
    ? { ok: false, errores, valor: null }
    : { ok: true, errores: [], valor: { nombre, tipoDocumento, numeroDocumento, telefono, email, domicilio: { calle, numero, localidad, provincia } } };
}
```

- [ ] **Step 5: Crear `nextjs/lib/archivo-validate.js`**

```js
// Validación de archivos que llegan como data URL (documentos de clientes y comprobantes). Módulo puro.

export const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_BYTES = 3 * 1024 * 1024;

export function validarArchivo(dataUrl, maxBytes = MAX_BYTES) {
  if (typeof dataUrl !== 'string') return { ok: false, error: 'Archivo inválido' };
  const m = dataUrl.match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!m) return { ok: false, error: 'Archivo inválido' };

  const mime = m[1].toLowerCase();
  if (!MIMES_PERMITIDOS.includes(mime)) return { ok: false, error: 'Solo se aceptan imágenes JPG, PNG o WebP, o PDF' };

  const b64 = m[2];
  if (b64.length % 4 !== 0) return { ok: false, error: 'Archivo inválido' };
  const relleno = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = (b64.length / 4) * 3 - relleno;
  if (bytes <= 0) return { ok: false, error: 'Archivo inválido' };
  if (bytes > maxBytes) return { ok: false, error: `El archivo no puede pesar más de ${Math.round(maxBytes / 1024 / 1024)} MB` };
  return { ok: true, mime, bytes };
}
```

- [ ] **Step 6: Correr el verificador (debe pasar)**

```bash
node docs/superpowers/plans/verificar-credito.mjs 2>&1 | grep -E "✓|✗|  - "
```
Expected: `✓ Crédito y clientes OK: ...`. Si alguna aserción falla, corregir el módulo (no el verificador) salvo que el verificador contradiga una regla de este plan.

- [ ] **Step 7: Commit**
```bash
git add nextjs/lib/credito-calculo.js nextjs/lib/cliente-validate.js nextjs/lib/archivo-validate.js docs/superpowers/plans/verificar-credito.mjs
git commit -m "$(cat <<'EOF'
feat: Funciones puras de crédito propio, clientes y archivos con verificador

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Permisos de las pantallas nuevas

**Files:**
- Modify: `nextjs/lib/permisos.js`
- Modify: `docs/superpowers/plans/verificar-permisos.mjs`

**Interfaces:**
- Consumes: `PANTALLAS`, `puedeVer`, `puedeEditar`, `rolesQueVen` (proyecto B).
- Produces: entradas nuevas en `PANTALLAS`: `clientes` (ver y editar: `['admin', 'vendedor']`), `'planes-credito'` y `'mercado-pago'` (ver y editar: `['admin']`).

- [ ] **Step 1: Agregar casos al verificador (deben fallar).** En `docs/superpowers/plans/verificar-permisos.mjs`, antes del bloque `if (problemas.length)`, agregar:
```js
t('clientes: admin y vendedor ven y editan', () => {
  for (const rol of ['admin', 'vendedor']) {
    assert.equal(puedeVer(rol, 'clientes'), true, rol);
    assert.equal(puedeEditar(rol, 'clientes'), true, rol);
  }
  assert.equal(puedeVer('customer', 'clientes'), false);
});
for (const id of ['planes-credito', 'mercado-pago']) {
  t(`${id}: solo admin`, () => {
    assert.equal(puedeVer('admin', id), true);
    assert.equal(puedeEditar('admin', id), true);
    assert.equal(puedeVer('vendedor', id), false);
    assert.equal(puedeEditar('vendedor', id), false);
  });
}
```
Run: `node docs/superpowers/plans/verificar-permisos.mjs 2>&1 | grep -E "✓|✗|  - "` → Expected: `✗ 3 problema(s)` (los tres casos nuevos).

- [ ] **Step 2: Editar `nextjs/lib/permisos.js`.** Dentro de `PANTALLAS`, después de la línea de `creditos`, agregar:
```js
  clientes: { ver: ['admin', 'vendedor'], editar: ['admin', 'vendedor'] },
  'planes-credito': { ver: ['admin'], editar: ['admin'] },
  'mercado-pago': { ver: ['admin'], editar: ['admin'] },
```

- [ ] **Step 3: Verificar y commitear**
```bash
node docs/superpowers/plans/verificar-permisos.mjs 2>&1 | grep -E "✓|✗"
node docs/superpowers/plans/verificar-menu-config.mjs 2>&1 | grep -E "✓|✗"
git add nextjs/lib/permisos.js docs/superpowers/plans/verificar-permisos.mjs
git commit -m "$(cat <<'EOF'
feat: Permisos de Clientes, Planes de crédito propio y Mercado Pago

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: `✓ Permisos OK` y `✓ Menú editable OK`.

---

### Task 3: Configuración del crédito propio (modelo, lectura con siembra y API)

**Files:**
- Create: `nextjs/lib/models/CreditoConfig.js`
- Create: `nextjs/lib/credito-config.js`
- Create: `nextjs/app/api/credito-config/route.js`
- Modify: `nextjs/services/api.js` (dos funciones al final)

**Interfaces:**
- Consumes: `planesDeFabrica`, `validarCreditoConfig` (Task 1); `PaymentSettings`.
- Produces: `getCreditoConfig(): Promise<{ montoMaximoSinAprobacion: number, planes: Plan[] }>` (servidor; siembra la primera vez); `GET /api/credito-config` (admin o vendedor; el vendedor recibe solo planes activos) → `{ success, config }`; `PUT /api/credito-config` (solo admin, body `{ montoMaximoSinAprobacion, planes }`) → `{ success, config }` o 400 `{ error, errores }`; en `services/api.js`: `obtenerCreditoConfig()`, `guardarCreditoConfig(config)`.

- [ ] **Step 1: Crear `nextjs/lib/models/CreditoConfig.js`**
```js
import mongoose from 'mongoose';

// Un solo documento (_id: 'default'), mismo patrón que PaymentSettings y SiteConfig
const CreditoConfigSchema = new mongoose.Schema({
  _id: { type: String, default: 'default' },
  montoMaximoSinAprobacion: { type: Number, default: 200000 },
  planes: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false });

export default mongoose.models.CreditoConfig || mongoose.model('CreditoConfig', CreditoConfigSchema);
```

- [ ] **Step 2: Crear `nextjs/lib/credito-config.js`**
```js
import { connectDB } from '@/lib/db';
import CreditoConfig from '@/lib/models/CreditoConfig';
import PaymentSettings from '@/lib/models/PaymentSettings';
import { planesDeFabrica } from '@/lib/credito-calculo';

// Lee la configuración del crédito propio. La primera vez la siembra con lo que había en PaymentSettings
// (monto máximo y cuotas máximas) para que el comportamiento de hoy no cambie. Sin caché: es de uso interno.
export async function getCreditoConfig() {
  await connectDB();
  let doc = await CreditoConfig.findById('default').lean();
  if (!doc) {
    const ps = await PaymentSettings.findById('default').lean();
    const semilla = {
      montoMaximoSinAprobacion: ps?.creditoMontoMaximo ?? 200000,
      planes: planesDeFabrica(ps?.creditoCuotasMaximo ?? 6),
      updatedAt: new Date()
    };
    doc = await CreditoConfig.findOneAndUpdate(
      { _id: 'default' },
      { $setOnInsert: semilla },
      { upsert: true, new: true }
    ).lean();
  }
  return { montoMaximoSinAprobacion: doc.montoMaximoSinAprobacion, planes: doc.planes || [] };
}
```

- [ ] **Step 3: Crear `nextjs/app/api/credito-config/route.js`**
```js
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import CreditoConfig from '@/lib/models/CreditoConfig';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { getCreditoConfig } from '@/lib/credito-config';
import { validarCreditoConfig } from '@/lib/credito-calculo';

function authenticate(request, roles) {
  const token = extractTokenFromHeaders(request.headers);
  if (!token) throw new Error('Token de autenticacion requerido');
  const decoded = verifyToken(token);
  requireRole(decoded, roles);
  return decoded;
}

function handleError(error, contexto) {
  if (error.message?.startsWith('Acceso denegado') || error.message?.includes('Token')) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error(`Error en credito-config ${contexto}:`, error);
  return NextResponse.json({ error: 'Error en el servidor' }, { status: 500 });
}

// El vendedor necesita ver los planes habilitados para armar un crédito; el admin ve todos
export async function GET(request) {
  try {
    const decoded = authenticate(request, ['admin', 'vendedor']);
    const config = await getCreditoConfig();
    if (decoded.role !== 'admin') {
      config.planes = config.planes.filter((p) => p.activo);
    }
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return handleError(error, 'GET');
  }
}

export async function PUT(request) {
  try {
    authenticate(request, ['admin']);
    const body = await request.json().catch(() => null);
    const { ok, errores, valor } = validarCreditoConfig(body);
    if (!ok) return NextResponse.json({ error: 'La configuración tiene problemas', errores }, { status: 400 });

    await connectDB();
    await CreditoConfig.findByIdAndUpdate(
      'default',
      { $set: { montoMaximoSinAprobacion: valor.montoMaximoSinAprobacion, planes: valor.planes, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ success: true, config: valor });
  } catch (error) {
    return handleError(error, 'PUT');
  }
}
```

- [ ] **Step 4: Funciones de API.** Al final de `nextjs/services/api.js`:
```js

// =================== CONFIGURACION DEL CREDITO PROPIO ===================

export const obtenerCreditoConfig = async () => {
  const response = await api.get('/credito-config');
  return response.data;
};

export const guardarCreditoConfig = async (config) => {
  const response = await api.put('/credito-config', config);
  return response.data;
};
```

- [ ] **Step 5: Compilar y commitear**
```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|credito-config"; cd ..
git add nextjs/lib/models/CreditoConfig.js nextjs/lib/credito-config.js nextjs/app/api/credito-config/route.js nextjs/services/api.js
git commit -m "$(cat <<'EOF'
feat: Configuración del crédito propio (planes por frecuencia, recargo y límite) con API

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: `✓ Compiled successfully` y `/api/credito-config` en las rutas.

---

### Task 4: Pantallas "Planes de crédito propio" y "Mercado Pago"

**Files:**
- Create: `nextjs/components/admin/PlanesCreditoPanel.jsx`
- Create: `nextjs/components/admin/MercadoPagoPanel.jsx`
- Create: `nextjs/app/admin/ventas/planes-credito/page.js`
- Create: `nextjs/app/admin/ventas/mercado-pago/page.js`
- Modify: `nextjs/lib/admin-menu.js` (dos ítems)
- Modify: `nextjs/components/admin/CreditosPanel.jsx` (quitar la tarjeta "Configuracion de pagos" y su estado/handlers)

**Interfaces:**
- Consumes: `obtenerCreditoConfig`, `guardarCreditoConfig` (Task 3); `getPaymentSettings`, `actualizarPaymentSettings` (existentes).
- Produces: ítems `planes-credito` (sección `ventas`, ruta `/admin/ventas/planes-credito`, ícono `Wallet`, roles `['admin']`) y `mercado-pago` (ruta `/admin/ventas/mercado-pago`, ícono `CreditCard`, roles `['admin']`).

- [ ] **Step 1: Crear `nextjs/components/admin/PlanesCreditoPanel.jsx`**
```jsx
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { obtenerCreditoConfig, guardarCreditoConfig } from '@/services/api';

const FRECUENCIAS = [
  { id: 'diaria', titulo: 'Cuotas diarias', unidad: 'días' },
  { id: 'semanal', titulo: 'Cuotas semanales', unidad: 'semanas' },
  { id: 'mensual', titulo: 'Cuotas mensuales', unidad: 'meses' },
];

export default function PlanesCreditoPanel() {
  const [monto, setMonto] = useState('');
  const [planes, setPlanes] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    obtenerCreditoConfig()
      .then((data) => {
        setMonto(String(data.config.montoMaximoSinAprobacion));
        setPlanes(data.config.planes);
      })
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo cargar la configuración' }));
  }, []);

  const cambiar = (indice, parche) => setPlanes((prev) => prev.map((p, i) => (i === indice ? { ...p, ...parche } : p)));
  const quitar = (indice) => setPlanes((prev) => prev.filter((_, i) => i !== indice));
  const agregar = (frecuencia) =>
    setPlanes((prev) => [...prev, { frecuencia, cuotas: 1, recargo: 0, requiereAprobacion: false, activo: true }]);

  const handleGuardar = async () => {
    setGuardando(true);
    setMensaje(null);
    setErrores([]);
    try {
      const data = await guardarCreditoConfig({ montoMaximoSinAprobacion: Number(monto), planes });
      setMonto(String(data.config.montoMaximoSinAprobacion));
      setPlanes(data.config.planes);
      setMensaje({ tipo: 'ok', texto: 'Guardado. Los vendedores ya ven los planes nuevos.' });
    } catch (err) {
      setErrores(err.response?.data?.errores || []);
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  if (!planes) {
    return <div className="text-center py-12 text-gray-500">{mensaje ? mensaje.texto : 'Cargando...'}</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Planes de crédito propio</h2>
        <p className="text-sm text-gray-500">
          El vendedor elige uno de estos planes al otorgar un crédito. El recargo se suma al saldo (total menos anticipo) y se divide en cuotas iguales.
        </p>
      </div>

      <section className="bg-white shadow rounded-lg p-6 space-y-2">
        <label className="block text-sm font-medium" htmlFor="monto-max">Monto máximo que el vendedor puede otorgar sin tu aprobación ($)</label>
        <input id="monto-max" type="number" min="0" value={monto} onChange={(e) => setMonto(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-xs" />
        <p className="text-xs text-gray-500">Si el monto total lo supera, el crédito queda pendiente hasta que lo apruebes.</p>
      </section>

      {FRECUENCIAS.map((f) => (
        <section key={f.id} className="bg-white shadow rounded-lg p-6 space-y-3">
          <h3 className="text-lg font-semibold">{f.titulo}</h3>
          {planes.every((p) => p.frecuencia !== f.id) && <p className="text-sm text-gray-400">Sin planes. Agregá uno.</p>}
          {planes.map((p, indice) => p.frecuencia === f.id && (
            <div key={indice} className="flex flex-wrap items-center gap-4 border rounded p-3">
              <label className="text-sm">
                Cuotas ({f.unidad})
                <input type="number" min="1" max="365" value={p.cuotas}
                  onChange={(e) => cambiar(indice, { cuotas: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border rounded px-2 py-1.5 w-24 ml-2" />
              </label>
              <label className="text-sm">
                Recargo (%)
                <input type="number" min="0" max="300" step="0.1" value={p.recargo}
                  onChange={(e) => cambiar(indice, { recargo: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border rounded px-2 py-1.5 w-24 ml-2" />
              </label>
              <label className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={p.requiereAprobacion} onChange={(e) => cambiar(indice, { requiereAprobacion: e.target.checked })} />
                Requiere mi aprobación
              </label>
              <label className="text-sm flex items-center gap-1">
                <input type="checkbox" checked={p.activo} onChange={(e) => cambiar(indice, { activo: e.target.checked })} />
                Activo
              </label>
              <button type="button" aria-label="Quitar plan" onClick={() => quitar(indice)}
                className="ml-auto p-1.5 rounded border text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => agregar(f.id)}
            className="flex items-center gap-2 border border-dashed border-gray-400 px-3 py-1.5 rounded text-sm text-gray-600 hover:bg-gray-50">
            <Plus className="w-4 h-4" /> Agregar plan {f.id}
          </button>
        </section>
      ))}

      {mensaje && (
        <div role={mensaje.tipo === 'ok' ? 'status' : 'alert'}
          className={`rounded-lg p-4 text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.texto}
          {errores.length > 0 && <ul className="list-disc ml-5 mt-2">{errores.map((er) => <li key={er}>{er}</li>)}</ul>}
        </div>
      )}

      <button type="button" onClick={handleGuardar} disabled={guardando}
        className="bg-blue-600 text-white px-5 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        {guardando ? 'Guardando...' : 'Guardar planes'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Crear `nextjs/components/admin/MercadoPagoPanel.jsx`**
```jsx
'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getPaymentSettings, actualizarPaymentSettings } from '@/services/api';

export default function MercadoPagoPanel() {
  const [cuotas, setCuotas] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    getPaymentSettings()
      .then((data) => setCuotas(String(data.settings.maxCuotasMercadoPago)))
      .catch(() => setMensaje({ tipo: 'error', texto: 'No se pudo cargar la configuración' }));
  }, []);

  const handleGuardar = async (e) => {
    e.preventDefault();
    const n = Number(cuotas);
    if (!Number.isInteger(n) || n < 1 || n > 24) {
      setMensaje({ tipo: 'error', texto: 'Las cuotas máximas tienen que ser un número entero entre 1 y 24' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      await actualizarPaymentSettings({ maxCuotasMercadoPago: n });
      setMensaje({ tipo: 'ok', texto: 'Guardado. El checkout ya usa el nuevo máximo.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  if (cuotas === null) {
    return <div className="text-center py-12 text-gray-500">{mensaje ? mensaje.texto : 'Cargando...'}</div>;
  }

  return (
    <form onSubmit={handleGuardar} className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold">Mercado Pago</h2>
        <p className="text-sm text-gray-500">Vale para las compras online del sitio. El crédito propio de los vendedores se configura en "Planes de crédito propio".</p>
      </div>
      <section className="bg-white shadow rounded-lg p-6 space-y-2">
        <label className="block text-sm font-medium" htmlFor="cuotas-mp">Máximo de cuotas en el checkout</label>
        <input id="cuotas-mp" type="number" min="1" max="24" value={cuotas} onChange={(e) => setCuotas(e.target.value)}
          className="border rounded px-3 py-2 w-32" />
      </section>
      {mensaje && (
        <div role={mensaje.tipo === 'ok' ? 'status' : 'alert'}
          className={`rounded-lg p-4 text-sm border ${mensaje.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {mensaje.texto}
        </div>
      )}
      <button type="submit" disabled={guardando}
        className="bg-blue-600 text-white px-5 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Crear las dos páginas**

`nextjs/app/admin/ventas/planes-credito/page.js`
```jsx
import PlanesCreditoPanel from '@/components/admin/PlanesCreditoPanel';

export default function Page() {
  return <PlanesCreditoPanel />;
}
```
`nextjs/app/admin/ventas/mercado-pago/page.js`
```jsx
import MercadoPagoPanel from '@/components/admin/MercadoPagoPanel';

export default function Page() {
  return <MercadoPagoPanel />;
}
```

- [ ] **Step 4: Ítems del menú.** En `nextjs/lib/admin-menu.js`, dentro de `ITEMS`, justo después del ítem `creditos`, agregar:
```js
  { id: 'planes-credito', seccion: 'ventas', etiqueta: 'Planes de crédito propio', icono: 'Wallet', ruta: '/admin/ventas/planes-credito', roles: ['admin'] },
  { id: 'mercado-pago', seccion: 'ventas', etiqueta: 'Mercado Pago', icono: 'CreditCard', ruta: '/admin/ventas/mercado-pago', roles: ['admin'] },
```

- [ ] **Step 5: Quitar la configuración mezclada de `CreditosPanel.jsx`.** Leer `nextjs/components/admin/CreditosPanel.jsx` y eliminar la tarjeta "Configuracion de pagos" (los tres campos de límites y su botón "Guardar configuracion" con el párrafo explicativo), junto con el estado y los handlers que solo ella usa (`settings`, `savingSettings`, la carga con `getPaymentSettings` y el guardado con `actualizarPaymentSettings`) y los imports que queden sin uso. No tocar la lista de créditos ni aprobar/rechazar (esa pantalla se reemplaza completa en la Task 10).

- [ ] **Step 6: Verificar, compilar y commitear**
```bash
for v in verificar-menu verificar-permisos verificar-menu-config; do node docs/superpowers/plans/$v.mjs 2>&1 | grep -E "✓|✗|  - "; done
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|/admin/ventas"; cd ..
git add nextjs/components/admin nextjs/app/admin/ventas nextjs/lib/admin-menu.js
git commit -m "$(cat <<'EOF'
feat: Pestañas separadas de Planes de crédito propio y Mercado Pago

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: los tres verificadores con `✓` (el de menú: `12 pestañas`), `✓ Compiled successfully` y las rutas `/admin/ventas/planes-credito` y `/admin/ventas/mercado-pago`.

---

### Task 5: Clientes en el servidor (modelo, archivos privados y API)

**Files:**
- Create: `nextjs/lib/models/Cliente.js`
- Create: `nextjs/lib/archivos-privados.js`
- Create: `nextjs/app/api/clientes/route.js`
- Create: `nextjs/app/api/clientes/archivo/route.js`
- Modify: `nextjs/services/api.js` (funciones al final)

**Interfaces:**
- Consumes: `validarCliente`, `TIPOS_ARCHIVO` (Task 1), `validarArchivo` (Task 1), `cloudinary` default export de `lib/cloudinary.js`.
- Produces:
  - `archivos-privados.js`: `subirPrivado(dataUrl, carpeta): Promise<{ publicId, resourceType, formato, version }>` (lanza `Error` con `status = 400` si el archivo no es válido); `borrarPrivado(archivo)`; `entregarArchivo(archivo): Promise<Response>`.
  - `GET /api/clientes?q=texto` → `{ success, clientes }` (vendedor: solo los suyos; admin: todos; máx. 50); `GET /api/clientes?id=<id>` → `{ success, cliente }`; `POST /api/clientes` con `action: 'create' | 'update' | 'subir-archivo'`; `GET /api/clientes/archivo?id=<id>&tipo=<tipo>` → bytes del archivo.
  - Forma pública del cliente: `{ _id, nombre, tipoDocumento, numeroDocumento, telefono, email, domicilio, creadoPor: { userId, nombre }, archivos: [{ tipo, formato, fecha }], createdAt }` (nunca `publicId`).
  - En `services/api.js`: `listarClientes(q?)`, `obtenerCliente(id)`, `crearCliente(datos)`, `actualizarCliente(id, datos)`, `subirArchivoCliente(id, tipo, archivo)`, `obtenerArchivoCliente(id, tipo): Promise<Blob>`.

- [ ] **Step 1: Crear `nextjs/lib/models/Cliente.js`**
```js
import mongoose from 'mongoose';

const ArchivoSchema = new mongoose.Schema({
  tipo: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, required: true },
  formato: { type: String, default: null },
  version: { type: Number, default: null },
  subidoPor: { userId: String, nombre: String },
  fecha: { type: Date, default: Date.now }
}, { _id: false });

const ClienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  tipoDocumento: { type: String, required: true },
  numeroDocumento: { type: String, required: true },
  telefono: { type: String, required: true },
  email: { type: String, required: true },
  domicilio: {
    calle: String,
    numero: String,
    localidad: String,
    provincia: String
  },
  archivos: { type: [ArchivoSchema], default: [] },
  creadoPor: { userId: String, nombre: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Un documento = un cliente
ClienteSchema.index({ tipoDocumento: 1, numeroDocumento: 1 }, { unique: true });

export default mongoose.models.Cliente || mongoose.model('Cliente', ClienteSchema);
```

- [ ] **Step 2: Crear `nextjs/lib/archivos-privados.js`**
```js
import cloudinary from '@/lib/cloudinary';
import { validarArchivo } from '@/lib/archivo-validate';

// Los documentos y comprobantes se guardan con type "authenticated": no existe un link público.
// Solo se entregan a través de endpoints propios que validan quién pide el archivo.

export async function subirPrivado(dataUrl, carpeta) {
  const v = validarArchivo(dataUrl);
  if (!v.ok) {
    const error = new Error(v.error);
    error.status = 400;
    throw error;
  }
  const r = await cloudinary.uploader.upload(dataUrl, {
    type: 'authenticated',
    resource_type: 'auto',
    folder: carpeta,
    overwrite: false
  });
  return { publicId: r.public_id, resourceType: r.resource_type, formato: r.format || null, version: r.version || null };
}

export async function borrarPrivado(archivo) {
  try {
    await cloudinary.uploader.destroy(archivo.publicId, { type: 'authenticated', resource_type: archivo.resourceType });
  } catch (error) {
    console.error('No se pudo borrar un archivo privado:', error.message);
  }
}

function urlFirmada(archivo) {
  return cloudinary.url(archivo.publicId, {
    resource_type: archivo.resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: archivo.formato || undefined,
    version: archivo.version || undefined
  });
}

// Trae el archivo de Cloudinary con la URL firmada (que nunca sale del servidor) y lo devuelve como respuesta
export async function entregarArchivo(archivo) {
  const res = await fetch(urlFirmada(archivo));
  if (!res.ok) {
    const error = new Error('No se pudo obtener el archivo');
    error.status = 502;
    throw error;
  }
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline'
    }
  });
}
```

- [ ] **Step 3: Crear `nextjs/app/api/clientes/route.js`**
```js
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

const esDueno = (cliente, decoded) => decoded.role === 'admin' || cliente.creadoPor?.userId === decoded.userId;
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
  if (error.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
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
    await connectDB();
    const body = await request.json().catch(() => ({}));
    const { action } = body;

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
      if (!Object.prototype.hasOwnProperty.call(TIPOS_ARCHIVO, body.tipo)) {
        return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 });
      }

      const subido = await subirPrivado(body.archivo, `clientes/${cliente._id}`);
      const usuario = await User.findById(decoded.userId).select('nombre email');
      const anterior = cliente.archivos.find((a) => a.tipo === body.tipo);
      cliente.archivos = cliente.archivos.filter((a) => a.tipo !== body.tipo);
      cliente.archivos.push({ tipo: body.tipo, ...subido, subidoPor: { userId: decoded.userId, nombre: usuario?.nombre || usuario?.email || '' }, fecha: new Date() });
      cliente.updatedAt = new Date();
      await cliente.save();
      if (anterior) await borrarPrivado(anterior);
      return NextResponse.json({ success: true, cliente: publico(cliente) });
    }

    return NextResponse.json({ error: 'Accion invalida' }, { status: 400 });
  } catch (error) {
    if (error.code === 11000) return NextResponse.json({ error: 'Ya existe un cliente con ese documento' }, { status: 409 });
    return handleError(error, 'POST');
  }
}
```

- [ ] **Step 4: Crear `nextjs/app/api/clientes/archivo/route.js`**
```js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import Cliente from '@/lib/models/Cliente';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { entregarArchivo } from '@/lib/archivos-privados';

// GET /api/clientes/archivo?id=<clienteId>&tipo=<dni_frente|dni_dorso|recibo|servicio>
// Entrega el documento solo al admin o al vendedor que cargó al cliente.
export async function GET(request) {
  try {
    const token = extractTokenFromHeaders(request.headers);
    if (!token) throw new Error('Token de autenticacion requerido');
    const decoded = verifyToken(token);
    requireRole(decoded, ['vendedor', 'admin']);

    const id = request.nextUrl.searchParams.get('id');
    const tipo = request.nextUrl.searchParams.get('tipo');
    const noEncontrado = NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    if (!mongoose.isValidObjectId(id) || !tipo) return noEncontrado;

    await connectDB();
    const cliente = await Cliente.findById(id);
    if (!cliente || (decoded.role !== 'admin' && cliente.creadoPor?.userId !== decoded.userId)) return noEncontrado;

    const archivo = cliente.archivos.find((a) => a.tipo === tipo);
    if (!archivo) return noEncontrado;
    return await entregarArchivo(archivo);
  } catch (error) {
    if (error.message?.includes('Token')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('Acceso denegado')) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error entregando archivo de cliente:', error);
    return NextResponse.json({ error: 'No se pudo obtener el archivo' }, { status: error.status || 500 });
  }
}
```

- [ ] **Step 5: Funciones de API.** Al final de `nextjs/services/api.js`:
```js

// =================== CLIENTES ===================

export const listarClientes = async (q = '') => {
  const response = await api.get('/clientes', { params: q ? { q } : {} });
  return response.data;
};

export const obtenerCliente = async (id) => {
  const response = await api.get('/clientes', { params: { id } });
  return response.data;
};

export const crearCliente = async (cliente) => {
  const response = await api.post('/clientes', { action: 'create', cliente });
  return response.data;
};

export const actualizarCliente = async (id, cliente) => {
  const response = await api.post('/clientes', { action: 'update', id, cliente });
  return response.data;
};

export const subirArchivoCliente = async (id, tipo, archivo) => {
  const response = await api.post('/clientes', { action: 'subir-archivo', id, tipo, archivo });
  return response.data;
};

// Devuelve el archivo como Blob (el navegador no puede mandar el token en un <img> o <a>)
export const obtenerArchivoCliente = async (id, tipo) => {
  const response = await api.get('/clientes/archivo', { params: { id, tipo }, responseType: 'blob' });
  return response.data;
};
```

- [ ] **Step 6: Compilar y commitear**
```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|/api/clientes"; cd ..
git add nextjs/lib/models/Cliente.js nextjs/lib/archivos-privados.js nextjs/app/api/clientes nextjs/services/api.js
git commit -m "$(cat <<'EOF'
feat: Clientes de vendedores en el servidor con documentos privados

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: `✓ Compiled successfully` y `/api/clientes` y `/api/clientes/archivo` en las rutas.

- [ ] **Step 7: Comprobar sin sesión** (con `next dev -p 3100` en segundo plano, y apagándolo después):
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/api/clientes"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/api/clientes/archivo?id=1&tipo=recibo"
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"action":"create"}' "http://localhost:3100/api/clientes"
```
Expected: `401` en las tres.

---

### Task 6: Pantalla Clientes y bloque en Usuarios

**Files:**
- Create: `nextjs/lib/leer-archivo.js`
- Create: `nextjs/lib/abrir-archivo.js`
- Create: `nextjs/components/clientes/ClienteForm.jsx`
- Create: `nextjs/components/admin/ClientesPanel.jsx`
- Create: `nextjs/app/admin/ventas/clientes/page.js`
- Modify: `nextjs/lib/admin-menu.js` (ítem `clientes`)
- Modify: `nextjs/components/admin/UsersPanel.jsx` (bloque "Clientes cargados por vendedores")

**Interfaces:**
- Consumes: `listarClientes`, `obtenerCliente`, `crearCliente`, `actualizarCliente`, `subirArchivoCliente`, `obtenerArchivoCliente` (Task 5); `FRASE_SIN_EMAIL`, `PROVINCIAS`, `TIPOS_DOCUMENTO`, `TIPOS_ARCHIVO` (Task 1); `useAdminSession` (proyecto B).
- Produces: `archivoADataUrl(file): Promise<string>` (achica imágenes a 1600 px y JPEG 0.82; valida tipo y 3 MB); `abrirBlobEnPestana(promesaDeBlob)`; `ClienteForm({ cliente, onGuardado, onCancelar })` (cliente opcional = alta; con `cliente` = edición con sección de documentos) — `onGuardado(clienteGuardado)`; ítem `clientes` (sección `ventas`, ruta `/admin/ventas/clientes`, ícono `Users`, roles `['admin', 'vendedor']`).

- [ ] **Step 1: Crear `nextjs/lib/leer-archivo.js`**
```js
// Convierte un archivo elegido en el navegador a data URL. Las fotos se achican antes de subir
// (las del celular pesan varios MB y las funciones del servidor aceptan hasta 3 MB).
const MAX_BYTES = 3 * 1024 * 1024;
const IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];

function leerComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

export async function archivoADataUrl(file, { maxDim = 1600, calidad = 0.82 } = {}) {
  if (!file) throw new Error('No elegiste ningún archivo');

  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error('El PDF no puede pesar más de 3 MB');
    return leerComoDataUrl(file);
  }
  if (!IMAGENES.includes(file.type)) throw new Error('Solo se aceptan imágenes JPG, PNG o WebP, o PDF');

  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', calidad);

  // Aproximación del tamaño real del binario a partir del base64
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
  if (bytes > MAX_BYTES) throw new Error('La imagen sigue pesando más de 3 MB después de achicarla');
  return dataUrl;
}
```

- [ ] **Step 2: Crear `nextjs/lib/abrir-archivo.js`**
```js
// Abre en una pestaña nueva un archivo privado que se pide con el token (no se puede enlazar directo).
// La pestaña se abre antes de esperar la respuesta para que el navegador no la bloquee.
export async function abrirBlobEnPestana(promesaDeBlob) {
  const ventana = window.open('', '_blank');
  try {
    const blob = await promesaDeBlob;
    const url = URL.createObjectURL(blob);
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (ventana) ventana.close();
    throw error;
  }
}
```

- [ ] **Step 3: Crear `nextjs/components/clientes/ClienteForm.jsx`**
```jsx
'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, Eye } from 'lucide-react';
import { crearCliente, actualizarCliente, subirArchivoCliente, obtenerArchivoCliente } from '@/services/api';
import { FRASE_SIN_EMAIL, PROVINCIAS, TIPOS_DOCUMENTO, TIPOS_ARCHIVO } from '@/lib/cliente-validate';
import { archivoADataUrl } from '@/lib/leer-archivo';
import { abrirBlobEnPestana } from '@/lib/abrir-archivo';

const VACIO = {
  nombre: '', tipoDocumento: 'DNI', numeroDocumento: '', telefono: '', email: '',
  domicilio: { calle: '', numero: '', localidad: '', provincia: PROVINCIAS[0] },
};

function Campo({ etiqueta, children, ayuda }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium mb-1">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-xs text-gray-500 mt-1">{ayuda}</span>}
    </label>
  );
}

export default function ClienteForm({ cliente, onGuardado, onCancelar }) {
  const editando = Boolean(cliente);
  const [datos, setDatos] = useState(() => (cliente ? {
    nombre: cliente.nombre, tipoDocumento: cliente.tipoDocumento, numeroDocumento: cliente.numeroDocumento,
    telefono: cliente.telefono, email: cliente.email, domicilio: { ...cliente.domicilio },
  } : VACIO));
  const [actual, setActual] = useState(cliente || null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(null);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState([]);
  const inputArchivo = useRef(null);
  const tipoPendiente = useRef(null);

  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }));
  const cambiarDom = (campo, valor) => setDatos((d) => ({ ...d, domicilio: { ...d.domicilio, [campo]: valor } }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setErrores([]);
    try {
      const data = actual ? await actualizarCliente(actual._id, datos) : await crearCliente(datos);
      setActual(data.cliente);
      onGuardado?.(data.cliente);
    } catch (err) {
      setErrores(err.response?.data?.errores || []);
      setError(err.response?.data?.error || 'No se pudo guardar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const elegirArchivo = (tipo) => {
    tipoPendiente.current = tipo;
    inputArchivo.current?.click();
  };

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const tipo = tipoPendiente.current;
    if (!file || !tipo || !actual) return;
    setSubiendo(tipo);
    setError(null);
    try {
      const dataUrl = await archivoADataUrl(file);
      const data = await subirArchivoCliente(actual._id, tipo, dataUrl);
      setActual(data.cliente);
      onGuardado?.(data.cliente);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo subir el archivo');
    } finally {
      setSubiendo(null);
    }
  };

  const tiene = (tipo) => actual?.archivos?.some((a) => a.tipo === tipo);

  return (
    <form onSubmit={handleGuardar} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombre y apellido *">
          <input className="w-full border rounded px-3 py-2" value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
        </Campo>
        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="Documento *">
            <select className="w-full border rounded px-2 py-2" value={datos.tipoDocumento} disabled={editando}
              onChange={(e) => cambiar('tipoDocumento', e.target.value)}>
              {TIPOS_DOCUMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <div className="col-span-2">
            <Campo etiqueta="Número *">
              <input className="w-full border rounded px-3 py-2" value={datos.numeroDocumento} disabled={editando}
                onChange={(e) => cambiar('numeroDocumento', e.target.value)} />
            </Campo>
          </div>
        </div>
        <Campo etiqueta="Teléfono *">
          <input type="tel" className="w-full border rounded px-3 py-2" value={datos.telefono} onChange={(e) => cambiar('telefono', e.target.value)} />
        </Campo>
        <Campo etiqueta="Email *" ayuda={`Si el cliente no tiene, escribí exactamente: ${FRASE_SIN_EMAIL}`}>
          <input className="w-full border rounded px-3 py-2" value={datos.email} onChange={(e) => cambiar('email', e.target.value)} autoComplete="off" />
        </Campo>
        <Campo etiqueta="Calle *">
          <input className="w-full border rounded px-3 py-2" value={datos.domicilio.calle} onChange={(e) => cambiarDom('calle', e.target.value)} />
        </Campo>
        <Campo etiqueta="Número *">
          <input className="w-full border rounded px-3 py-2" value={datos.domicilio.numero} onChange={(e) => cambiarDom('numero', e.target.value)} />
        </Campo>
        <Campo etiqueta="Localidad *">
          <input className="w-full border rounded px-3 py-2" value={datos.domicilio.localidad} onChange={(e) => cambiarDom('localidad', e.target.value)} />
        </Campo>
        <Campo etiqueta="Provincia *">
          <select className="w-full border rounded px-3 py-2" value={datos.domicilio.provincia} onChange={(e) => cambiarDom('provincia', e.target.value)}>
            {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Campo>
      </div>

      {error && (
        <div role="alert" className="rounded-lg p-3 text-sm border bg-red-50 border-red-200 text-red-800">
          {error}
          {errores.length > 0 && <ul className="list-disc ml-5 mt-1">{errores.map((er) => <li key={er}>{er}</li>)}</ul>}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={guardando} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          {actual ? 'Guardar cambios' : 'Guardar cliente'}
        </button>
        {onCancelar && <button type="button" onClick={onCancelar} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">Cerrar</button>}
      </div>

      <div className="border-t pt-4">
        <h4 className="font-semibold text-sm mb-2">Documentación</h4>
        {!actual ? (
          <p className="text-sm text-gray-500">Primero guardá el cliente; después vas a poder subir el DNI, el recibo y un servicio.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">Los archivos son privados: solo los ven el administrador y quien cargó al cliente. JPG, PNG, WebP o PDF.</p>
            <input ref={inputArchivo} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleArchivo} />
            <ul className="space-y-2">
              {Object.entries(TIPOS_ARCHIVO).map(([tipo, etiqueta]) => (
                <li key={tipo} className="flex items-center gap-3 text-sm">
                  <span className="w-56">{etiqueta}</span>
                  <span className={tiene(tipo) ? 'text-green-700' : 'text-gray-400'}>{tiene(tipo) ? 'Cargado' : 'Falta'}</span>
                  {tiene(tipo) && (
                    <button type="button" onClick={() => abrirBlobEnPestana(obtenerArchivoCliente(actual._id, tipo)).catch(() => setError('No se pudo abrir el archivo'))}
                      className="flex items-center gap-1 text-blue-600 hover:underline"><Eye className="w-4 h-4" /> Ver</button>
                  )}
                  <button type="button" disabled={subiendo === tipo} onClick={() => elegirArchivo(tipo)}
                    className="flex items-center gap-1 text-blue-600 hover:underline disabled:text-gray-400">
                    {subiendo === tipo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {tiene(tipo) ? 'Reemplazar' : 'Subir'}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Crear `nextjs/components/admin/ClientesPanel.jsx`**
```jsx
'use client';

import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { listarClientes } from '@/services/api';
import { useAdminSession } from '@/components/admin/AdminSession';
import ClienteForm from '@/components/clientes/ClienteForm';

export default function ClientesPanel() {
  const { role } = useAdminSession();
  const [clientes, setClientes] = useState([]);
  const [q, setQ] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null); // null = cerrado, 'nuevo' o un cliente

  const cargar = (texto) => {
    setCargando(true);
    listarClientes(texto)
      .then((data) => { setClientes(data.clientes || []); setError(null); })
      .catch(() => setError('No se pudieron cargar los clientes'))
      .finally(() => setCargando(false));
  };

  // Búsqueda con una pequeña espera para no consultar en cada tecla
  useEffect(() => {
    const espera = setTimeout(() => cargar(q), 300);
    return () => clearTimeout(espera);
  }, [q]);

  const alGuardar = () => cargar(q);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-sm text-gray-500">{role === 'admin' ? 'Todos los clientes cargados por los vendedores.' : 'Los clientes que cargaste vos.'}</p>
        </div>
        <button type="button" onClick={() => setAbierto('nuevo')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o teléfono"
          className="w-full border rounded pl-9 pr-3 py-2 text-sm" />
      </div>

      {error && <div role="alert" className="rounded-lg p-3 text-sm border bg-red-50 border-red-200 text-red-800">{error}</div>}

      {abierto && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">{abierto === 'nuevo' ? 'Nuevo cliente' : abierto.nombre}</h3>
          <ClienteForm key={abierto === 'nuevo' ? 'nuevo' : abierto._id} cliente={abierto === 'nuevo' ? null : abierto} onGuardado={alGuardar} onCancelar={() => setAbierto(null)} />
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-xs uppercase text-gray-700">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Email</th>
              {role === 'admin' && <th className="px-4 py-3">Cargado por</th>}
              <th className="px-4 py-3">Documentos</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clientes.map((c) => (
              <tr key={c._id}>
                <td className="px-4 py-3 font-medium">{c.nombre}</td>
                <td className="px-4 py-3">{c.tipoDocumento} {c.numeroDocumento}</td>
                <td className="px-4 py-3">{c.telefono}</td>
                <td className="px-4 py-3 max-w-[14rem] truncate" title={c.email}>{c.email}</td>
                {role === 'admin' && <td className="px-4 py-3">{c.creadoPor?.nombre || '-'}</td>}
                <td className="px-4 py-3">{c.archivos.length} de 4</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setAbierto(c)} className="text-blue-600 hover:underline">Abrir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && clientes.length === 0 && <div className="text-center py-10 text-gray-500">No hay clientes{q ? ' con esa búsqueda' : ' cargados todavía'}.</div>}
        {cargando && <div className="text-center py-6 text-gray-400">Cargando...</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Crear la página y el ítem del menú**

`nextjs/app/admin/ventas/clientes/page.js`
```jsx
import ClientesPanel from '@/components/admin/ClientesPanel';

export default function Page() {
  return <ClientesPanel />;
}
```
En `nextjs/lib/admin-menu.js`, dentro de `ITEMS`, justo después de `creditos`:
```js
  { id: 'clientes', seccion: 'ventas', etiqueta: 'Clientes', icono: 'Users', ruta: '/admin/ventas/clientes', roles: ['admin', 'vendedor'] },
```

- [ ] **Step 6: Bloque en Usuarios.** En `nextjs/components/admin/UsersPanel.jsx`: (a) agregar `listarClientes` al import de `@/services/api` (y los íconos/hooks que falten); (b) agregar, arriba de `export default function UsersPanel`, este componente:
```jsx
function ClientesDeVendedoresBlock() {
  const [clientes, setClientes] = useState([]);
  const [q, setQ] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const espera = setTimeout(() => {
      setCargando(true);
      listarClientes(q)
        .then((data) => setClientes(data.clientes || []))
        .catch(() => setClientes([]))
        .finally(() => setCargando(false));
    }, 300);
    return () => clearTimeout(espera);
  }, [q]);

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-3">
      <h3 className="text-lg font-semibold">Clientes cargados por vendedores</h3>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o teléfono"
        className="w-full border rounded px-3 py-2 text-sm" />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-gray-600">
            <tr><th className="py-2 pr-4">Cliente</th><th className="py-2 pr-4">Documento</th><th className="py-2 pr-4">Teléfono</th><th className="py-2 pr-4">Email</th><th className="py-2">Cargado por</th></tr>
          </thead>
          <tbody className="divide-y">
            {clientes.map((c) => (
              <tr key={c._id}>
                <td className="py-2 pr-4">
                  {c.nombre}{' '}
                  <span className="ml-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">Cliente creado por vendedor</span>
                </td>
                <td className="py-2 pr-4">{c.tipoDocumento} {c.numeroDocumento}</td>
                <td className="py-2 pr-4">{c.telefono}</td>
                <td className="py-2 pr-4 max-w-[14rem] truncate" title={c.email}>{c.email}</td>
                <td className="py-2">{c.creadoPor?.nombre || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && clientes.length === 0 && <p className="text-sm text-gray-500 py-4">No hay clientes cargados por vendedores.</p>}
      </div>
    </div>
  );
}
```
(c) en el `return` de `UsersPanel`, justo después de `<InvitationsBlock />`, agregar `<ClientesDeVendedoresBlock />`.

- [ ] **Step 7: Actualizar el verificador del menú.** En `docs/superpowers/plans/verificar-menu-config.mjs`, el caso `vendedor ve solo créditos, productos y depósitos` espera `['creditos', 'depositos', 'productos']`; ahora el vendedor también ve Clientes: cambiar la lista esperada a `['clientes', 'creditos', 'depositos', 'productos']` (y el nombre del caso a `vendedor ve solo clientes, créditos, productos y depósitos`).

- [ ] **Step 8: Verificar, compilar y commitear**
```bash
for v in verificar-menu verificar-permisos verificar-menu-config verificar-credito; do node docs/superpowers/plans/$v.mjs 2>&1 | grep -E "✓|✗|  - "; done
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|/admin/ventas"; cd ..
git add nextjs/lib/leer-archivo.js nextjs/lib/abrir-archivo.js nextjs/components/clientes nextjs/components/admin nextjs/app/admin/ventas/clientes nextjs/lib/admin-menu.js docs/superpowers/plans/verificar-menu-config.mjs
git commit -m "$(cat <<'EOF'
feat: Pantalla Clientes con documentación privada y bloque en Usuarios

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: los cuatro verificadores con `✓` (menú: `13 pestañas`), `✓ Compiled successfully` y la ruta `/admin/ventas/clientes`.

---

### Task 7: Crédito con cliente, plan y registro de quién carga y quién aprueba

**Files:**
- Modify: `nextjs/lib/models/CreditoVenta.js` (reemplazo completo)
- Modify: `nextjs/app/api/creditos/route.js` (acciones `create`, `aprobar` y `rechazar`; se elimina `calcularCuotas`)

**Interfaces:**
- Consumes: `Cliente` (Task 5), `getCreditoConfig` (Task 3), `calcularPlan`, `evaluarAprobacion`, `buscarPlan` (Task 1).
- Produces: `POST /api/creditos` con `action: 'create'` y body `{ clienteId, productos, montoTotal, anticipo, frecuencia, cantidadCuotas, depositoId }` → 201 `{ success, credito }`. `CreditoVenta` con los campos nuevos descritos abajo (todos opcionales para los créditos viejos).

- [ ] **Step 1: Reemplazar `nextjs/lib/models/CreditoVenta.js` por:**
```js
import mongoose from 'mongoose';

const QuienSchema = new mongoose.Schema({
  userId: String,
  nombre: String
}, { _id: false });

// Forma en que se cobró un pago (anticipo o cuota)
const PagoSchema = new mongoose.Schema({
  metodo: { type: String, enum: ['comprobante', 'efectivo'], required: true },
  comprobante: {
    publicId: String,
    resourceType: String,
    formato: String,
    version: Number
  },
  registradoPor: QuienSchema,
  fecha: { type: Date, default: Date.now }
}, { _id: false });

const CuotaSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  monto: { type: Number, required: true },
  vencimiento: { type: Date, required: true },
  estado: { type: String, enum: ['pendiente', 'pagada'], default: 'pendiente' },
  fechaPago: { type: Date, default: null },
  pago: { type: PagoSchema, default: undefined }
}, { _id: false });

const AprobacionSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['automatica', 'admin'] },
  userId: String,
  nombre: String,
  fecha: Date
}, { _id: false });

const CreditoVentaSchema = new mongoose.Schema({
  // Cliente: los créditos nuevos referencian la ficha; los datos se copian para que el registro sea estable
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null },
  clienteNombre: { type: String, required: true },
  clienteTelefono: { type: String },
  clienteEmail: { type: String },
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendedorNombre: { type: String },
  cargadoPor: { type: QuienSchema, default: undefined },
  depositoId: { type: String, default: null },
  productos: [{
    productId: String,
    nombre: String,
    precio: Number,
    cantidad: Number
  }],
  montoTotal: { type: Number, required: true },
  anticipo: { type: Number, default: 0 },
  anticipoPago: {
    estado: { type: String, enum: ['no_aplica', 'pendiente', 'cobrado'], default: 'no_aplica' },
    metodo: { type: String, enum: ['comprobante', 'efectivo'] },
    comprobante: { publicId: String, resourceType: String, formato: String, version: Number },
    registradoPor: QuienSchema,
    fecha: Date
  },
  // Plan elegido (créditos viejos: sin frecuencia, se consideran mensuales sin recargo)
  frecuencia: { type: String, enum: ['diaria', 'semanal', 'mensual'], default: 'mensual' },
  recargoPorcentaje: { type: Number, default: 0 },
  interes: { type: Number, default: 0 },
  totalCuotas: { type: Number },
  montoCuota: { type: Number },
  cantidadCuotas: { type: Number, required: true },
  cuotas: [CuotaSchema],
  estado: {
    type: String,
    enum: ['pendiente_aprobacion', 'activo', 'rechazado', 'completado'],
    default: 'activo'
  },
  motivoAprobacion: { type: String, default: '' },
  aprobadoPor: { type: AprobacionSchema, default: undefined },
  rechazadoPor: { type: QuienSchema, default: undefined },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.CreditoVenta || mongoose.model('CreditoVenta', CreditoVentaSchema);
```

- [ ] **Step 2: Cambios en `nextjs/app/api/creditos/route.js`.**
(a) Imports: agregar `import mongoose from 'mongoose';`, `import Cliente from '@/lib/models/Cliente';`, `import { getCreditoConfig } from '@/lib/credito-config';` e `import { calcularPlan, evaluarAprobacion, buscarPlan } from '@/lib/credito-calculo';`; quitar el import de `PaymentSettings` si queda sin uso.
(b) Borrar la función `calcularCuotas`.
(c) Agregar, debajo de `authenticate`, estos helpers:
```js
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
```
(d) Reemplazar **todo** el bloque `if (action === 'create') { ... }` por:
```js
    if (action === 'create') {
      const decoded = authenticate(request, ['vendedor', 'admin']);
      const { clienteId, productos, montoTotal, anticipo, frecuencia, cantidadCuotas, depositoId } = body;

      if (!mongoose.isValidObjectId(clienteId)) {
        return NextResponse.json({ error: 'Elegí un cliente' }, { status: 400 });
      }
      const cliente = await Cliente.findById(clienteId);
      // Un cliente ajeno se responde igual que uno inexistente
      if (!cliente || (decoded.role !== 'admin' && cliente.creadoPor?.userId !== decoded.userId)) {
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
```
(e) En el bloque `aprobar`/`rechazar`, reemplazar las dos líneas que asignan el estado y guardan por:
```js
      const quien = { userId: decoded.userId, nombre: await nombreDe(decoded.userId) };
      credito.estado = action === 'aprobar' ? 'activo' : 'rechazado';
      if (action === 'aprobar') {
        credito.aprobadoPor = { tipo: 'admin', ...quien, fecha: new Date() };
      } else {
        credito.rechazadoPor = quien;
      }
      await credito.save();
```
y cambiar la línea `authenticate(request, ['admin']);` de ese bloque por `const decoded = authenticate(request, ['admin']);`. No tocar la reposición de stock al rechazar.
(f) **No** tocar todavía la acción `marcar-cuota` (se reemplaza en la Task 8).

- [ ] **Step 3: Compilar, verificar y commitear**
```bash
for v in verificar-credito verificar-menu; do node docs/superpowers/plans/$v.mjs 2>&1 | grep -E "✓|✗"; done
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
git add nextjs/lib/models/CreditoVenta.js nextjs/app/api/creditos/route.js
git commit -m "$(cat <<'EOF'
feat: Crédito propio con cliente, plan por frecuencia y registro de quién carga y aprueba

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: `✓ Crédito y clientes OK`, `✓ Menú OK`, `✓ Compiled successfully`.

- [ ] **Step 4: Comprobar sin sesión** (dev en segundo plano, apagándolo después): `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{"action":"create"}' http://localhost:3100/api/creditos` → Expected: `401`.

---

### Task 8: Cobros del anticipo y de las cuotas (comprobante o en mano)

**Files:**
- Modify: `nextjs/app/api/creditos/route.js` (reemplazar `marcar-cuota` por `registrar-cobro`)
- Create: `nextjs/app/api/creditos/comprobante/route.js`
- Modify: `nextjs/services/api.js` (dos funciones nuevas; `marcarCuotaCredito` queda hasta la Task 9)

**Interfaces:**
- Consumes: `subirPrivado`, `entregarArchivo` (Task 5), modelo `CreditoVenta` (Task 7).
- Produces: `POST /api/creditos` con `action: 'registrar-cobro'` y body `{ id, numero, metodo: 'comprobante' | 'efectivo', archivo? }` (`numero` 0 = anticipo; `archivo` es un data URL, obligatorio si `metodo` es `comprobante`) → `{ success, credito }`; `GET /api/creditos/comprobante?id=<creditoId>&numero=<n>` → bytes del comprobante (solo admin o el vendedor dueño); en `services/api.js`: `registrarCobroCredito(id, numero, metodo, archivo?)`, `obtenerComprobanteCredito(id, numero): Promise<Blob>`.

- [ ] **Step 1: Reemplazar el bloque `marcar-cuota`** de `nextjs/app/api/creditos/route.js` (todo el `if (action === 'marcar-cuota') { ... }`) por:
```js
    if (action === 'registrar-cobro') {
      const decoded = authenticate(request, ['vendedor', 'admin']);
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
      if (!credito || (decoded.role !== 'admin' && String(credito.vendedorId) !== decoded.userId)) {
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

      if (numero === 0) {
        credito.anticipoPago = { estado: 'cobrado', metodo, comprobante, registradoPor, fecha };
      } else {
        cuota.estado = 'pagada';
        cuota.fechaPago = fecha;
        cuota.pago = { metodo, comprobante, registradoPor, fecha };
        if (credito.cuotas.every((c) => c.estado === 'pagada')) credito.estado = 'completado';
      }
      await credito.save();

      return NextResponse.json({ success: true, credito });
    }
```
Agregar al principio del archivo `import { subirPrivado } from '@/lib/archivos-privados';`. Y en `handleError` del final del archivo, antes del 500, agregar:
```js
  if (error.status === 400) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
```

- [ ] **Step 2: Crear `nextjs/app/api/creditos/comprobante/route.js`**
```js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import CreditoVenta from '@/lib/models/CreditoVenta';
import { extractTokenFromHeaders, verifyToken, requireRole } from '@/lib/auth-helpers';
import { entregarArchivo } from '@/lib/archivos-privados';

// GET /api/creditos/comprobante?id=<creditoId>&numero=<0 anticipo | n° de cuota>
// Entrega el comprobante solo al admin o al vendedor dueño del crédito.
export async function GET(request) {
  try {
    const token = extractTokenFromHeaders(request.headers);
    if (!token) throw new Error('Token de autenticacion requerido');
    const decoded = verifyToken(token);
    requireRole(decoded, ['vendedor', 'admin']);

    const id = request.nextUrl.searchParams.get('id');
    const numero = Number(request.nextUrl.searchParams.get('numero'));
    const noEncontrado = NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
    if (!mongoose.isValidObjectId(id) || !Number.isInteger(numero) || numero < 0) return noEncontrado;

    await connectDB();
    const credito = await CreditoVenta.findById(id);
    if (!credito || (decoded.role !== 'admin' && String(credito.vendedorId) !== decoded.userId)) return noEncontrado;

    const pago = numero === 0 ? credito.anticipoPago : credito.cuotas.find((c) => c.numero === numero)?.pago;
    if (!pago || pago.metodo !== 'comprobante' || !pago.comprobante?.publicId) return noEncontrado;
    return await entregarArchivo(pago.comprobante);
  } catch (error) {
    if (error.message?.includes('Token')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('Acceso denegado')) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Error entregando comprobante:', error);
    return NextResponse.json({ error: 'No se pudo obtener el comprobante' }, { status: error.status || 500 });
  }
}
```

- [ ] **Step 3: Funciones de API.** En `nextjs/services/api.js`, debajo de `marcarCuotaCredito`, agregar:
```js

export const registrarCobroCredito = async (id, numero, metodo, archivo) => {
  const response = await api.post('/creditos', { action: 'registrar-cobro', id, numero, metodo, archivo });
  return response.data;
};

// Devuelve el comprobante como Blob (el navegador no puede mandar el token en un <a>)
export const obtenerComprobanteCredito = async (id, numero) => {
  const response = await api.get('/creditos/comprobante', { params: { id, numero }, responseType: 'blob' });
  return response.data;
};
```

- [ ] **Step 4: Compilar y commitear**
```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error|/api/creditos"; cd ..
git add nextjs/app/api/creditos nextjs/services/api.js
git commit -m "$(cat <<'EOF'
feat: Cobro del anticipo y las cuotas con comprobante privado o cobrado en mano

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: `✓ Compiled successfully` y `/api/creditos/comprobante` en las rutas. Comprobar sin sesión: `curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/api/creditos/comprobante?id=1&numero=0"` → `401`.

---

### Task 9: Panel del vendedor — otorgar crédito con cliente y plan, y cobrar

**Files:**
- Create: `nextjs/components/clientes/ClienteSelector.jsx`
- Create: `nextjs/components/clientes/CobroDialog.jsx`
- Modify: `nextjs/components/VendedorModal.jsx` (reemplazar `OtorgarCreditoTab` y `MisCreditosTab`, ajustar su llamada)
- Modify: `nextjs/services/api.js` (borrar `marcarCuotaCredito`)

**Interfaces:**
- Consumes: `ClienteForm` (Task 6), `listarClientes` (Task 5), `obtenerCreditoConfig` (Task 3), `calcularPlan`, `evaluarAprobacion` (Task 1), `crearCredito`, `listarCreditos`, `registrarCobroCredito`, `obtenerComprobanteCredito` (Task 8), `archivoADataUrl`, `abrirBlobEnPestana` (Task 6).
- Produces: `ClienteSelector({ value, onChange })` (`value` = cliente elegido o `null`); `CobroDialog({ titulo, onConfirmar, onCancelar })` — `onConfirmar(metodo, dataUrlOpcional)` devuelve una promesa; `OtorgarCreditoTab({ carritoVendedor, calcularTotal, onCreado })` (ya no recibe `cliente` ni `setCliente`).

- [ ] **Step 1: Crear `nextjs/components/clientes/ClienteSelector.jsx`**
```jsx
'use client';

import { useEffect, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { listarClientes } from '@/services/api';
import ClienteForm from '@/components/clientes/ClienteForm';

// Elige un cliente propio (buscador) o crea uno nuevo sin salir de la pantalla
export default function ClienteSelector({ value, onChange }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (value || creando) return undefined;
    const espera = setTimeout(() => {
      listarClientes(q).then((d) => setResultados((d.clientes || []).slice(0, 8))).catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(espera);
  }, [q, value, creando]);

  if (value) {
    return (
      <div className="flex items-start justify-between bg-gray-50 rounded-lg p-3">
        <div className="text-sm">
          <p className="font-semibold">{value.nombre}</p>
          <p className="text-gray-500">{value.tipoDocumento} {value.numeroDocumento} · {value.telefono}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Cambiar cliente" className="p-1 text-gray-500 hover:text-gray-700"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (creando) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold mb-3">Nuevo cliente</h4>
        <ClienteForm onGuardado={(c) => { onChange(c); setCreando(false); }} onCancelar={() => setCreando(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente por nombre, documento o teléfono"
          className="input-field pl-9" />
      </div>
      {resultados.map((c) => (
        <button key={c._id} type="button" onClick={() => onChange(c)} className="w-full text-left bg-white border rounded-lg p-2 text-sm hover:bg-gray-50">
          <span className="font-medium">{c.nombre}</span>
          <span className="text-gray-500"> · {c.tipoDocumento} {c.numeroDocumento}</span>
        </button>
      ))}
      <button type="button" onClick={() => setCreando(true)} className="flex items-center gap-2 text-sm text-primary hover:underline">
        <UserPlus className="w-4 h-4" /> Cargar un cliente nuevo
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Crear `nextjs/components/clientes/CobroDialog.jsx`**
```jsx
'use client';

import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { archivoADataUrl } from '@/lib/leer-archivo';

// Pide cómo se cobró un pago: comprobante (foto o PDF) o "ya lo cobré, lo tengo en mano"
export default function CobroDialog({ titulo, onConfirmar, onCancelar }) {
  const [metodo, setMetodo] = useState('comprobante');
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const input = useRef(null);

  const confirmar = async () => {
    setError(null);
    setProcesando(true);
    try {
      let dataUrl;
      if (metodo === 'comprobante') {
        if (!archivo) throw new Error('Elegí la foto o el PDF del comprobante');
        dataUrl = await archivoADataUrl(archivo);
      }
      await onConfirmar(metodo, dataUrl);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo registrar el cobro');
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4" role="dialog" aria-label={titulo}>
        <h3 className="text-lg font-semibold">{titulo}</h3>

        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="metodo-cobro" checked={metodo === 'comprobante'} onChange={() => setMetodo('comprobante')} className="mt-1" />
          <span>Subir comprobante (transferencia o depósito)</span>
        </label>
        {metodo === 'comprobante' && (
          <div className="ml-6">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="text-sm" />
          </div>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="metodo-cobro" checked={metodo === 'efectivo'} onChange={() => setMetodo('efectivo')} className="mt-1" />
          <span>Ya lo cobré y lo tengo en mano</span>
        </label>

        {error && <div role="alert" className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} disabled={procesando} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={procesando} className="px-4 py-2 text-sm bg-primary text-white rounded flex items-center gap-2 disabled:opacity-50">
            {procesando && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar cobro
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: En `nextjs/components/VendedorModal.jsx` reemplazar `OtorgarCreditoTab` completo por:**
```jsx
function OtorgarCreditoTab({ carritoVendedor, calcularTotal, onCreado }) {
  const [cliente, setCliente] = useState(null);
  const [config, setConfig] = useState(null);
  const [frecuencia, setFrecuencia] = useState('mensual');
  const [cuotas, setCuotas] = useState('');
  const [anticipoPorcentaje, setAnticipoPorcentaje] = useState(20);
  const [depositos, setDepositos] = useState([]);
  const [depositoId, setDepositoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerCreditoConfig().then((d) => setConfig(d.config)).catch(() => setError('No se pudieron cargar los planes de crédito'));
    listarDepositos().then((data) => {
      const virtuales = (data.depositos || []).filter(d => d.esVirtualVendedor && d.activo);
      setDepositos(virtuales);
      if (virtuales.length > 0) setDepositoId(virtuales[0]._id);
    }).catch(() => {});
  }, []);

  const planes = (config?.planes || []).filter((p) => p.frecuencia === frecuencia).sort((a, b) => a.cuotas - b.cuotas);
  // Si el plan elegido ya no existe en esta frecuencia, se toma el primero disponible
  const plan = planes.find((p) => p.cuotas === Number(cuotas)) || planes[0] || null;

  const montoTotal = calcularTotal();
  const anticipo = Math.round(montoTotal * (anticipoPorcentaje / 100));
  const calculo = plan
    ? calcularPlan({ montoTotal, anticipo, cantidadCuotas: plan.cuotas, frecuencia: plan.frecuencia, recargoPorcentaje: plan.recargo })
    : null;
  const aprobacion = plan && config
    ? evaluarAprobacion({ montoTotal, plan, montoMaximoSinAprobacion: config.montoMaximoSinAprobacion })
    : { requiere: false, motivo: '' };
  const frecuenciasDisponibles = ['diaria', 'semanal', 'mensual'].filter((f) => (config?.planes || []).some((p) => p.frecuencia === f));

  const handleOtorgar = async () => {
    setError('');
    const items = Object.values(carritoVendedor);
    if (items.length === 0) { setError('Agrega productos en la pestana Presupuesto antes de otorgar el credito'); return; }
    if (!cliente) { setError('Elegí o cargá el cliente'); return; }
    if (!plan || !calculo?.ok) { setError(calculo?.errores?.[0] || 'Elegí un plan de cuotas'); return; }

    setLoading(true);
    try {
      await crearCredito({
        clienteId: cliente._id,
        depositoId: depositoId || null,
        productos: items.map(i => ({ productId: i._id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })),
        montoTotal,
        anticipo,
        frecuencia: plan.frecuencia,
        cantidadCuotas: plan.cuotas
      });
      alert(aprobacion.requiere ? 'Credito cargado: queda pendiente de aprobacion del administrador' : 'Credito otorgado correctamente');
      onCreado();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo otorgar el credito');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h3 className="text-xl font-semibold">Otorgar credito al cliente</h3>
      <p className="text-sm text-gray-500">
        Usa los productos cargados en la pestana "Presupuesto" como base del monto total.
      </p>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <ClienteSelector value={cliente} onChange={setCliente} />

      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <div className="flex justify-between text-sm">
          <span>Monto total (segun presupuesto)</span>
          <span className="font-bold">${montoTotal.toLocaleString('es-AR')}</span>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Anticipo (%)</label>
          <input type="number" min="0" max="90" value={anticipoPorcentaje}
            onChange={(e) => setAnticipoPorcentaje(Number(e.target.value))} className="input-field" />
          <p className="text-xs text-gray-500 mt-1">Anticipo: ${anticipo.toLocaleString('es-AR')}</p>
        </div>

        {!config ? (
          <p className="text-sm text-gray-500">Cargando planes...</p>
        ) : frecuenciasDisponibles.length === 0 ? (
          <p className="text-sm text-red-600">No hay planes de crédito habilitados. Pedile al administrador que los cargue.</p>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Frecuencia de las cuotas</label>
              <select value={frecuencia} onChange={(e) => { setFrecuencia(e.target.value); setCuotas(''); }} className="input-field">
                {frecuenciasDisponibles.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Plan</label>
              <select value={plan?.cuotas ?? ''} onChange={(e) => setCuotas(e.target.value)} className="input-field">
                {planes.map((p) => <option key={p.cuotas} value={p.cuotas}>{p.cuotas} cuotas {p.recargo > 0 ? `(+${p.recargo}%)` : '(sin recargo)'}</option>)}
              </select>
            </div>
            {calculo?.ok && (
              <div className="text-sm bg-white rounded p-3 border space-y-1">
                <div className="flex justify-between"><span>Saldo a financiar</span><span>${calculo.montoFinanciado.toLocaleString('es-AR')}</span></div>
                <div className="flex justify-between"><span>Recargo</span><span>${calculo.interes.toLocaleString('es-AR')}</span></div>
                <div className="flex justify-between font-semibold"><span>{plan.cuotas} cuotas de</span><span>${calculo.montoCuota.toLocaleString('es-AR')}</span></div>
                <div className="flex justify-between text-gray-500"><span>Total final</span><span>${calculo.totalFinal.toLocaleString('es-AR')}</span></div>
              </div>
            )}
            {calculo && !calculo.ok && <p className="text-sm text-red-600">{calculo.errores[0]}</p>}
            {aprobacion.requiere && (
              <p className="text-sm bg-yellow-50 text-yellow-800 rounded p-2">Queda pendiente de aprobación del administrador: {aprobacion.motivo}</p>
            )}
          </>
        )}

        {depositos.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Deposito de origen</label>
            <select value={depositoId} onChange={(e) => setDepositoId(e.target.value)} className="input-field">
              {depositos.map(d => (<option key={d._id} value={d._id}>{d.nombre}</option>))}
            </select>
          </div>
        )}
      </div>

      <button onClick={handleOtorgar} disabled={loading || !calculo?.ok} className="w-full btn-primary disabled:opacity-50">
        {loading ? 'Otorgando...' : 'Otorgar credito'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Reemplazar `MisCreditosTab` completo por:**
```jsx
function MisCreditosTab({ isOpen }) {
  const [creditos, setCreditos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cobro, setCobro] = useState(null); // { credito, numero, titulo }

  useEffect(() => {
    if (isOpen) fetchCreditos();
  }, [isOpen]);

  const fetchCreditos = async () => {
    try {
      setLoading(true);
      const data = await listarCreditos();
      setCreditos(data.creditos || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  };

  const confirmarCobro = async (metodo, archivo) => {
    await registrarCobroCredito(cobro.credito._id, cobro.numero, metodo, archivo);
    setCobro(null);
    fetchCreditos();
  };

  const verComprobante = (credito, numero) =>
    abrirBlobEnPestana(obtenerComprobanteCredito(credito._id, numero)).catch(() => alert('No se pudo abrir el comprobante'));

  const estadoBadge = (estado) => {
    const styles = {
      activo: 'bg-green-100 text-green-700',
      pendiente_aprobacion: 'bg-yellow-100 text-yellow-700',
      rechazado: 'bg-red-100 text-red-700',
      completado: 'bg-blue-100 text-blue-700'
    };
    const labels = { activo: 'Activo', pendiente_aprobacion: 'Pendiente de aprobacion', rechazado: 'Rechazado', completado: 'Completado' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[estado] || 'bg-gray-100'}`}>{labels[estado] || estado}</span>;
  };

  const etiquetaPago = (pago) => (pago?.metodo === 'efectivo' ? 'Cobrada en mano' : 'Con comprobante');

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando creditos...</div>;

  if (creditos.length === 0) {
    return <div className="text-center py-12 text-gray-500">No otorgaste ningun credito todavia.</div>;
  }

  return (
    <div className="space-y-4">
      {cobro && <CobroDialog titulo={cobro.titulo} onConfirmar={confirmarCobro} onCancelar={() => setCobro(null)} />}
      {creditos.map((credito) => (
        <div key={credito._id} className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-semibold">{credito.clienteNombre}</p>
              <p className="text-xs text-gray-500">{credito.clienteTelefono}</p>
            </div>
            {estadoBadge(credito.estado)}
          </div>
          <div className="text-sm text-gray-600 mb-1">
            Total ${credito.montoTotal.toLocaleString('es-AR')} — Anticipo ${credito.anticipo.toLocaleString('es-AR')} — {credito.cantidadCuotas} cuotas {{ diaria: 'diarias', semanal: 'semanales', mensual: 'mensuales' }[credito.frecuencia || 'mensual']}
            {credito.recargoPorcentaje > 0 ? ` (+${credito.recargoPorcentaje}%)` : ''}
          </div>
          {credito.aprobadoPor && (
            <p className="text-xs text-gray-500 mb-3">
              {credito.aprobadoPor.tipo === 'admin' ? `Aprobado por ${credito.aprobadoPor.nombre}` : 'Aprobación automática (dentro de los límites)'}
            </p>
          )}
          {credito.estado === 'pendiente_aprobacion' && credito.motivoAprobacion && (
            <p className="text-xs text-yellow-700 mb-3">{credito.motivoAprobacion}</p>
          )}

          {credito.estado !== 'rechazado' && (
            <div className="space-y-3">
              {credito.anticipo > 0 && (
                <div className="flex items-center gap-3 text-sm bg-white border rounded p-2">
                  <span className="font-medium">Anticipo ${credito.anticipo.toLocaleString('es-AR')}</span>
                  {credito.anticipoPago?.estado === 'cobrado' ? (
                    <>
                      <span className="text-green-700">Cobrado — {etiquetaPago(credito.anticipoPago)}</span>
                      {credito.anticipoPago.metodo === 'comprobante' && (
                        <button onClick={() => verComprobante(credito, 0)} className="text-primary hover:underline">Ver comprobante</button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => setCobro({ credito, numero: 0, titulo: 'Cobrar anticipo' })} className="text-primary hover:underline">Registrar cobro</button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {credito.cuotas.map((cuota) => {
                  const pagada = cuota.estado === 'pagada';
                  return (
                    <div key={cuota.numero} className={`text-xs rounded px-2 py-2 border ${pagada ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-300'}`}>
                      <div className="font-medium">Cuota {cuota.numero}</div>
                      <div>${cuota.monto.toLocaleString('es-AR')}</div>
                      <div className="text-gray-500">Vence {new Date(cuota.vencimiento).toLocaleDateString('es-AR')}</div>
                      {pagada ? (
                        <>
                          <div>Pagada{cuota.pago ? ` — ${etiquetaPago(cuota.pago)}` : ''}</div>
                          {cuota.pago?.metodo === 'comprobante' && (
                            <button onClick={() => verComprobante(credito, cuota.numero)} className="underline">Ver comprobante</button>
                          )}
                        </>
                      ) : credito.estado === 'activo' ? (
                        <button onClick={() => setCobro({ credito, numero: cuota.numero, titulo: `Cobrar cuota ${cuota.numero}` })} className="text-primary underline">Registrar cobro</button>
                      ) : (
                        <div className="text-gray-400">Pendiente</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Ajustes alrededor.** En `VendedorModal.jsx`: (a) en el import de `@/services/api` quitar `marcarCuotaCredito` y agregar `obtenerCreditoConfig`, `registrarCobroCredito`, `obtenerComprobanteCredito`; (b) agregar los imports `import ClienteSelector from '@/components/clientes/ClienteSelector';`, `import CobroDialog from '@/components/clientes/CobroDialog';`, `import { abrirBlobEnPestana } from '@/lib/abrir-archivo';` e `import { calcularPlan, evaluarAprobacion } from '@/lib/credito-calculo';`; (c) en la pestaña `activeTab === 'credito'` (alrededor de la línea 353) actualizar la llamada a `<OtorgarCreditoTab ... />` para que pase solo `carritoVendedor`, `calcularTotal` y `onCreado` (ya no `cliente` ni `setCliente`; el estado `cliente` del componente padre sigue usándose por la pestaña de presupuesto). En `nextjs/services/api.js` borrar la función `marcarCuotaCredito`.

- [ ] **Step 6: Compilar y commitear**
```bash
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
grep -rn "marcarCuotaCredito" nextjs --include=*.js --include=*.jsx | grep -v node_modules
git add nextjs/components/clientes nextjs/components/VendedorModal.jsx nextjs/services/api.js
git commit -m "$(cat <<'EOF'
feat: Panel del vendedor con cliente, plan por frecuencia y cobro con comprobante o en mano

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: `✓ Compiled successfully` y el `grep` sin resultados.

---

### Task 10: Registro de operaciones (pestaña Créditos)

**Files:**
- Replace: `nextjs/components/admin/CreditosPanel.jsx` (archivo completo)

**Interfaces:**
- Consumes: `listarCreditos`, `aprobarCredito`, `rechazarCredito`, `obtenerComprobanteCredito` (existentes y Task 8), `useAdminSession`, `abrirBlobEnPestana`.
- Produces: la pantalla `Créditos` como registro: tabla con fecha, cliente, productos, quién lo cargó, quién lo aprobó, anticipo (con su estado de cobro), plan, cobrado y estado; fila expandible con cada cuota y su comprobante; aprobar/rechazar solo para admin.

- [ ] **Step 1: Reemplazar todo el contenido de `nextjs/components/admin/CreditosPanel.jsx` por:**
```jsx
'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { listarCreditos, aprobarCredito, rechazarCredito, obtenerComprobanteCredito } from '@/services/api';
import { useAdminSession } from '@/components/admin/AdminSession';
import { abrirBlobEnPestana } from '@/lib/abrir-archivo';

const ESTADOS = {
  activo: { texto: 'Activo', clase: 'bg-green-100 text-green-700' },
  pendiente_aprobacion: { texto: 'Pendiente de aprobación', clase: 'bg-yellow-100 text-yellow-700' },
  rechazado: { texto: 'Rechazado', clase: 'bg-red-100 text-red-700' },
  completado: { texto: 'Completado', clase: 'bg-blue-100 text-blue-700' },
};

const plata = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-AR') : '-');
const formaDeCobro = (pago) => (pago?.metodo === 'efectivo' ? 'En mano' : pago?.metodo === 'comprobante' ? 'Comprobante' : '');

export default function CreditosPanel() {
  const { role } = useAdminSession();
  const esAdmin = role === 'admin';
  const [creditos, setCreditos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(null);
  const [trabajando, setTrabajando] = useState(null);

  const cargar = () => {
    setCargando(true);
    listarCreditos()
      .then((d) => { setCreditos(d.creditos || []); setError(null); })
      .catch(() => setError('No se pudieron cargar los créditos'))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const vendedores = useMemo(() => [...new Set(creditos.map((c) => c.vendedorNombre).filter(Boolean))].sort(), [creditos]);

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return creditos.filter((c) => {
      if (filtroEstado && c.estado !== filtroEstado) return false;
      if (filtroVendedor && c.vendedorNombre !== filtroVendedor) return false;
      if (!t) return true;
      const blob = [c.clienteNombre, c.vendedorNombre, ...(c.productos || []).map((p) => p.nombre)].join(' ').toLowerCase();
      return blob.includes(t);
    });
  }, [creditos, filtroEstado, filtroVendedor, texto]);

  const resolver = async (credito, accion) => {
    if (!confirm(accion === 'aprobar' ? `¿Aprobar el crédito de ${credito.clienteNombre}?` : `¿Rechazar el crédito de ${credito.clienteNombre}? Se repone el stock.`)) return;
    setTrabajando(credito._id);
    try {
      await (accion === 'aprobar' ? aprobarCredito(credito._id) : rechazarCredito(credito._id));
      cargar();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo completar la acción');
    } finally {
      setTrabajando(null);
    }
  };

  const verComprobante = (credito, numero) =>
    abrirBlobEnPestana(obtenerComprobanteCredito(credito._id, numero)).catch(() => alert('No se pudo abrir el comprobante'));

  const cobrado = (c) => {
    const pagadas = (c.cuotas || []).filter((q) => q.estado === 'pagada');
    const montoCuotas = pagadas.reduce((a, q) => a + q.monto, 0);
    const anticipo = c.anticipoPago?.estado === 'cobrado' ? c.anticipo : 0;
    return { cuotas: `${pagadas.length}/${(c.cuotas || []).length}`, monto: montoCuotas + anticipo };
  };

  const quienAprobo = (c) => {
    if (c.aprobadoPor) return c.aprobadoPor.tipo === 'admin' ? c.aprobadoPor.nombre || 'Administrador' : 'Automática (dentro de límites)';
    if (c.estado === 'pendiente_aprobacion') return 'Pendiente';
    if (c.estado === 'rechazado') return c.rechazadoPor?.nombre ? `Rechazó ${c.rechazadoPor.nombre}` : 'Rechazado';
    return '-'; // créditos anteriores al registro de aprobaciones
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Créditos</h2>
        <p className="text-sm text-gray-500">{esAdmin ? 'Todas las operaciones de crédito propio.' : 'Los créditos que otorgaste vos.'}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por cliente, producto o vendedor"
          className="border rounded px-3 py-2 text-sm flex-1 min-w-[14rem]" />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="border rounded px-2 py-2 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
        </select>
        {esAdmin && (
          <select value={filtroVendedor} onChange={(e) => setFiltroVendedor(e.target.value)} className="border rounded px-2 py-2 text-sm">
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        )}
      </div>

      {error && <div role="alert" className="rounded-lg p-3 text-sm border bg-red-50 border-red-200 text-red-800">{error}</div>}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left text-xs uppercase text-gray-700">
            <tr>
              <th className="px-3 py-3 w-8"></th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Productos</th>
              <th className="px-3 py-3">Cargó</th>
              <th className="px-3 py-3">Aprobó</th>
              <th className="px-3 py-3">Anticipo</th>
              <th className="px-3 py-3">Plan</th>
              <th className="px-3 py-3">Cobrado</th>
              <th className="px-3 py-3">Estado</th>
              {esAdmin && <th className="px-3 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtrados.map((c) => {
              const est = ESTADOS[c.estado] || { texto: c.estado, clase: 'bg-gray-100' };
              const cob = cobrado(c);
              const expandido = abierto === c._id;
              return (
                <Fragment key={c._id}>
                  <tr className="align-top">
                    <td className="px-3 py-3">
                      <button type="button" aria-label={expandido ? 'Ocultar detalle' : 'Ver detalle'} onClick={() => setAbierto(expandido ? null : c._id)}>
                        {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{fecha(c.createdAt)}</td>
                    <td className="px-3 py-3 font-medium">{c.clienteNombre}</td>
                    <td className="px-3 py-3 max-w-[16rem]">{(c.productos || []).map((p) => `${p.cantidad}× ${p.nombre}`).join(', ') || '-'}</td>
                    <td className="px-3 py-3">{c.cargadoPor?.nombre || c.vendedorNombre || '-'}</td>
                    <td className="px-3 py-3">{quienAprobo(c)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {plata(c.anticipo)}
                      {c.anticipo > 0 && <span className={`block text-xs ${c.anticipoPago?.estado === 'cobrado' ? 'text-green-700' : 'text-gray-400'}`}>{c.anticipoPago?.estado === 'cobrado' ? 'Cobrado' : 'Sin cobrar'}</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {c.cantidadCuotas} cuotas {{ diaria: 'diarias', semanal: 'semanales', mensual: 'mensuales' }[c.frecuencia || 'mensual']}
                      {c.recargoPorcentaje > 0 && <span className="block text-xs text-gray-500">+{c.recargoPorcentaje}%</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{cob.cuotas} cuotas<span className="block text-xs text-gray-500">{plata(cob.monto)}</span></td>
                    <td className="px-3 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${est.clase}`}>{est.texto}</span></td>
                    {esAdmin && (
                      <td className="px-3 py-3 whitespace-nowrap">
                        {c.estado === 'pendiente_aprobacion' && (
                          <div className="flex gap-1">
                            <button type="button" disabled={trabajando === c._id} onClick={() => resolver(c, 'aprobar')} className="p-1.5 rounded border text-green-700 hover:bg-green-50" aria-label="Aprobar"><Check className="w-4 h-4" /></button>
                            <button type="button" disabled={trabajando === c._id} onClick={() => resolver(c, 'rechazar')} className="p-1.5 rounded border text-red-700 hover:bg-red-50" aria-label="Rechazar"><X className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {expandido && (
                    <tr className="bg-gray-50">
                      <td></td>
                      <td colSpan={esAdmin ? 10 : 9} className="px-3 py-3">
                        <div className="text-xs text-gray-600 mb-2">
                          {c.clienteTelefono} · {c.clienteEmail || '-'} · Total {plata(c.montoTotal)}
                          {c.interes > 0 && ` · Recargo ${plata(c.interes)}`}
                          {c.motivoAprobacion && c.estado === 'pendiente_aprobacion' && ` · ${c.motivoAprobacion}`}
                        </div>
                        <table className="text-xs">
                          <thead className="text-left text-gray-500"><tr><th className="pr-4">Pago</th><th className="pr-4">Monto</th><th className="pr-4">Vence</th><th className="pr-4">Estado</th><th className="pr-4">Cobró</th><th></th></tr></thead>
                          <tbody>
                            {c.anticipo > 0 && (
                              <tr>
                                <td className="pr-4 py-1">Anticipo</td>
                                <td className="pr-4">{plata(c.anticipo)}</td>
                                <td className="pr-4">-</td>
                                <td className="pr-4">{c.anticipoPago?.estado === 'cobrado' ? `Cobrado (${formaDeCobro(c.anticipoPago)})` : 'Pendiente'}</td>
                                <td className="pr-4">{c.anticipoPago?.registradoPor?.nombre ? `${c.anticipoPago.registradoPor.nombre} · ${fecha(c.anticipoPago.fecha)}` : '-'}</td>
                                <td>{c.anticipoPago?.metodo === 'comprobante' && <button type="button" onClick={() => verComprobante(c, 0)} className="text-blue-600 hover:underline">Ver comprobante</button>}</td>
                              </tr>
                            )}
                            {(c.cuotas || []).map((q) => (
                              <tr key={q.numero}>
                                <td className="pr-4 py-1">Cuota {q.numero}</td>
                                <td className="pr-4">{plata(q.monto)}</td>
                                <td className="pr-4">{fecha(q.vencimiento)}</td>
                                <td className="pr-4">{q.estado === 'pagada' ? `Pagada${q.pago ? ` (${formaDeCobro(q.pago)})` : ''}` : 'Pendiente'}</td>
                                <td className="pr-4">{q.pago?.registradoPor?.nombre ? `${q.pago.registradoPor.nombre} · ${fecha(q.pago.fecha)}` : q.fechaPago ? fecha(q.fechaPago) : '-'}</td>
                                <td>{q.pago?.metodo === 'comprobante' && <button type="button" onClick={() => verComprobante(c, q.numero)} className="text-blue-600 hover:underline">Ver comprobante</button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!cargando && filtrados.length === 0 && <div className="text-center py-10 text-gray-500">No hay créditos{creditos.length ? ' con esos filtros' : ' registrados'}.</div>}
        {cargando && <div className="text-center py-6 text-gray-400">Cargando...</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Compilar y commitear**
```bash
for v in verificar-menu verificar-credito verificar-permisos verificar-menu-config verificar-config; do node docs/superpowers/plans/$v.mjs 2>&1 | grep -E "✓|✗|  - "; done
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
git add nextjs/components/admin/CreditosPanel.jsx
git commit -m "$(cat <<'EOF'
feat: Registro de operaciones de crédito con quién cargó, quién aprobó y cada cobro

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```
Expected: los cinco verificadores con `✓` y `✓ Compiled successfully`.

---

### Task 11: Verificación final y entrega

**Files:** ninguno nuevo.

- [ ] **Step 1: Estado limpio, verificadores y build final**
```bash
git status --short
for v in verificar-menu verificar-config verificar-permisos verificar-menu-config verificar-credito; do node docs/superpowers/plans/$v.mjs 2>&1 | grep -E "✓|✗"; done
cd nextjs && npx next build 2>&1 | grep -E "Compiled|rror:|Failed|Type error"; cd ..
grep -rn "creditoMontoMaximo\|creditoCuotasMaximo" nextjs --include=*.js --include=*.jsx | grep -v node_modules
```
Expected: solo el PDF y `backups/` sin commitear; los cinco verificadores con `✓`; `✓ Compiled successfully`; el último `grep` solo debe mostrar el modelo `PaymentSettings`, la ruta `payment-settings` (compatibilidad) y `lib/credito-config.js` (la siembra); ninguna pantalla.

- [ ] **Step 2: Lista de comprobación (la recorre el dueño después de deployar, con una cuenta de admin y una de vendedor)**

Configuración:
- Gestión de Ventas → **Planes de crédito propio**: aparecen planes mensuales de 1 a 6 cuotas sin recargo (lo que había). Agregar un plan semanal de 4 cuotas con 8% y guardar; marcar uno como "requiere aprobación".
- **Mercado Pago**: cambiar el máximo de cuotas y verificar en el checkout.
- La pestaña **Créditos** ya no muestra la "Configuración de pagos".

Clientes (vendedor):
- **Clientes** → Nuevo cliente: sin teléfono o sin email no deja guardar; con email vacío o con una frase distinta/incompleta tampoco; con la frase exacta `cliente no posee mail en este momento o no usa` sí. Un documento repetido avisa y no duplica.
- Subir DNI frente/dorso, recibo y servicio (probar una foto grande del celular y un PDF): quedan como "Cargado" y el botón Ver los abre. Si un PDF no se abre, activar "PDF and ZIP files delivery" en Cloudinary (Settings → Security).
- El vendedor ve solo sus clientes; el admin ve todos con la columna "Cargado por".
- En **Configuración → Usuarios**: el bloque "Clientes cargados por vendedores" con la marca "Cliente creado por vendedor".

Crédito:
- Panel del vendedor → Presupuesto con productos → **Crédito**: elegir un cliente, frecuencia y plan; la cuota se calcula en vivo con el recargo. Un monto mayor al máximo o un plan "requiere aprobación" avisa que queda pendiente.
- En **Mis créditos**: registrar el anticipo y una cuota con comprobante, y otra "en mano"; ver el comprobante.
- Admin → **Créditos**: el registro muestra quién cargó, quién aprobó (o "Automática"), anticipo y su estado de cobro, plan, cobrado y estado; abrir la fila muestra cada cuota con su comprobante. Aprobar y rechazar un pendiente (queda el nombre de quien aprobó).
- Un créditos viejo (anterior a este cambio) se sigue viendo sin errores.

Seguridad:
- Con dos vendedores distintos: el segundo no ve ni abre clientes, documentos ni comprobantes del primero, ni siquiera pegando la dirección de la API.
- Sin sesión, las direcciones `/api/clientes`, `/api/clientes/archivo` y `/api/creditos/comprobante` responden error de autenticación.

- [ ] **Step 3: Reportar.** Informar el resultado y que los commits están en `master` **sin push**; el push (que deploya a producción) lo decide el dueño.
