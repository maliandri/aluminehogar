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
