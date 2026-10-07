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

// La entrega mínima es un % del total (el vendedor puede pedir más con `anticipo`); el saldo (total − entrega) se divide en cuotas de capital iguales y a cada cuota
// se le suma el interés fijo: tasa% por período sobre el saldo financiado. La última cuota absorbe los centavos.
export function calcularPlan(entrada) {
  if (!entrada || typeof entrada !== 'object') return { ok: false, errores: ['Datos del plan inválidos'] };
  const { montoTotal, entregaPorcentaje = 0, tasaPorcentaje = 0, cantidadCuotas, frecuencia, anticipo: anticipoPedido, desde = new Date() } = entrada;
  const errores = [];
  if (!esNumero(montoTotal) || montoTotal <= 0) errores.push('El monto total tiene que ser mayor a 0');
  else if (montoTotal > 1e9) errores.push('El monto total es demasiado grande');
  if (!esNumero(entregaPorcentaje) || entregaPorcentaje < 0 || entregaPorcentaje > 90) errores.push('La entrega no es válida');
  if (!Number.isInteger(cantidadCuotas) || cantidadCuotas < 1 || cantidadCuotas > 365) errores.push('La cantidad de cuotas no es válida');
  if (!FRECUENCIAS.includes(frecuencia)) errores.push('La frecuencia no es válida');
  if (!esNumero(tasaPorcentaje) || tasaPorcentaje < 0 || tasaPorcentaje > 100) errores.push('La tasa de interés no es válida');
  const anticipoMinimo = errores.length ? 0 : redondear((montoTotal * entregaPorcentaje) / 100);
  if (anticipoPedido !== undefined && anticipoPedido !== null) {
    if (!esNumero(anticipoPedido) || anticipoPedido < 0) errores.push('La entrega no es válida');
    else if (anticipoPedido < anticipoMinimo) errores.push(`La entrega mínima de este plan es $${anticipoMinimo.toLocaleString('es-AR')}`);
    else if (esNumero(montoTotal) && anticipoPedido >= montoTotal) errores.push('La entrega tiene que ser menor al monto total');
  }
  if (errores.length) return { ok: false, errores };

  const anticipo = anticipoPedido === undefined || anticipoPedido === null ? anticipoMinimo : redondear(anticipoPedido);
  const montoFinanciado = redondear(montoTotal - anticipo);
  const interesPorCuota = redondear((montoFinanciado * tasaPorcentaje) / 100);
  const interes = redondear(interesPorCuota * cantidadCuotas);
  const totalCuotas = redondear(montoFinanciado + interes);
  const capitalCuota = Math.floor((montoFinanciado / cantidadCuotas) * 100) / 100;
  const montoCuota = redondear(capitalCuota + interesPorCuota);
  if (montoCuota < 0.01) return { ok: false, errores: ['El monto es muy chico para esa cantidad de cuotas'] };

  const cuotas = [];
  let acumulado = 0;
  for (let i = 1; i <= cantidadCuotas; i++) {
    const monto = i === cantidadCuotas ? redondear(totalCuotas - acumulado) : montoCuota;
    acumulado = redondear(acumulado + monto);
    cuotas.push({ numero: i, monto, vencimiento: sumarPeriodo(desde, frecuencia, i), estado: 'pendiente', fechaPago: null });
  }
  return {
    ok: true, errores: [], anticipo, anticipoMinimo, montoFinanciado, capitalCuota, interesPorCuota, interes, totalCuotas,
    totalFinal: redondear(anticipo + totalCuotas), montoCuota, cuotas
  };
}

// Planes guardados antes de este cambio tenían un "recargo" total sin entrega: se reparte como tasa por período
export function normalizarPlan(p) {
  if (!p || typeof p !== 'object') return p;
  const { recargo, ...resto } = p;
  if (typeof resto.tasa === 'number') return { ...resto, entrega: typeof resto.entrega === 'number' ? resto.entrega : 0 };
  const total = typeof recargo === 'number' ? recargo : 0;
  const n = Number.isInteger(resto.cuotas) && resto.cuotas > 0 ? resto.cuotas : 1;
  return { ...resto, entrega: 0, tasa: redondear(total / n) };
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
  const n = Number(cuotas);
  if (!Number.isInteger(n)) return null;
  const plan = planes.find((p) => p && p.frecuencia === frecuencia && p.cuotas === n);
  return plan && plan.activo === true ? normalizarPlan(plan) : null;
}

// Planes mensuales de 1 a N cuotas sin recargo: reproducen el comportamiento anterior (cuotas máximas del admin)
export function planesDeFabrica(cuotasMaximo) {
  const n = Math.min(24, Math.max(1, Math.floor(Number(cuotasMaximo) || 1)));
  return Array.from({ length: n }, (_, i) => ({ frecuencia: 'mensual', cuotas: i + 1, entrega: 0, tasa: 0, requiereAprobacion: false, activo: true }));
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
    const q = normalizarPlan(p);
    if (!esNumero(q.entrega) || q.entrega < 0 || q.entrega > 90) errores.push(`${nombre}: la entrega tiene que estar entre 0 y 90`);
    if (!esNumero(q.tasa) || q.tasa < 0 || q.tasa > 100) errores.push(`${nombre}: la tasa de interés tiene que estar entre 0 y 100`);
    if (typeof p.requiereAprobacion !== 'boolean' || typeof p.activo !== 'boolean') errores.push(`${nombre}: "requiere aprobación" y "activo" tienen que ser sí o no`);
    const clave = `${p.frecuencia}:${p.cuotas}`;
    if (vistos.has(clave)) errores.push(`${nombre}: ya hay un plan ${p.frecuencia} de ${p.cuotas} cuotas`);
    vistos.add(clave);
    planes.push({ frecuencia: p.frecuencia, cuotas: p.cuotas, entrega: redondear(q.entrega), tasa: redondear(q.tasa), requiereAprobacion: p.requiereAprobacion === true, activo: p.activo === true });
  });

  return errores.length
    ? { ok: false, errores, valor: null }
    : { ok: true, errores: [], valor: { montoMaximoSinAprobacion: monto, planes } };
}
