'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { listarClientes, getUsuarios, reasignarCliente } from '@/services/api';
import { useAdminSession } from '@/components/admin/AdminSession';
import ClienteForm from '@/components/clientes/ClienteForm';

// Solo administrador: pasa un cliente a otro vendedor (los créditos ya otorgados conservan su vendedor)
function ReasignarBlock({ cliente, onReasignado }) {
  const [vendedores, setVendedores] = useState([]);
  const [vendedorId, setVendedorId] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  useEffect(() => {
    let cancelado = false;
    getUsuarios()
      .then((d) => { if (!cancelado) setVendedores((d.users || []).filter((u) => u.role === 'vendedor')); })
      .catch(() => { if (!cancelado) setError('No se pudieron cargar los vendedores'); });
    return () => { cancelado = true; };
  }, []);

  const handleReasignar = async () => {
    if (!vendedorId) return;
    const destino = vendedores.find((v) => v._id === vendedorId);
    if (!confirm(`¿Pasar a ${cliente.nombre} a ${destino?.nombre || destino?.email}?`)) return;
    setTrabajando(true);
    setError(null);
    setOk(null);
    try {
      const data = await reasignarCliente(cliente._id, vendedorId);
      setOk(`Ahora lo atiende ${data.cliente?.creadoPor?.nombre || 'el vendedor elegido'}.`);
      onReasignado?.(data.cliente);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo reasignar el cliente');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div className="border-t mt-6 pt-4 space-y-2">
      <h4 className="font-semibold text-sm">Reasignar a otro vendedor</h4>
      <p className="text-xs text-gray-500">Hoy lo atiende: {cliente.creadoPor?.nombre || '-'}. Los créditos que ya tiene siguen a nombre de su vendedor original.</p>
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Vendedor nuevo" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="border rounded px-2 py-2 text-sm">
          <option value="">Elegí un vendedor</option>
          {vendedores.map((v) => <option key={v._id} value={v._id}>{v.nombre || v.email}</option>)}
        </select>
        <button type="button" onClick={handleReasignar} disabled={!vendedorId || trabajando} className="border px-3 py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50">
          {trabajando ? 'Reasignando...' : 'Reasignar'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {ok && <p role="status" className="text-sm text-green-700">{ok}</p>}
    </div>
  );
}

export default function ClientesPanel() {
  const { role } = useAdminSession();
  const [clientes, setClientes] = useState([]);
  const [q, setQ] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null); // null = cerrado, 'nuevo' o un cliente

  const pedido = useRef(0);

  const cargar = (texto) => {
    // Si ya salió un pedido más nuevo, la respuesta de este se descarta
    const mio = ++pedido.current;
    setCargando(true);
    listarClientes(texto)
      .then((data) => { if (mio === pedido.current) { setClientes(data.clientes || []); setError(null); } })
      .catch(() => { if (mio === pedido.current) setError('No se pudieron cargar los clientes'); })
      .finally(() => { if (mio === pedido.current) setCargando(false); });
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
          aria-label="Buscar clientes" className="w-full border rounded pl-9 pr-3 py-2 text-sm" />
      </div>

      {error && <div role="alert" className="rounded-lg p-3 text-sm border bg-red-50 border-red-200 text-red-800">{error}</div>}

      {abierto && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">{abierto === 'nuevo' ? 'Nuevo cliente' : abierto.nombre}</h3>
          <ClienteForm key={abierto === 'nuevo' ? 'nuevo' : abierto._id} cliente={abierto === 'nuevo' ? null : abierto} onGuardado={alGuardar} onCancelar={() => setAbierto(null)} />
          {role === 'admin' && abierto !== 'nuevo' && <ReasignarBlock key={abierto._id} cliente={abierto} onReasignado={(c) => { setAbierto(c); cargar(q); }} />}
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
        {!cargando && clientes.length === 50 && <div className="text-center py-3 text-xs text-gray-500">Mostrando los últimos 50. Usá el buscador para ver otros.</div>}
      </div>
    </div>
  );
}
