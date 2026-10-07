'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { calcularPlan } from '@/lib/credito-calculo';
import { obtenerCreditoConfig, guardarCreditoConfig } from '@/services/api';

const FRECUENCIAS = [
  { id: 'diaria', titulo: 'Cuotas diarias', unidad: 'días', por: 'por día', agregar: 'Agregar plan diario' },
  { id: 'semanal', titulo: 'Cuotas semanales', unidad: 'semanas', por: 'por semana', agregar: 'Agregar plan semanal' },
  { id: 'mensual', titulo: 'Cuotas mensuales', unidad: 'meses', por: 'por mes', agregar: 'Agregar plan mensual' },
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
    setPlanes((prev) => [...prev, { frecuencia, cuotas: 1, entrega: 0, tasa: 0, requiereAprobacion: false, activo: true }]);

  const handleGuardar = async () => {
    const montoNum = Number(monto);
    if (monto.trim() === '' || !Number.isFinite(montoNum) || montoNum < 0) {
      setErrores([]);
      setMensaje({ tipo: 'error', texto: 'Ingresá el monto máximo sin aprobación (un número de 0 o más).' });
      return;
    }
    setGuardando(true);
    setMensaje(null);
    setErrores([]);
    try {
      const data = await guardarCreditoConfig({ montoMaximoSinAprobacion: montoNum, planes });
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
          El vendedor elige uno de estos planes al otorgar un crédito. Cada plan tiene una entrega mínima (% del total) y un interés por período (por día, semana o mes) que se calcula sobre el saldo (total menos entrega). Cada cuota es capital + interés. El vendedor puede pedir más entrega si el cliente quiere dar más.
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
                Entrega mínima (%)
                <input type="number" min="0" max="90" step="0.1" value={p.entrega}
                  onChange={(e) => cambiar(indice, { entrega: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="border rounded px-2 py-1.5 w-24 ml-2" />
              </label>
              <label className="text-sm">
                Interés {f.por} (%)
                <input type="number" min="0" max="100" step="0.1" value={p.tasa}
                  onChange={(e) => cambiar(indice, { tasa: e.target.value === '' ? '' : Number(e.target.value) })}
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
              <button type="button" aria-label={`Quitar plan ${p.frecuencia} de ${p.cuotas} cuotas`} onClick={() => quitar(indice)}
                className="ml-auto p-1.5 rounded border text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              <EjemploPlan plan={p} unidad={f.unidad} />
            </div>
          ))}
          <button type="button" onClick={() => agregar(f.id)}
            className="flex items-center gap-2 border border-dashed border-gray-400 px-3 py-1.5 rounded text-sm text-gray-600 hover:bg-gray-50">
            <Plus className="w-4 h-4" /> {f.agregar}
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

const plata = (n) => `$${n.toLocaleString('es-AR')}`;

// Cómo impacta el plan sobre una venta de $100.000
function EjemploPlan({ plan, unidad }) {
  const c = calcularPlan({ montoTotal: 100000, entregaPorcentaje: plan.entrega, tasaPorcentaje: plan.tasa, cantidadCuotas: plan.cuotas, frecuencia: plan.frecuencia });
  if (!c.ok) return <p className="w-full text-xs text-gray-400">Completá los datos del plan para ver el ejemplo.</p>;
  return (
    <div className="w-full text-xs bg-gray-50 border rounded p-3 text-gray-700 space-y-0.5">
      <p className="font-semibold">Ejemplo con una venta de $100.000 en {plan.cuotas} {unidad}</p>
      <p>Entrega: {plata(c.anticipo)} — saldo a financiar: {plata(c.montoFinanciado)}</p>
      <p>Cada cuota: {plata(c.capitalCuota)} de capital + {plata(c.interesPorCuota)} de interés = <strong>{plata(c.montoCuota)}</strong></p>
      <p>Interés total: {plata(c.interes)} — el cliente paga en total <strong>{plata(c.totalFinal)}</strong></p>
    </div>
  );
}
