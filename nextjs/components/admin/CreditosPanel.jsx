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
