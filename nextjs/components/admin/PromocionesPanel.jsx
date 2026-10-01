'use client';

import { useState, useEffect } from 'react';
import {
  listarPromociones,
  crearPromocion,
  actualizarPromocion,
  eliminarPromocion,
} from '@/services/api';
import { APLICA_A_LABELS } from './etiquetas';

export default function PromocionesPanel() {
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nombre: '', tipo: 'descuento', scope: ['online', 'vendedor'],
    aplicaA: 'todos', aplicaAValores: '', descuentoPorcentaje: 10,
    comboProductoRegaloId: '', comboDescuentoSegundoProducto: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPromociones(); }, []);

  const fetchPromociones = async () => {
    try {
      setLoading(true);
      const data = await listarPromociones();
      setPromociones(data.promociones || []);
    } catch {
      alert('Error al cargar promociones');
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
      await crearPromocion({
        ...form,
        aplicaAValores: form.aplicaAValores ? form.aplicaAValores.split(',').map(v => v.trim()).filter(Boolean) : []
      });
      setForm({ nombre: '', tipo: 'descuento', scope: ['online', 'vendedor'], aplicaA: 'todos', aplicaAValores: '', descuentoPorcentaje: 10, comboProductoRegaloId: '', comboDescuentoSegundoProducto: 0 });
      fetchPromociones();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al crear la promocion');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (promo) => {
    try {
      await actualizarPromocion(promo._id, { activo: !promo.activo });
      fetchPromociones();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al actualizar');
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar esta promocion?')) return;
    try {
      await eliminarPromocion(id);
      fetchPromociones();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al eliminar');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Nueva promocion</h3>
        <form onSubmit={handleCrear} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="Descuento verano" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              <option value="descuento">Descuento simple</option>
              <option value="combo">Combo (regalo / 2do producto)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Aplica a</label>
            <select value={form.aplicaA} onChange={(e) => setForm({ ...form, aplicaA: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              {Object.entries(APLICA_A_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </div>
          {form.aplicaA !== 'todos' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valores (separados por coma)</label>
              <input type="text" value={form.aplicaAValores} onChange={(e) => setForm({ ...form, aplicaAValores: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="Colchón" />
            </div>
          )}
          {form.tipo === 'descuento' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descuento (%)</label>
              <input type="number" min="0" max="90" value={form.descuentoPorcentaje}
                onChange={(e) => setForm({ ...form, descuentoPorcentaje: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}
          {form.tipo === 'combo' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ID producto de regalo (opcional)</label>
                <input type="text" value={form.comboProductoRegaloId} onChange={(e) => setForm({ ...form, comboProductoRegaloId: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm" placeholder="ID del producto" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descuento 2do producto (%)</label>
                <input type="number" min="0" max="100" value={form.comboDescuentoSegundoProducto}
                  onChange={(e) => setForm({ ...form, comboDescuentoSegundoProducto: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </>
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
              {saving ? 'Creando...' : 'Crear promocion'}
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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Aplica a</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Scope</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {promociones.map((p) => (
              <tr key={p._id}>
                <td className="px-4 py-3 text-sm">{p.nombre}</td>
                <td className="px-4 py-3 text-sm">{p.tipo === 'descuento' ? `${p.descuentoPorcentaje}% off` : 'Combo'}</td>
                <td className="px-4 py-3 text-sm">{APLICA_A_LABELS[p.aplicaA]}{p.aplicaAValores?.length ? `: ${p.aplicaAValores.join(', ')}` : ''}</td>
                <td className="px-4 py-3 text-sm">{p.scope.join(', ')}</td>
                <td className="px-4 py-3 text-sm">{p.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-3 text-right text-sm space-x-2">
                  <button onClick={() => handleToggleActivo(p)} className="text-blue-600 hover:underline">
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => handleEliminar(p._id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {promociones.length === 0 && <div className="text-center py-12 text-gray-500">No hay promociones creadas.</div>}
      </div>
    </div>
  );
}

// =================== CONVERSATIONS PANEL ===================
