'use client';

import { useState, useEffect } from 'react';
import {
  listarDepositos,
  crearDeposito,
  actualizarDeposito,
  eliminarDeposito,
} from '@/services/api';
import { useAdminSession } from '@/components/admin/AdminSession';
import { puedeEditar } from '@/lib/permisos';

export default function DepositosPanel() {
  const { role } = useAdminSession();
  const puedeEditarDepositos = puedeEditar(role, 'depositos');
  const [depositos, setDepositos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ codigo: '', nombre: '', esVirtualVendedor: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchDepositos(); }, []);

  const fetchDepositos = async () => {
    try {
      setLoading(true);
      const data = await listarDepositos();
      setDepositos(data.depositos || []);
    } catch {
      alert('Error al cargar depositos');
    } finally {
      setLoading(false);
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!form.codigo || !form.nombre) return;
    setSaving(true);
    try {
      await crearDeposito(form);
      setForm({ codigo: '', nombre: '', esVirtualVendedor: false });
      fetchDepositos();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al crear el deposito');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (deposito) => {
    try {
      await actualizarDeposito(deposito._id, { activo: !deposito.activo });
      fetchDepositos();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al actualizar');
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este deposito?')) return;
    try {
      await eliminarDeposito(id);
      fetchDepositos();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      {puedeEditarDepositos && (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Nuevo deposito</h3>
        <form onSubmit={handleCrear} className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Codigo</label>
            <input type="text" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              className="border rounded px-3 py-2 text-sm" placeholder="001" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="Deposito Limansky" />
          </div>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={form.esVirtualVendedor}
              onChange={(e) => setForm({ ...form, esVirtualVendedor: e.target.checked })} />
            Deposito virtual para vendedores
          </label>
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400">
            {saving ? 'Creando...' : 'Crear'}
          </button>
        </form>
      </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Codigo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Virtual vendedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {depositos.map((d) => (
              <tr key={d._id}>
                <td className="px-4 py-3 text-sm">{d.codigo}</td>
                <td className="px-4 py-3 text-sm">{d.nombre}</td>
                <td className="px-4 py-3 text-sm">{d.esVirtualVendedor ? 'Si' : 'No'}</td>
                <td className="px-4 py-3 text-sm">{d.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-3 text-right text-sm space-x-2">
                  {puedeEditarDepositos && (<>
                  <button onClick={() => handleToggleActivo(d)} className="text-blue-600 hover:underline">
                    {d.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleEliminar(d._id)} className="text-red-600 hover:underline">Eliminar</button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {depositos.length === 0 && <div className="text-center py-12 text-gray-500">No hay depositos creados.</div>}
      </div>
    </div>
  );
}

// =================== MEDIOS DE PAGO PANEL ===================
