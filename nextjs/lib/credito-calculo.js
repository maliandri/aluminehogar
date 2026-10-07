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
export function calcularPlan(entrada) {
  if (!entrada || typeof entrada !== 'object') return { ok: false, errores: ['Datos del plan inválidos'] };
  const { montoTotal, anticipo = 0, cantidadCuotas, frecuencia, recargoPorcentaje = 0, desde = new Date() } = entrada;
  const errores = [];
  if (!esNumero(montoTotal) || montoTotal <= 0) errores.push('El monto total tiene que ser mayor a 0');
  else if (montoTotal > 1e9) errores.push('El monto total es demasiado grande');
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
  if (montoCuota < 0.01) return { ok: false, errores: ['El monto es muy chico para esa cantidad de cuotas'] };

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
  const n = Number(cuotas);
  if (!Number.isInteger(n)) return null;
  const plan = planes.find((p) => p && p.frecuencia === frecuencia && p.cuotas === n);
  return plan && plan.activo === true ? plan : null;
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
