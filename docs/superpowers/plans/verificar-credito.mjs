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
const CABECERAS = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 2, 3, 4]), Buffer.from('WEBP')]),
  'application/pdf': Buffer.from('%PDF-1.4')
};
const conCabecera = (mime, n) => Buffer.concat([CABECERAS[mime], Buffer.alloc(n - CABECERAS[mime].length, 1)]).toString('base64');
t('archivo png chico válido', () => {
  const r = A.validarArchivo(`data:image/png;base64,${conCabecera('image/png', 1000)}`);
  assert.equal(r.ok, true);
  assert.equal(r.mime, 'image/png');
  assert.equal(r.bytes, 1000);
});
t('archivo pdf válido', () => assert.equal(A.validarArchivo(`data:application/pdf;base64,${conCabecera('application/pdf', 500)}`).ok, true));
for (const mime of ['text/html', 'image/svg+xml', 'application/x-msdownload', 'application/javascript']) {
  t(`rechaza ${mime}`, () => assert.equal(A.validarArchivo(`data:${mime};base64,${b64(100)}`).ok, false));
}
t('rechaza archivo demasiado grande', () => assert.equal(A.validarArchivo(`data:image/jpeg;base64,${conCabecera('image/jpeg', 3 * 1024 * 1024 + 10)}`).ok, false));
for (const mime of Object.keys(CABECERAS)) {
  t(`acepta justo en el límite con cabecera real de ${mime}`, () => assert.equal(A.validarArchivo(`data:${mime};base64,${conCabecera(mime, 3 * 1024 * 1024)}`).ok, true));
}
const b64Texto = (txt) => Buffer.from(txt).toString('base64');
t('rechaza SVG declarado como png', () => assert.equal(A.validarArchivo(`data:image/png;base64,${b64Texto('<svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg"></svg>')}`).ok, false));
t('rechaza HTML declarado como pdf', () => assert.equal(A.validarArchivo(`data:application/pdf;base64,${b64Texto('<html><script>alert(1)</script></html>')}`).ok, false));
t('rechaza cabecera PNG declarada como jpeg', () => assert.equal(A.validarArchivo(`data:image/jpeg;base64,${conCabecera('image/png', 100)}`).ok, false));
t('rechaza RIFF que no es WEBP', () => assert.equal(A.validarArchivo(`data:image/webp;base64,${Buffer.concat([Buffer.from('RIFF'), Buffer.from([1,2,3,4]), Buffer.from('WAVE'), Buffer.alloc(20,1)]).toString('base64')}`).ok, false));
t('rechaza archivo más corto que la cabecera', () => assert.equal(A.validarArchivo(`data:image/png;base64,${Buffer.from([0x89, 0x50]).toString('base64')}`).ok, false));
t('rechaza entradas mal formadas', () => {
  assert.equal(A.validarArchivo(null).ok, false);
  assert.equal(A.validarArchivo('hola').ok, false);
  assert.equal(A.validarArchivo('data:image/png;base64,').ok, false);
  assert.equal(A.validarArchivo('data:image/png;base64,@@@@').ok, false);
  assert.equal(A.validarArchivo('data:image/png;base64,abc').ok, false);
  assert.equal(A.validarArchivo({ x: 1 }).ok, false);
});

// ---------- endurecimiento (ronda de fixes 1) ----------
t('rechaza cuotas de $0', () => {
  assert.equal(C.calcularPlan({ ...base, montoTotal: 0.01, anticipo: 0, cantidadCuotas: 2, recargoPorcentaje: 0 }).ok, false);
  assert.equal(C.calcularPlan({ ...base, montoTotal: 1, anticipo: 0, cantidadCuotas: 365, frecuencia: 'diaria', recargoPorcentaje: 0 }).ok, false);
});
t('acepta 100 en 365 cuotas sin anticipo', () => {
  const r = C.calcularPlan({ ...base, montoTotal: 100, anticipo: 0, cantidadCuotas: 365, frecuencia: 'diaria', recargoPorcentaje: 0 });
  assert.equal(r.ok, true);
  assert.equal(Math.min(...r.cuotas.map((c) => c.monto)), 0.27);
  assert.equal(Math.round(r.cuotas.reduce((a, c) => a + c.monto, 0) * 100) / 100, 100);
});
t('cuota única con recargo 300 y sin anticipo', () => {
  const r = C.calcularPlan({ ...base, montoTotal: 50000, anticipo: 0, cantidadCuotas: 1, recargoPorcentaje: 300 });
  assert.equal(r.ok, true);
  assert.equal(r.totalCuotas, 200000);
  assert.equal(r.cuotas[0].monto, 200000);
});
t('rechaza monto total gigante', () => assert.equal(C.calcularPlan({ ...base, montoTotal: 2e9 }).ok, false));
t('calcularPlan con null o undefined no explota', () => {
  assert.equal(C.calcularPlan(null).ok, false);
  assert.equal(C.calcularPlan(undefined).ok, false);
  assert.equal(C.calcularPlan('x').ok, false);
});
t('año bisiesto', () => assert.equal(dia(C.sumarPeriodo(new Date(2028, 0, 31, 12), 'mensual', 1)), '2028-2-29'));
t('el vencimiento no depende de la hora', () => {
  assert.equal(dia(C.sumarPeriodo(new Date(2026, 0, 31, 0, 59), 'mensual', 1)), dia(C.sumarPeriodo(new Date(2026, 0, 31, 23, 59), 'mensual', 1)));
});
t('buscarPlan estricto con activo y tolerante con cuotas texto', () => {
  assert.equal(C.buscarPlan([{ ...planes[0], activo: 'no' }], 'mensual', 3), null);
  assert.equal(C.buscarPlan(planes, 'mensual', '3').recargo, 10);
  assert.equal(C.buscarPlan(planes, 'mensual', 3.5), null);
});
t('validarArchivo con maxBytes inválido usa el máximo', () => {
  assert.equal(A.validarArchivo(`data:image/jpeg;base64,${b64(4 * 1024 * 1024)}`, NaN).ok, false);
  assert.equal(A.validarArchivo(`data:image/jpeg;base64,${conCabecera('image/jpeg', 1000)}`, -5).ok, true);
});
t('rechaza email de más de 120 caracteres', () => assert.equal(con({ email: 'a'.repeat(115) + '@b.com' }).ok, false));

if (problemas.length) {
  console.error(`✗ ${problemas.length} problema(s):\n` + problemas.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('✓ Crédito y clientes OK: cálculo, planes, aprobación, validación de clientes y de archivos');
