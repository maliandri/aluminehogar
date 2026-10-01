'use client';

import { useState, useEffect } from 'react';
import {
  listarMediosPago,
  crearMedioPago,
  actualizarMedioPago,
  eliminarMedioPago,
} from '@/services/api';
import { APLICA_A_LABELS } from './etiquetas';

export default function MediosPagoPanel() {
  const [mediosPago, setMediosPago] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nombre: '', tipo: 'unico', tasaInteres: 0, cantidadCuotas: 1,
    scope: ['online', 'vendedor'], aplicaA: 'todos', aplicaAValores: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchMediosPago(); }, []);

  const fetchMediosPago = async () => {
    try {
      setLoading(true);
      const data = await listarMediosPago();
      setMediosPago(data.mediosPago || []);
    } catch {
      alert('Error al cargar medios de pago');
    } finally {
      setLoading(false);
    }
  };

  const toggleScope = (s) => {
    setForm((prev) => ({
      ...prev,
      scope: prev.scope.includes(s) ? prev.scope.filter(x => x !== s) : [...prev.scope, s]
    }));
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!form.nombre) return;
    setSaving(true);
    try {
      await crearMedioPago({
        ...form,
        aplicaAValores: form.aplicaAValores ? form.aplicaAValores.split(',').map(v => v.trim()).filter(Boolean) : []
      });
      setForm({ nombre: '', tipo: 'unico', tasaInteres: 0, cantidadCuotas: 1, scope: ['online', 'vendedor'], aplicaA: 'todos', aplicaAValores: '' });
      fetchMediosPago();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al crear el medio de pago');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (medio) => {
    try {
      await actualizarMedioPago(medio._id, { activo: !medio.activo });
      fetchMediosPago();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al actualizar');
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este medio de pago?')) return;
    try {
      await eliminarMedioPago(id);
      fetchMediosPago();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Nuevo medio de pago</h3>
        <form onSubmit={handleCrear} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="Tarjeta 3 cuotas" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              <option value="unico">Pago unico</option>
              <option value="cuotas">Cuotas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tasa de interes (%)</label>
            <input type="number" min="0" value={form.tasaInteres}
              onChange={(e) => setForm({ ...form, tasaInteres: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          {form.tipo === 'cuotas' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad de cuotas</label>
              <input type="number" min="1" max="24" value={form.cantidadCuotas}
                onChange={(e) => setForm({ ...form, cantidadCuotas: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Aplica a</label>
            <select value={form.aplicaA} onChange={(e) => setForm({ ...form, aplicaA: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              {Object.entries(APLICA_A_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          {form.aplicaA !== 'todos' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Valores ({form.aplicaA === 'producto' ? 'IDs' : form.aplicaA}, separados por coma)
              </label>
              <input type="text" value={form.aplicaAValores} onChange={(e) => setForm({ ...form, aplicaAValores: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="Colchón, Heladera Exhibidora" />
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.scope.includes('online')} onChange={() => toggleScope('online')} /> Online
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.scope.includes('vendedor')} onChange={() => toggleScope('vendedor')} /> Vendedor
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400">
              {saving ? 'Creando...' : 'Crear medio de pago'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tasa</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Aplica a</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Scope</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {mediosPago.map((m) => (
              <tr key={m._id}>
                <td className="px-4 py-3 text-sm">{m.nombre}</td>
                <td className="px-4 py-3 text-sm">{m.tipo === 'cuotas' ? `${m.cantidadCuotas} cuotas` : 'Unico'}</td>
                <td className="px-4 py-3 text-sm">{m.tasaInteres}%</td>
                <td className="px-4 py-3 text-sm">{APLICA_A_LABELS[m.aplicaA]}{m.aplicaAValores?.length ? `: ${m.aplicaAValores.join(', ')}` : ''}</td>
                <td className="px-4 py-3 text-sm">{m.scope.join(', ')}</td>
                <td className="px-4 py-3 text-sm">{m.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-3 text-right text-sm space-x-2">
                  <button onClick={() => handleToggleActivo(m)} className="text-blue-600 hover:underline">
                    {m.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleEliminar(m._id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {mediosPago.length === 0 && <div className="text-center py-12 text-gray-500">No hay medios de pago creados.</div>}
      </div>
    </div>
  );
}

// =================== PROMOCIONES PANEL ===================
