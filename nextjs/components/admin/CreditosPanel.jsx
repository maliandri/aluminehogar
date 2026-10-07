'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import {
  listarCreditos,
  aprobarCredito,
  rechazarCredito,
} from '@/services/api';
import { useAdminSession } from '@/components/admin/AdminSession';
import { puedeEditar } from '@/lib/permisos';

const ESTADO_CREDITO_LABELS = {
  activo: 'Activo',
  pendiente_aprobacion: 'Pendiente de aprobacion',
  rechazado: 'Rechazado',
  completado: 'Completado'
};

export default function CreditosPanel() {
  const { role } = useAdminSession();
  const puedeEditarCreditos = puedeEditar(role, 'creditos');
  const [creditos, setCreditos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const creditosData = await listarCreditos();
      setCreditos(creditosData.creditos || []);
    } catch {
      alert('Error al cargar creditos');
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (id) => {
    try {
      await aprobarCredito(id);
      fetchAll();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al aprobar el credito');
    }
  };

  const handleRechazar = async (id) => {
    if (!confirm('¿Rechazar este credito?')) return;
    try {
      await rechazarCredito(id);
      fetchAll();
    } catch (e) {
      alert(e.response?.data?.error || 'Error al rechazar el credito');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando...</div>;

  const pendientes = creditos.filter(c => c.estado === 'pendiente_aprobacion');
  const resto = creditos.filter(c => c.estado !== 'pendiente_aprobacion');

  return (
    <div className="space-y-6">
      {pendientes.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Pendientes de aprobacion ({pendientes.length})</h3>
          <div className="space-y-3">
            {pendientes.map((c) => (
              <div key={c._id} className="border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.clienteNombre} — vendedor: {c.vendedorNombre}</p>
                  <p className="text-sm text-gray-500">
                    Total ${c.montoTotal.toLocaleString('es-AR')} — Anticipo ${c.anticipo.toLocaleString('es-AR')} — {c.cantidadCuotas} cuotas
                  </p>
                </div>
                {puedeEditarCreditos && (
                <div className="flex gap-2">
                  <button onClick={() => handleAprobar(c._id)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">
                    <Check className="w-4 h-4" /> Aprobar
                  </button>
                  <button onClick={() => handleRechazar(c._id)} className="flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700">
                    <X className="w-4 h-4" /> Rechazar
                  </button>
                </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vendedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cuotas</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {resto.map((c) => (
              <tr key={c._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{c.clienteNombre}</td>
                <td className="px-4 py-3 text-sm">{c.vendedorNombre}</td>
                <td className="px-4 py-3 text-sm">${c.montoTotal.toLocaleString('es-AR')}</td>
                <td className="px-4 py-3 text-sm">
                  {c.cuotas.filter(q => q.estado === 'pagada').length}/{c.cantidadCuotas} pagadas
                </td>
                <td className="px-4 py-3 text-sm">{ESTADO_CREDITO_LABELS[c.estado] || c.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {resto.length === 0 && (
          <div className="text-center py-12 text-gray-500">No hay creditos registrados.</div>
        )}
      </div>
    </div>
  );
}

// =================== DEPOSITOS PANEL ===================
